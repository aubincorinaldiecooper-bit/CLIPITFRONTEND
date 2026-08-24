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

async function createSession(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/sessions`, { method: "POST" })
  if (!response.ok) {
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
function exchangeSignedInToken(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  // The in-flight PROMISE is memoized, not a boolean. A home screen fires two
  // requests at once; with a flag, the second saw "already asked" while the
  // first was still waiting, skipped the exchange, and minted a guest — so a
  // signed-in person's two dashboard calls ran as two different people, and
  // whichever token landed last became the tab. Sharing the promise means
  // every concurrent caller waits for the same answer.
  exchangePromise ??= (async () => {
    try {
      const response = await fetch("/api/backend-session", { method: "POST" })
      if (!response.ok) return null
      const body = (await response.json()) as { token: string }
      writeToken(body.token, "user")
      return body.token
    } catch {
      return null
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
  // A signed-in token is already the strongest identity there is; keep it.
  if (stored && readKind() === "user") return stored

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

  async createUpload(filename: string, contentType?: string): Promise<{ video: Video; upload: UploadTarget }> {
    return request("/api/videos", {
      method: "POST",
      body: JSON.stringify({ sourceType: "upload", filename, ...(contentType ? { contentType } : {}) }),
    })
  },

  /**
   * Sends the file straight to storage with the presigned URL, so the bytes
   * never pass through the API. XHR rather than fetch because it is the only
   * way to observe upload progress.
   */
  uploadFile(target: UploadTarget, file: File, onProgress: (fraction: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(target.method, target.url, true)

      for (const [header, value] of Object.entries(target.headers)) {
        xhr.setRequestHeader(header, value)
      }

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total)
      })

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new ApiError(xhr.status, "upload_failed", `Upload failed (${xhr.status})`))
      })
      // Status 0 means the browser refused to send it, so there is no response
      // to report. Cross-origin PUTs to storage fail this way when the bucket
      // has no CORS rule for this site — indistinguishable here from being
      // offline, but the console entry names which one it was.
      xhr.addEventListener("error", () =>
        reject(
          new ApiError(
            0,
            "upload_failed",
            "The upload was blocked before it left the browser. This usually means the storage bucket is missing a CORS rule for this site; check your connection and the browser console for the exact reason.",
          ),
        ),
      )
      xhr.addEventListener("abort", () => reject(new ApiError(0, "upload_aborted", "Upload cancelled")))

      xhr.send(file)
    })
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
  async previewPublish(
    clipId: string,
    input: { accountIds?: string[] } = {},
  ): Promise<{
    clipId: string
    previews: Array<{
      aspect: string
      targets: Array<{ platform: string; accountId: string }>
      status: "ready" | "preparing" | "failed"
      url: string | null
      width: number | null
      height: number | null
      error?: string
    }>
  }> {
    return request(`/api/clips/${clipId}/publish/preview`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

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
