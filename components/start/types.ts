import type { Clip, ClipRequest } from "@/lib/types"

/**
 * Two steps, not three: the first question opens the review screen at once,
 * where the dialogue says what the search is doing while the feed waits for
 * its moments. The waiting screen that sat between them is gone.
 */
export type StartStep = "upload" | "review"

/** One question and what it produced: the request as the server tells it, and the clips cut for it. */
export interface Exchange {
  request: ClipRequest
  clips: Clip[]
}
