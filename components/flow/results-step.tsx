"use client"

import { AnimatePresence, motion } from "motion/react"
import type { Clip, ClipMatch, ClipRequest } from "@/lib/types"
import { EASE, ProgressBar } from "./step-shell"

const SOURCE_LABEL: Record<ClipMatch["source"], string> = {
  visual: "on screen",
  transcript: "spoken",
  multimodal: "screen + spoken",
}

interface ResultsStepProps {
  clipRequest: ClipRequest
  clips: Clip[]
  selected: Set<string>
  onToggle: (matchId: string) => void
  onGenerate: () => void
  generating: boolean
}

/**
 * Search progress, the matches as they land, and the rendered clips.
 *
 * Matches stream in while the search is still running, so this renders both
 * states rather than waiting for completion.
 */
export function ResultsStep({
  clipRequest,
  clips,
  selected,
  onToggle,
  onGenerate,
  generating,
}: ResultsStepProps) {
  const searching = clipRequest.status === "searching" || clipRequest.status === "pending"
  const matches = clipRequest.matches ?? []
  const clipByMatch = new Map(clips.map((clip) => [clip.clipMatchId, clip]))

  return (
    <div className="space-y-6">
      {searching && (
        <div className="space-y-2">
          <ProgressBar percent={clipRequest.progress.percent} />
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-foreground/70">{clipRequest.progress.message}</p>
            <span className="text-xs tabular-nums text-foreground/40">
              {clipRequest.progress.chunksCompleted}/{clipRequest.progress.chunksTotal}
            </span>
          </div>
        </div>
      )}

      {clipRequest.status === "failed" && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {clipRequest.error ?? "The search failed."}
        </p>
      )}

      {!searching && matches.length === 0 && clipRequest.status === "completed" && (
        <p className="text-sm text-foreground/60">
          No moments matched that instruction. Try describing it differently.
        </p>
      )}

      {clipRequest.progress.chunksFailed > 0 && (
        <p className="text-xs text-amber-300/70">
          {clipRequest.progress.chunksFailed} of {clipRequest.progress.chunksTotal} segments could not be
          searched — results may be incomplete.
        </p>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {matches.map((match) => {
            const clip = clipByMatch.get(match.id)
            const isSelected = selected.has(match.id)

            return (
              <motion.li
                key={match.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className={`rounded-xl border px-4 py-3 transition-colors ${
                  isSelected ? "border-foreground/35 bg-white/[0.05]" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!clip && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(match.id)}
                      aria-label={`Select match at ${match.startTimecode}`}
                      className="mt-1 size-4 shrink-0 accent-white"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-sm tabular-nums text-foreground/90">
                        {match.startTimecode} – {match.endTimecode}
                      </span>
                      <span className="text-xs text-foreground/40">{Math.round(match.durationSeconds)}s</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground/40">
                        {SOURCE_LABEL[match.source]}
                      </span>
                      <span className="text-xs tabular-nums text-foreground/40">
                        {Math.round(match.confidence * 100)}%
                      </span>
                    </div>

                    {match.description && (
                      <p className="mt-1 text-sm text-foreground/65">{match.description}</p>
                    )}
                    {match.quote && (
                      <p className="mt-1 border-l border-white/15 pl-3 text-sm italic text-foreground/50">
                        “{match.quote}”
                      </p>
                    )}

                    {clip && <ClipPlayer clip={clip} />}
                  </div>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      {!searching && matches.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-foreground/40">
            {selected.size > 0 ? `${selected.size} selected` : "Select the moments you want as clips"}
          </p>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || selected.size === 0}
            className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-transform hover:scale-[1.03] disabled:opacity-40"
          >
            {generating ? "Generating…" : `Generate ${selected.size || ""} clip${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  )
}

function ClipPlayer({ clip }: { clip: Clip }) {
  if (clip.status === "failed") {
    return <p className="mt-3 text-xs text-red-300/80">{clip.error ?? "Clip generation failed."}</p>
  }

  if (clip.status !== "ready" || !clip.url) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-foreground/50">
        <span className="size-1.5 animate-pulse rounded-full bg-foreground/60" />
        {clip.status === "generating" ? "Cutting the clip…" : "Queued"}
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <video
        src={clip.url}
        controls
        preload="metadata"
        className="w-full max-w-lg rounded-lg border border-white/10 bg-black"
      />
      <a
        href={clip.url}
        download
        className="inline-block text-xs text-foreground/50 underline underline-offset-4 hover:text-foreground/80"
      >
        Download MP4
      </a>
    </div>
  )
}
