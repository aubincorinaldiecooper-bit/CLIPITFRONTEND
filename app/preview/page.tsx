"use client"
/* Temporary screenshot harness — deleted after capture. */
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import type { Clip, Video } from "@/lib/types"
import { DeckStage } from "@/components/theater/deck-stage"
import { WhenTo, WhereTo } from "@/components/theater/publish-flow"
import { KeptGrid } from "@/components/theater/review-deck"

;(api as Record<string, unknown>).listSocialAccounts = async () => ({
  configured: true, signInRequired: false,
  accounts: [
    { id: "a1", platform: "tiktok", displayName: "nightshoots", status: "connected" },
    { id: "a2", platform: "instagram", displayName: "nightshoots", status: "connected" },
  ],
})

const g = (from: string, to: string, w = 800, h = 450) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><linearGradient id='a' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='${w}' height='${h}' fill='url(#a)'/></svg>`)}`

const baseVideo = { id: "v1", title: "night-shoot.mp4", originalFilename: "night-shoot.mp4", status: "ready", error: null, readyForSearch: true, playback: null, index: { status: "ready", readThroughSeconds: null } } as unknown as Video

const m = (id: string, c: number, d: string, cols: [string, string]) => ({
  id, startSeconds: 62, endSeconds: 86, startTimecode: "1:02", endTimecode: "1:26", durationSeconds: 24,
  description: d, confidence: c, source: "visual", quote: null, thumbnailUrl: g(cols[0], cols[1], 600, 800),
  feedback: null, feedbackReason: null, reclipStatus: null, reclipError: null, reclipCount: 0, reclipsRemaining: 2, clip: null,
})

const deckExchange = {
  request: { id: "r1", videoId: "v1", instruction: "find the car reveal", mode: "auto", resolvedMode: "visual", status: "completed",
    matches: [ m("m1", .91, "Drone over the harbour at night", ["#2b3f63", "#e07020"]), m("m2", .8, "Crowd reacts", ["#1a1a22", "#4a4a55"]), m("m3", .72, "Green car pulls away", ["#0d4d2e", "#67c23a"]), m("m4", .6, "Gas station", ["#151528", "#c9a227"]) ],
    coverage: { complete: true, unsearchedSeconds: 0, gaps: [], degraded: [] }, uncertain: [], answeredFrom: "notes" },
  clips: [] as Clip[],
} as never

const noop = () => undefined

function P() {
  const s = useSearchParams().get("s") ?? "deck"
  const shell = { busy: false, onSearch: noop, onSeek: noop, onKeep: noop, onRate: noop, onReclip: noop, onUploadMore: noop, uploadFraction: null }
  if (s === "deck") return <DeckStage video={baseVideo} exchanges={[deckExchange]} {...shell} />
  if (s === "kept")
    return (
      <KeptGrid
        clips={[
          { id: "c1", title: "Drone over the harbour at night", videoTitle: "night-shoot.mp4", duration: "0:24", url: "x", poster: g("#2b3f63", "#e07020"), status: "ready", error: null },
          { id: "c2", title: "Green car pulls away from the lot", videoTitle: "night-shoot.mp4", duration: "0:19", url: "x", poster: g("#0d4d2e", "#67c23a"), status: "ready", error: null },
          { id: "c3", title: "Gas station at night", videoTitle: "night-shoot.mp4", duration: null, url: null, poster: g("#151528", "#c9a227"), status: "cutting", error: null },
        ]}
        onReview={noop} onPublish={noop} onRename={noop} onDelete={noop}
      />
    )
  if (s === "where")
    return <div className="mx-auto w-full max-w-[34rem]"><WhereTo clips={[{ id: "c1", title: "A", ready: true }, { id: "c2", title: "B", ready: true }]} busy={false} onBack={noop} onPostNow={noop} onSchedule={noop} /></div>
  if (s === "when")
    return <div className="mx-auto w-full max-w-[34rem]"><WhenTo busy={false} error={null} clipCount={2} onBack={noop} onCommit={noop} /></div>
  return null
}

export default function PreviewPage() {
  return <main className="shadcn-scope min-h-dvh bg-background px-6 py-10 font-sans text-foreground"><Suspense><P /></Suspense></main>
}
