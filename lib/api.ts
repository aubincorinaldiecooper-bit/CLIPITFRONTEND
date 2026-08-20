import type { ApiErrorBody, Clip, ClipMatch, ClipRequest, MatchFeedback, UploadTarget, Video } from "./types"

/**
 * Client for the CLIPIT backend.
 *
 * Auth is an anonymous session token: minted once, kept in localStorage, and
 * sent as a bearer token on every call. A 401 means the token expired or the
 * backend lost it, so the client mints a fresh one and retries once.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "")
const TOKEN_KEY = "clipit.session.token"

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

function readToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

function writeToken(token: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TOKEN_KEY, token)
}

function clearToken(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
}

async function createSession(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/sessions`, { method: "POST" })
  if (!response.ok) {
    throw new ApiError(response.status, "session_failed", "Could not start a session with the backend")
  }
  const body = (await response.json()) as { token: string }
  writeToken(body.token)
  return body.token
}

async function ensureToken(): Promise<string> {
  return readToken() ?? (await createSession())
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
    // The stored token is no longer valid — mint a new one and try once more.
    clearToken()
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
}
