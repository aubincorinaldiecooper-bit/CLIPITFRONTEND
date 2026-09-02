import type {
  ActivityStats,
  ApiErrorBody,
  Clip,
  ClipCaption,
  ClipMatch,
  ClipRequest,
  EvaluationReport,
  InvitePreview,
  LibraryClip,
  MatchFeedback,
  MatchFeedbackReason,
  ClipPost,
  ScheduledPost,
  SocialAccount,
  SocialAccountsPage,
  TeamInvite,
  WorkspaceDetail,
  WorkspaceSummary,
  WorkspacesPage,
  UploadTarget,
  Video,
} from "./types"

/**
 * Client for the CLIPIT backend.
 *
 * Auth is an anonymous session token, sent as a bearer token on every call. A
 * 401 means the token expired or the backend lost it, so the client mints a
 * fresh one and retries once.
 *
 * It lives in `sessionStorage`, which means it dies with the browser tab. That
 * is deliberate while there are no accounts: a token in `localStorage` survives
 * closing the browser for thirty days, so the next person to open the app on a
 * shared or borrowed computer would resume the last person's session and see
 * their videos. Nothing to resume is the only guarantee available until there
 * is something to log into.
 *
 * The footage goes the same way — the backend removes it once a session stops
 * being used — so a closed tab leaves nothing behind on either side.
 *
 * When accounts arrive this changes: a signed-in person should come back to
 * their videos, because then there is a name on them and a password in front
 * of them.
 */

import { consumeSearchParams, readSearchParam } from "./search-params"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "")
const TOKEN_KEY = "clipit.session.token"
/** "guest" or "user" — which kind of session the stored token is. */
const TOKEN_KIND_KEY = "clipit.session.kind"
/**
 * The search parameter a sign-in link's return address carries a hand-over
 * in: a guest's single-use claim on its work, for the tab the link opens in
 * — which is almost never the tab that holds the guest token. Issued by
 * POST /api/sessions/handoff, spent by the exchange, then taken off the
 * address. See lib/sign-in-return.ts.
 */
export const HANDOFF_PARAM = "handoff"

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

/**
 * Throws away any token left in localStorage by a build before this one.
 *
 * The app not reading it is invisibility, not safety. That entry is a live
 * credential for its full thirty days, and anyone on the same computer can
 * lift it out of devtools and use it against the API directly — which is the
 * exact thing this change exists to prevent. It is deleted rather than moved
 * into sessionStorage: an old session should not be recoverable, and adopting
 * it would quietly hand the next person the last person's videos in a new
 * wrapper.
 */
let legacyDiscarded = false
function discardLegacyToken(): void {
  if (legacyDiscarded || typeof window === "undefined") return
  legacyDiscarded = true
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage can throw where it is blocked outright. Nothing here is worth
    // failing a request over, and a browser that refuses localStorage is not
    // holding an old token in it either.
  }
}

function readToken(): string | null {
  if (typeof window === "undefined") return null
  discardLegacyToken()
  return window.sessionStorage.getItem(TOKEN_KEY)
}

function readKind(): "guest" | "user" | null {
  if (typeof window === "undefined") return null
  const kind = window.sessionStorage.getItem(TOKEN_KIND_KEY)
  return kind === "user" || kind === "guest" ? kind : null
}

function writeToken(token: string, kind: "guest" | "user" = "guest"): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(TOKEN_KEY, token)
  window.sessionStorage.setItem(TOKEN_KIND_KEY, kind)
}

function clearToken(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(TOKEN_KEY)
  window.sessionStorage.removeItem(TOKEN_KIND_KEY)
}

/**
 * A response whose body is never going to be used still has to be drained.
 *
 * fetch resolves as soon as the headers arrive; the body stays queued on the
 * connection until somebody reads or cancels it. Walking away from a non-ok
 * response after checking only its status — which this file did in three
 * places — leaves that connection held open with an unread body on it. Nothing
 * visibly broke, but each one pinned one of the browser's six connections to
 * the site for as long as the browser cared to wait, and the page never
 * reached network-idle, which is also how it was caught.
 */
function discardBody(response: Response): void {
  void response.body?.cancel().catch(() => {
    // Failing to tidy a connection is not worth failing anything else over.
  })
}

