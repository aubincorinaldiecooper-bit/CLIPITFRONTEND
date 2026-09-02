import type { Clip, ClipRequest } from "@/lib/types"

export type StartStep = "upload" | "watch" | "review"

/** One question and what it produced: the request as the server tells it, and the clips cut for it. */
export interface Exchange {
  request: ClipRequest
  clips: Clip[]
}
