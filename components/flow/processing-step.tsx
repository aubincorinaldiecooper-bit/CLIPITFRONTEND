"use client"

import type { Video } from "@/lib/types"
import { ProgressBar } from "./step-shell"

const TRANSCRIPT_LABEL: Record<Video["transcript"]["status"], string> = {
  pending: "Queued",
  queued: "Queued",
  running: "Transcribing…",
  ready: "Ready",
  failed: "Failed — search will use frames only",
  unavailable: "Not available — search will use frames only",
}

/**
 * Preprocessing status. The transcript is reported separately because the
 * video becomes searchable before the transcript finishes, and a spoken-word
 * search waits for it.
 */
export function ProcessingStep({ video }: { video: Video }) {
  const transcriptDone = video.transcript.status === "ready"
  const transcriptStuck = video.transcript.status === "failed" || video.transcript.status === "unavailable"

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <ProgressBar percent={video.progress.percent} />
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-foreground/70">{video.progress.message}</p>
          <span className="text-xs tabular-nums text-foreground/40">{video.progress.percent}%</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <Detail label="Source" value={video.sourceType === "youtube" ? "YouTube" : "Upload"} />
        {video.durationTimecode && <Detail label="Duration" value={video.durationTimecode} />}
        {video.width && video.height && <Detail label="Resolution" value={`${video.width}×${video.height}`} />}
        {video.chunkCount > 0 && <Detail label="Segments" value={String(video.chunkCount)} />}
        <Detail
          label="Transcript"
          value={TRANSCRIPT_LABEL[video.transcript.status]}
          muted={transcriptStuck}
          accent={transcriptDone}
        />
        {video.transcript.segmentCount > 0 && (
          <Detail label="Spoken lines" value={String(video.transcript.segmentCount)} />
        )}
      </dl>

      {video.status === "failed" && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {video.error ?? "Processing failed."}
        </p>
      )}
    </div>
  )
}

function Detail({
  label,
  value,
  muted,
  accent,
}: {
  label: string
  value: string
  muted?: boolean
  accent?: boolean
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-foreground/35">{label}</dt>
      <dd className={`mt-0.5 ${muted ? "text-foreground/40" : accent ? "text-emerald-300/80" : "text-foreground/80"}`}>
        {value}
      </dd>
    </div>
  )
}