/** How long a "yes, still signed in" answer is trusted before asking again. *
 *
 * Codex, P1 on this change: memoizing the promise for the whole page lifetime
 * meant a tab left open never asked twice. Sign out in another tab and this
 * one kept working indefinitely — sessionStorage is tab-local, so the other
 * tab's clearToken() cannot reach it, and the shared sign-in cookie being
 * gone went unnoticed.
 *
 * A minute bounds that window without making every request pay for it.
 */
const SESSION_RECHECK_MS = 60_000

/** How long an in-flight identity check is allowed to run before it is abandoned. */
const IDENTITY_TIMEOUT_MS = 10_000

/** How long minting a guest session is allowed to run before it is abandoned. */
const GUEST_SESSION_TIMEOUT_MS = 10_000

async function createSession(signal: AbortSignal): Promise<string> {
  const response = await fetch(`${API_BASE}/api/sessions`, { method: "POST", signal })
  if (!response.ok) {
    discardBody(response)
    throw new ApiError(response.status, "session_failed", "Could not start a session with the backend")
  }
  const body = (await response.json()) as { token: string }
  return body.token
}

/**
 * Asks this site's own server whether the browser is signed in, and if so,
 * trades that for an API token owned by the person rather than the tab.
 *
 * The proof of sign-in is an httpOnly cookie only the server can read, so the
 * question has to go through it. "No" is the everyday answer for guests, so it
 * is asked once per page load, not once per request — a failed exchange is
 * remembered until the next full load, which is exactly when sign-in state
 * can have changed (the magic link lands on a fresh page).
 *
 * The in-flight promise is shared by concurrent callers, but it carries its
 * own timeout so a hung identity check cannot block every later action. A
 * newer call can start a fresh exchange; the old one will not overwrite the
 * result if it completes late.
 */
type ExchangeState =
  | { kind: "idle" }
  | { kind: "inflight"; promise: Promise<string | null>; nonce: number; startedAt: number }
  | { kind: "settled"; result: string | null; at: number }

let exchangeState: ExchangeState = { kind: "idle" }
let exchangeNonce = 0

function exchangeSignedInToken(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null)

  const now = Date.now()
  if (exchangeState.kind === "settled" && now - exchangeState.at < SESSION_RECHECK_MS) {
    return Promise.resolve(exchangeState.result)
  }
  if (exchangeState.kind === "inflight" && now - exchangeState.startedAt < IDENTITY_TIMEOUT_MS) {
    return exchangeState.promise
  }

  const nonce = ++exchangeNonce
  const startedAt = now
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IDENTITY_TIMEOUT_MS)
  const promise = (async (): Promise<string | null> => {
    let shouldCache = false
    try {
      // Carry the guest token so the work done signed-out comes along. Read
      // BEFORE the exchange, because a successful exchange overwrites it.
      const guestToken = readKind() === "guest" ? readToken() : null
      // And the hand-over the sign-in link brought, if this is that return:
      // the same claim for the tab that has no token. Read from the address
      // on every attempt and taken off it only once the exchange succeeds,
      // so a failed attempt leaves it for the next.
      const handoff = readSearchParam(HANDOFF_PARAM)
      const response = await fetch("/api/backend-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(guestToken ? { guestToken } : {}), ...(handoff ? { handoff } : {}) }),
        signal: controller.signal,
      })
      if (!response.ok) {
        discardBody(response)
        // 401 is the server, holding the httpOnly cookie, saying plainly that
        // nobody is signed in. A stored "user" token is then stale and must
        // not be used — dropping it downgrades this tab to a guest, which is
        // what the person actually is.
        if (response.status === 401 && readKind() === "user") clearToken()
        // Only cache a definite 401; timeouts and transient errors should be
        // retried so a stuck identity check does not lock the tab for a minute.
        shouldCache = response.status === 401
        return null
      }
      const body = (await response.json()) as { token: string }
      if (nonce === exchangeNonce) {
        writeToken(body.token, "user")
      }
      // Spent, whichever way the API answered it: a hand-over is single-use
      // on the server, so leaving it on the address would only send a dead
      // one with every later exchange.
      if (handoff) consumeSearchParams([HANDOFF_PARAM])
      shouldCache = true
      return readToken()
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return null
      return null
    } finally {
      clearTimeout(timer)
      if (nonce === exchangeNonce) {
        if (shouldCache) {
          exchangeState = { kind: "settled", result: readToken(), at: Date.now() }
        } else {
          exchangeState = { kind: "idle" }
        }
      }
    }
  })()

  exchangeState = { kind: "inflight", promise, nonce, startedAt }
  return promise
}

