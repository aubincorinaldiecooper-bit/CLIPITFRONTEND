import type {
  ActivityStats,
  ApiErrorBody,
  Clip,
  ClipCaption,
  ClipMatch,
  ClipRequest,
  InvitePreview,
  LibraryClip,
  MatchFeedback,
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

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "")
const TOKEN_KEY = "clipit.session.token"
/** "guest" or "user" — which kind of session the stored token is. */
const TOKEN_KIND_KEY = "clipit.session.kind"

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

async function createSession(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/sessions`, { method: "POST" })
  if (!response.ok) {
    discardBody(response)
    throw new ApiError(response.status, "session_failed", "Could not start a session with the backend")
  }
  const body = (await response.json()) as { token: string }
  writeToken(body.token, "guest")
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
 */
let exchangePromise: Promise<string | null> | null = null
/**
 * Returns the signed-in token, or null — and on a definite "not signed in",
 * THROWS AWAY any signed-in token this browser still holds.
 *
 * That last part is the security half. A sign-in can end without anyone
 * pressing Sign out: the session expires, the cookie is cleared, it is
 * revoked from another device. When that happened, the header correctly said
 * "Sign in" while the stored bearer token kept working — the app looked
 * signed out and still acted as the person, which is how an account got
 * connected by someone the interface considered a guest.
 */
/**
 * How long a "yes, still signed in" answer is trusted before asking again.
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
let exchangeCheckedAt = 0

function exchangeSignedInToken(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  // A settled answer older than the window is stale: drop it so the next
  // caller asks again. An IN-FLIGHT promise is never discarded — concurrent
  // callers must still share one answer.
  if (exchangeCheckedAt && Date.now() - exchangeCheckedAt > SESSION_RECHECK_MS) {
    exchangePromise = null
  }
  // The in-flight PROMISE is memoized, not a boolean. A home screen fires two
  // requests at once; with a flag, the second saw "already asked" while the
  // first was still waiting, skipped the exchange, and minted a guest — so a
  // signed-in person's two dashboard calls ran as two different people, and
  // whichever token landed last became the tab. Sharing the promise means
  // every concurrent caller waits for the same answer.
  exchangePromise ??= (async () => {
    try {
      // Carry the guest token so the work done signed-out comes along. Read
      // BEFORE the exchange, because a successful exchange overwrites it.
      const guestToken = readKind() === "guest" ? readToken() : null
      const response = await fetch("/api/backend-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guestToken ? { guestToken } : {}),
      })
      if (!response.ok) {
        discardBody(response)
        // 401 is the server, holding the httpOnly cookie, saying plainly that
        // nobody is signed in. A stored "user" token is then stale and must
        // not be used — dropping it downgrades this tab to a guest, which is
        // what the person actually is.
        //
        // 503 (sign-in not configured) and network failures are NOT that
        // answer. Clearing on those would sign people out whenever the site
        // hiccupped, so the token is left alone.
        if (response.status === 401 && readKind() === "user") clearToken()
        return null
      }
      const body = (await response.json()) as { token: string }
      writeToken(body.token, "user")
      return body.token
    } catch {
      return null
    } finally {
      // Stamped on settle, not on start, so a slow answer is trusted for a
      // full window from when it actually arrived.
      exchangeCheckedAt = Date.now()
    }
  })()
  return exchangePromise
}

/**
 * The same dedup for minting a guest session: two concurrent first-requests
 * must become one session, not two sessions racing to own the tab.
 */
let guestPromise: Promise<string> | null = null
function mintGuestSession(): Promise<string> {
  guestPromise ??= createSession().finally(() => {
    // The token in sessionStorage is the durable record; the promise exists
    // only to collapse concurrent minting. A failure clears it so the next
    // attempt can try again.
    guestPromise = null
  })
  return guestPromise
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
  exchangePromise = null
  exchangeCheckedAt = 0
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

async function request<T>(path: string, init: RequestInit = {}, retryOn401 = true): Promise<T> {
  const token = await ensureToken()

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
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
    return request<T>(path, init, false)
  }

  if (!response.ok) throw await parseError(response)
  return (await response.json()) as T
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
  ): Promise<{ match: ClipMatch }> {
    return request(`/api/clip-requests/${requestId}/matches/${matchId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ verdict }),
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
  async getStats(): Promise<{ stats: ActivityStats }> {
    return request("/api/stats")
  },

  /**
   * A page of the caller's finished clips, newest first. `nextBefore` is the
   * cursor for the page after it, or null when this is everything.
   */
  async listClips(before?: string): Promise<{ clips: LibraryClip[]; nextBefore: string | null }> {
    return request(`/api/clips${before ? `?before=${encodeURIComponent(before)}` : ""}`)
  },

  // --- Social publishing (Zernio) ------------------------------------------

  async listSocialAccounts(): Promise<SocialAccountsPage> {
    return request("/api/social-accounts")
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
    input: { caption: string; accountIds?: string[] },
  ): Promise<{
    post: { id: string; clipId: string; status: string }
    /** One entry per platform SHAPE — a clip going to TikTok and YouTube is
     *  two posts, each carrying its own correctly-cut file. */
    posts?: Array<{ id: string; status: string; aspect: string; targets: Array<{ platform: string }> }>
  }> {
    return request(`/api/clips/${clipId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
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
