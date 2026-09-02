import type { ClipRequest, Clip } from "@/lib/types"
import type { Exchange } from "./types"

// Lives with the other address helpers now; re-exported so the page and its
// tests keep one import for everything a restore needs.
export { consumeSearchParams } from "@/lib/search-params"

/**
 * Reopening a video: its conversation comes back from the server, so the
 * review is where the person left it — after a sign-in that returned them
 * here, after a reload, after opening a video from their history.
 */

/** The conversation a video has had, oldest first, each answer with its clips. */
export async function restoreConversation(
  videoId: string,
  fetchers: {
    listClipRequests: (videoId: string) => Promise<{ clipRequests: ClipRequest[] }>
    getClipRequest: (requestId: string) => Promise<{ clipRequest: ClipRequest; clips: Clip[] }>
  },
  reconcile: (request: ClipRequest) => ClipRequest = (request) => request,
): Promise<Exchange[]> {
  const { clipRequests } = await fetchers.listClipRequests(videoId)
  return Promise.all(
    clipRequests.map(async (listed) => {
      const { clipRequest, clips } = await fetchers.getClipRequest(listed.id)
      return { request: reconcile(clipRequest), clips }
    }),
  )
}

/** Whether a restored conversation has moments to review — the feed, rather than the question box, is the place to land. */
export function hasReviewable(exchanges: Exchange[]): boolean {
  return exchanges.some((exchange) => exchange.request.status === "completed" && (exchange.request.matches?.length ?? 0) > 0)
}

/** The moment a clip belongs to, wherever it sits in the conversation. */
export function matchForClip(exchanges: Exchange[], clipId: string): { requestId: string; matchId: string } | null {
  for (const exchange of exchanges) {
    for (const match of exchange.request.matches ?? []) {
      if (match.clip?.id === clipId) return { requestId: exchange.request.id, matchId: match.id }
    }
  }
  return null
}