type GuestSessionState =
  | { kind: "idle" }
  | { kind: "inflight"; promise: Promise<string>; nonce: number; startedAt: number }

let guestSessionState: GuestSessionState = { kind: "idle" }
let guestSessionNonce = 0

function mintGuestSession(): Promise<string> {
  const now = Date.now()
  if (guestSessionState.kind === "inflight" && now - guestSessionState.startedAt < GUEST_SESSION_TIMEOUT_MS) {
    return guestSessionState.promise
  }

  const nonce = ++guestSessionNonce
  const startedAt = now
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GUEST_SESSION_TIMEOUT_MS)
  const promise = createSession(controller.signal)
    .then((token) => {
      if (nonce === guestSessionNonce) {
        writeToken(token, "guest")
      }
      return token
    })
    .catch((e) => {
      if (e instanceof Error && e.name === "AbortError") {
        throw new ApiError(0, "session_timeout", "Could not start a session with the backend")
      }
      throw e
    })
    .finally(() => {
      clearTimeout(timer)
      if (nonce === guestSessionNonce) {
        guestSessionState = { kind: "idle" }
      }
    })

  guestSessionState = { kind: "inflight", promise, nonce, startedAt }
  return promise
}

async function ensureToken(): Promise<string> {
  const stored = readToken()
  // A stored signed-in token is CHECKED, not assumed. It used to be returned
  // unconditionally — "the strongest identity there is" — which quietly meant
  // it outlived the sign-in that produced it. The check costs one request per
  // page load (the same one guests already make) and the answer is memoized
  // for that load, because a fresh page is exactly when sign-in state can
  // have changed.
  if (stored && readKind() === "user") {
    const verified = await exchangeSignedInToken()
    // Verified, or the check itself could not run (offline, sign-in not
    // configured) — in which case the stored token stands rather than
    // signing someone out over a hiccup. A definite 401 already cleared it
    // above, so `readToken()` here reflects that.
    return verified ?? readToken() ?? (await mintGuestSession())
  }

  // A guest tab might have signed in since — the magic link lands on a fresh
  // page, and that page's first API call is where the upgrade happens.
  const upgraded = await exchangeSignedInToken()
  if (upgraded) return upgraded

  return stored ?? (await mintGuestSession())
}

/** Forgets the API session. The caller also ends the Better Auth one. */
export function forgetApiSession(): void {
  clearToken()
  exchangeState = { kind: "idle" }
  exchangeNonce++
  guestSessionState = { kind: "idle" }
  guestSessionNonce++
}

async function parseError(response: Response): Promise<ApiError> {
  let code = "request_failed"
  let message = `Request failed (${response.status})`
  try {
    const body = (await response.json()) as ApiErrorBody
    if (body?.error) {
      code = body.error.code ?? code
      message = body.error.message ?? message
    }
  } catch {
    // Non-JSON error body; keep the status-based message.
  }
  return new ApiError(response.status, code, message)
}

/**
 * Resolves with `promise` unless `signal` aborts first. The promise is NOT
 * cancelled: this lets a request timeout stop waiting while shared identity
 * work (the memoized exchange / guest session) keeps running for later callers.
 */
function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    let settled = false
    const onAbort = () => {
      settled = true
      reject(signal.reason)
    }
    signal.addEventListener("abort", onAbort, { once: true })
    promise.then(
      (value) => {
        if (!settled) {
          settled = true
          signal.removeEventListener("abort", onAbort)
          resolve(value)
        }
      },
      (error) => {
        if (!settled) {
          settled = true
          signal.removeEventListener("abort", onAbort)
          reject(error)
        }
      },
    )
  })
}

async function request<T>(path: string, init: RequestInit = {}, retryOn401 = true, timeoutMs = 0): Promise<T> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | null = null
  if (timeoutMs > 0) {
    timeout = setTimeout(() => controller.abort(), timeoutMs)
  }

  try {
    const token = await raceWithSignal(ensureToken(), controller.signal)

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status === 401 && retryOn401) {
      discardBody(response)
      // The stored token is no longer valid. Forget it AND the settled exchange:
      // a signed-in person's expired token must be replaced by asking the
      // sign-in cookie again, not by quietly minting a guest session — that
      // would leave the header saying who they are while their new uploads
      // belong to a tab-lifetime nobody.
      forgetApiSession()
      return request<T>(path, init, false, timeoutMs)
    }

    if (!response.ok) throw await parseError(response)
    return (await response.json()) as T
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}


/**
 * One PUT, by XHR — the only way to watch upload progress — resolving with
 * the response's ETag (a part-by-part upload's receipt; harmless otherwise).
 */
function putOnce(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url, true)
    for (const [header, value] of Object.entries(headers)) {
      xhr.setRequestHeader(header, value)
    }
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    })
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.getResponseHeader("ETag") ?? "")
      else reject(new ApiError(xhr.status, "upload_failed", `Upload failed (${xhr.status})`))
    })
    // Status 0 means the browser refused to send it, so there is no response
    // to report. Cross-origin PUTs to storage fail this way when the bucket
    // CORS is missing or stale.
    xhr.addEventListener("error", () =>
      reject(new ApiError(0, "upload_blocked", "The upload could not be sent. Check your connection and try again.")),
    )
    xhr.send(body)
  })
}

export const api = {
  isConfigured(): boolean {
    return API_BASE.length > 0
  },

  async createYoutubeVideo(url: string): Promise<{ video: Video }> {
    return request("/api/videos", {
      method: "POST",
      body: JSON.stringify({ sourceType: "youtube", url }),
    })
  },

  async createUpload(
    filename: string,
    contentType?: string,
    sizeBytes?: number,
  ): Promise<{ video: Video; upload: UploadTarget }> {
    return request("/api/videos", {
      method: "POST",
      body: JSON.stringify({
        sourceType: "upload",
        filename,
        ...(contentType ? { contentType } : {}),
        // Announced so the server can choose single-PUT or part-by-part; a
        // single presigned PUT cannot carry more than 5GB.
        ...(sizeBytes ? { sizeBytes } : {}),
      }),
    })
  },

  /** A fresh URL for one numbered slice, signed for exactly its byte length. */
  async createPartUploadUrl(
    videoId: string,
    uploadId: string,
    partNumber: number,
    contentLength: number,
  ): Promise<{ url: string }> {
    return request(`/api/videos/${videoId}/part-url`, {
      method: "POST",
      body: JSON.stringify({ uploadId, partNumber, contentLength }),
    })
  },

  /** Walk away cleanly: parts already in storage stop being stored and billed. */
  async abortMultipartUpload(videoId: string, uploadId: string): Promise<void> {
    await request(`/api/videos/${videoId}/abort-multipart`, {
      method: "POST",
      body: JSON.stringify({ uploadId }),
    })
  },

  /** Seals a part-by-part upload: storage stitches the slices into one file. */
  async completeMultipartUpload(
    videoId: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<void> {
    await request(`/api/videos/${videoId}/complete-multipart`, {
      method: "POST",
      body: JSON.stringify({ uploadId, parts }),
    })
  },

  /**
   * Sends the file straight to storage with the presigned URL, so the bytes
   * never pass through the API. XHR rather than fetch because it is the only
   * way to observe upload progress.
   */
  async uploadFile(
    videoId: string,
    target: UploadTarget,
    file: File,
    onProgress: (fraction: number) => void,
  ): Promise<{ multipart?: { uploadId: string; parts: Array<{ partNumber: number; etag: string }> } }> {
    // A big file goes in pieces. Each slice's URL is asked for FRESH just
    // before the slice is sent — presigning the whole set up front gave every
    // URL the same clock, and any upload slower than that expiry stranded
    // mid-file. The ETag storage answers with is the completion's receipt.
    if (target.multipart) {
      const { uploadId, partSizeBytes, partCount } = target.multipart
      const parts: Array<{ partNumber: number; etag: string }> = []
      try {
        for (let index = 0; index < partCount; index += 1) {
          const slice = file.slice(index * partSizeBytes, (index + 1) * partSizeBytes)
          const { url } = await api.createPartUploadUrl(videoId, uploadId, index + 1, slice.size)
          const etag = await putOnce(url, slice, {}, (fraction) =>
            // Whole-file progress: the slices already sent, plus this one's own.
            onProgress((index * partSizeBytes + fraction * slice.size) / file.size),
          )
          parts.push({ partNumber: index + 1, etag })
        }
      } catch (cause) {
        // Walk away cleanly: parts already in storage would otherwise sit
        // there, stored and billed, until the bucket's sweep found them.
        void api.abortMultipartUpload(videoId, uploadId).catch(() => {})
        throw cause
      }
      return { multipart: { uploadId, parts } }
    }
    if (!target.url) throw new ApiError(500, "bad_upload_target", "The upload target carries no URL.")
    await putOnce(target.url, file, target.headers, onProgress)
    return {}
  },

  async markUploaded(videoId: string): Promise<{ video: Video }> {
    return request(`/api/videos/${videoId}/uploaded`, { method: "POST" })
  },

  async getVideo(videoId: string): Promise<{ video: Video }> {
    return request(`/api/videos/${videoId}`)
  },

  /**
   * The caller's videos, newest first. Signed in, that spans every session
   * they have ever had — the thing signing in is for. Guests see only what
   * this tab uploaded, which is usually nothing.
   */
  async listVideos(): Promise<{ videos: Video[] }> {
    return request("/api/videos")
  },

  /**
   * Every question asked of a video and what came of it, oldest first — the
   * conversation, restored from the server rather than remembered by the
   * browser. Each request's clips come from getClipRequest.
   */
  async listClipRequests(videoId: string): Promise<{ clipRequests: ClipRequest[] }> {
    return request(`/api/videos/${encodeURIComponent(videoId)}/clip-requests`)
  },

  async createClipRequest(videoId: string, instruction: string): Promise<{ clipRequest: ClipRequest }> {
    return request(`/api/videos/${videoId}/clip-requests`, {
      method: "POST",
      body: JSON.stringify({ instruction }),
    })
  },

  async getClipRequest(requestId: string): Promise<{ clipRequest: ClipRequest; clips: Clip[] }> {
    return request(`/api/clip-requests/${requestId}`)
  },

  /**
   * Records a verdict on one match, or clears it with `null`. Returns the
   * updated match so the caller can reconcile rather than assume.
   */
  async rateMatch(
    requestId: string,
    matchId: string,
    verdict: MatchFeedback | null,
    reason?: MatchFeedbackReason | null,
  ): Promise<{ match: ClipMatch }> {
    return request(`/api/clip-requests/${requestId}/matches/${matchId}/feedback`, {
      method: "POST",
      // The reason travels only when someone gave one; the server ignores it
      // for anything but a rejection, so re-sending the same verdict with a
      // reason attached is a safe second tap, not a state change.
      body: JSON.stringify(reason ? { verdict, reason } : { verdict }),
    })
  },

  /**
   * Asks the system to re-evaluate this SAME moment and cut it better.
   * Answers immediately with the moment marked pending; the re-evaluation
   * runs in the background — poll getClipRequest until the pending state
   * clears, same rhythm as a cut.
   */
  async reclipMatch(requestId: string, matchId: string): Promise<{ match: ClipMatch }> {
    return request(`/api/clip-requests/${requestId}/matches/${matchId}/reclip`, {
      method: "POST",
      body: JSON.stringify({}),
    })
  },

  async generateClips(requestId: string, matchIds?: string[]): Promise<{ clips: Clip[] }> {
    return request(`/api/clip-requests/${requestId}/generate`, {
      method: "POST",
      body: JSON.stringify(matchIds?.length ? { matchIds } : {}),
    })
  },

  async getClip(clipId: string): Promise<{ clip: Clip }> {
    return request(`/api/clips/${clipId}`)
  },

  /** What the caller has done here: videos, minutes, questions, clips. */
  /**
   * The owner's evaluation numbers. Answers 404 for anyone not named in the
   * server's EVAL_OWNER_EMAILS — the page treats that as "not available",
   * not as an error to report.
   */
  async getEvaluation(filters: {
    from?: string
    to?: string
    provider?: string
    model?: string
    promptVersion?: string
    durationBucket?: string
    stage?: string
  }): Promise<EvaluationReport> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value)
    }
    const query = params.toString()
    const raw = await request<EvaluationReport & Record<string, unknown>>(
      `/api/evaluation${query ? `?${query}` : ""}`,
    )
    return normalizeEvaluationReport(raw)
  },

  async getStats(): Promise<{ stats: ActivityStats }> {
    return request("/api/stats")
  },

  /**
   * A page of the caller's finished clips, newest first. `nextBefore` is the
   * cursor for the page after it, or null when this is everything.
   */
  async listClips(
    before?: string,
    { timeoutMs = 10000 }: { timeoutMs?: number } = {},
  ): Promise<{ clips: LibraryClip[]; nextBefore: string | null }> {
    return request(`/api/clips${before ? `?before=${encodeURIComponent(before)}` : ""}`, {}, true, timeoutMs)
  },

  // --- Social publishing (Zernio) ------------------------------------------

  /** `timeoutMs` gives up a slow ask (the publish screens ask on a clock); 0 waits. */
  async listSocialAccounts(timeoutMs = 0): Promise<SocialAccountsPage> {
    return request("/api/social-accounts", {}, true, timeoutMs)
  },

  /** Returns the hosted-OAuth URL for the platform; the caller redirects to it. */
  async getConnectUrl(platform: string): Promise<{ platform: string; url: string }> {
    return request(`/api/connect/${encodeURIComponent(platform)}`)
  },

  async disconnectSocialAccount(accountId: string): Promise<{ account: SocialAccount }> {
    return request(`/api/social-accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" })
  },

  /**
   * The files a publish WOULD send, without sending them. Poll until every
   * entry is 'ready' — a shape that does not exist yet is rendered on the
   * first call.
   */
  async publishClip(
    clipId: string,
    input: { caption: string; accountIds?: string[]; scheduledAt?: string },
  ): Promise<{
    post?: { id: string; clipId: string; status: string }
    /** One entry per platform SHAPE — a clip going to TikTok and YouTube is
     *  two posts, each carrying its own correctly-cut file. */
    posts?: Array<{ id: string; status: string; aspect: string; targets: Array<{ platform: string }> }>
    /** Present instead of post/posts when scheduledAt was given: the promise
     *  record. Nothing goes out until its minute arrives. */
    scheduled?: ScheduledPost
  }> {
    return request(`/api/clips/${clipId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  },

  /**
   * A clip's recent posts, newest first — the truth behind the Publish
   * control once it is pressed. Ask until every post the publish made is
   * 'posted' or 'failed'; 'posting' is still on its way.
   */
  async listClipPosts(clipId: string, timeoutMs = 0): Promise<{ posts: ClipPost[] }> {
    return request(`/api/clips/${encodeURIComponent(clipId)}/posts`, {}, true, timeoutMs)
  },

  /**
   * A guest's single-use claim on its work, to ride in a sign-in link's
   * return address (lib/sign-in-return.ts). Bound to the address the link
   * goes to: only that sign-in can spend it. Null when there is nothing to
   * claim — no guest session in this tab, or signed in already — and null
   * when the API cannot be reached: a sign-in without it still works in
   * the tab that asked, which still holds the token itself.
   */
  async requestHandoff(email: string): Promise<string | null> {
    if (readKind() !== "guest" || !readToken()) return null
    try {
      const body = await request<{ handoff: string | null }>(
        "/api/sessions/handoff",
        { method: "POST", body: JSON.stringify({ email }) },
        true,
        8_000,
      )
      return typeof body.handoff === "string" && body.handoff !== "" ? body.handoff : null
    } catch {
      return null
    }
  },

  /**
   * Promised publishes: those still waiting, plus anything that fired or
   * failed recently. A failed promise that vanished would turn a missed
   * publication into a silent one.
   */
  async listScheduledPosts(): Promise<{ scheduled: Array<ScheduledPost & { clipTitle: string | null }> }> {
    return request("/api/scheduled-posts")
  },

  /** Take back a promise not yet kept. Conflict = it already fired. */
  async cancelScheduledPost(id: string): Promise<{ scheduled: ScheduledPost }> {
    return request(`/api/scheduled-posts/${encodeURIComponent(id)}`, { method: "DELETE" })
  },

  /** Give a clip a name of your own; an empty string brings the description back. */
  async renameClip(clipId: string, title: string): Promise<{ clip: LibraryClip }> {
    return request(`/api/clips/${encodeURIComponent(clipId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
  },

  /** Delete a clip and its files. Refused while a publish or schedule depends on it. */
  async deleteClip(clipId: string): Promise<{ deleted: boolean }> {
    return request(`/api/clips/${encodeURIComponent(clipId)}`, { method: "DELETE" })
  },

  /**
   * Burn captions into a clip. mode 'new' answers with the derived clip;
   * 'replace' answers with the same clip back in 'pending'. Either way the
   * render happens in the background — poll getClip until ready.
   */
  async captionClip(
    clipId: string,
    input: { mode: "new" | "replace"; captions: ClipCaption[] },
  ): Promise<{ clip: Clip }> {
    return request(`/api/clips/${clipId}/captions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  },

  // --- Workspaces -----------------------------------------------------------

  async listWorkspaces(): Promise<WorkspacesPage> {
    return request("/api/workspaces")
  },

  async createWorkspace(name: string): Promise<{ workspace: WorkspaceSummary }> {
    return request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  },

  async getWorkspace(workspaceId: string): Promise<WorkspaceDetail> {
    return request(`/api/workspaces/${encodeURIComponent(workspaceId)}`)
  },

  /** Send a clip to a room. It stays in the library too — a share, not a move. */
  async sendClipToWorkspace(workspaceId: string, clipId: string): Promise<{ shared: boolean }> {
    return request(`/api/workspaces/${encodeURIComponent(workspaceId)}/clips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipId }),
    })
  },

  async removeClipFromWorkspace(workspaceId: string, clipId: string): Promise<{ removed: boolean }> {
    return request(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/clips/${encodeURIComponent(clipId)}`,
      { method: "DELETE" },
    )
  },

  /** Where a clip can be sent (shared rooms only), and where it already is. */
  async getClipWorkspaces(
    clipId: string,
  ): Promise<{ signInRequired?: boolean; workspaces: Array<{ id: string; name: string }>; sharedWith: string[] }> {
    return request(`/api/clips/${encodeURIComponent(clipId)}/workspaces`)
  },

  /**
   * Invite someone. `emailed` is the truth about delivery — when it is false
   * the invitation still exists and `acceptUrl` still works, so the link can
   * be passed along by hand instead.
   */
  async inviteToWorkspace(
    workspaceId: string,
    email: string,
  ): Promise<{ invite: TeamInvite; emailed: boolean; emailProblem: string | null; acceptUrl: string }> {
    return request(`/api/workspaces/${encodeURIComponent(workspaceId)}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  },

  async revokeInvite(workspaceId: string, inviteId: string): Promise<{ inviteId: string; revoked: boolean }> {
    return request(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/invites/${encodeURIComponent(inviteId)}`,
      { method: "DELETE" },
    )
  },

  /** Reads an invitation without spending it, so the /join page can explain. */
  async previewInvite(token: string): Promise<InvitePreview> {
    return request(`/api/workspace/invites/preview?invite=${encodeURIComponent(token)}`)
  },

  async acceptInvite(
    token: string,
  ): Promise<{ joined: boolean; alreadyMember?: boolean; workspace: { id: string; name: string } | null }> {
    return request("/api/workspace/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite: token }),
    })
  },

  async removeWorkspaceMember(workspaceId: string, userId: string): Promise<{ removed: boolean }> {
    return request(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    )
  },

  /** Leave a room. Owners cannot leave their own. */
  async leaveWorkspace(workspaceId: string): Promise<{ left: boolean }> {
    return request(`/api/workspaces/${encodeURIComponent(workspaceId)}/members/me`, { method: "DELETE" })
  },
}


/**
 * Accepts the report in either schema. The backend renamed its fields to the
 * product's Keep/Skip language in the paired PR; until both deployments have
 * moved, an old-schema response must not render as NaN% — the legacy names
 * are mapped onto the new ones and everything else passes through.
 */
export function normalizeEvaluationReport(raw: EvaluationReport & Record<string, unknown>): EvaluationReport {
  const quality = raw.quality as unknown as Record<string, unknown>
  if (quality && quality.keepRate === undefined && quality.thumbsUpRate !== undefined) {
    raw.quality = {
      ...(raw.quality as object),
      keeps: quality.thumbsUp,
      skips: quality.thumbsDown,
      keepRate: quality.thumbsUpRate,
      skipRate: quality.thumbsDownRate,
    } as EvaluationReport["quality"]
  }
  const boundaries = raw.boundaries as unknown as Record<string, unknown>
  if (boundaries && boundaries.firstPassKeepRate === undefined && boundaries.firstPassSuccessRate !== undefined) {
    raw.boundaries = {
      ...(raw.boundaries as object),
      firstPassKeeps: boundaries.firstPassSuccesses,
      firstPassKeepRate: boundaries.firstPassSuccessRate,
      keptReclips: boundaries.acceptedReclips,
      reclipKeepRate: boundaries.reclipAcceptanceRate,
      timingIssues: boundaries.timingDownvotes,
      timingIssueRate: boundaries.timingDownvoteRate,
    } as EvaluationReport["boundaries"]
  }
  return raw
}
