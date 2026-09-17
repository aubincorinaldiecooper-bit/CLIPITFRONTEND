"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { motion } from "motion/react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Button } from "@/components/space/button"
import { CoverflowCarousel, type CoverflowApi } from "@/components/space/coverflow-carousel"
import { Skeleton } from "@/components/space/skeleton"
import { MatchBadge } from "@/components/moments/match-badge"
import { PHONE, useMediaQuery } from "@/hooks/use-media-query"
import type { InternetMoment, InternetSearchFailureKind, InternetSearchOutcome } from "@/lib/types"
import { siteName } from "@/lib/video-embed"
import { cn } from "@/lib/utils"

export const MAX_SLOTS = 5
export type InternetSearchPhase = "loading" | "searching" | "answered" | "failed"

export interface InternetStageProps {
  query: string
  phase: InternetSearchPhase
  moments: InternetMoment[]
  /** Why the search ended. Absent while it is still running. */
  outcome?: InternetSearchOutcome
  /** What went wrong, when something did. */
  failure?: { kind: InternetSearchFailureKind; count: number }
  /** How many videos the search found to watch. */
  candidatesFound?: number
  /** How many of those it managed to watch. */
  candidatesWatched?: number
}

function matchPercent(moment: InternetMoment): number | null {
  if (moment.confidence === undefined) return null
  return Math.round(moment.confidence * 100)
}

function titleOf(moment: InternetMoment): string {
  return moment.title || moment.marks[0]?.description || "A video from this site"
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

/**
 * What we can say about why a watch did not happen, without repeating an
 * internal error to someone who cannot act on it.
 */
function becauseOf(failure: { kind: InternetSearchFailureKind } | undefined): string {
  switch (failure?.kind) {
    case "video_model_unavailable":
      return "The part of Clipit that watches video is unavailable."
    case "video_model_failed":
      return "The watching broke partway through."
    case "browser_unavailable":
      return "The videos would not open."
    case "timed_out":
      return "The watching ran out of time."
    default:
      return "Something on our side went wrong."
  }
}

/**
 * What the band says, once the search has stopped.
 *
 * The rule this exists to hold: an empty list only means "it is not there"
 * when the videos were actually watched. On 17 September a search found seven
 * videos, failed every watch against all seven because the watcher had no
 * method to call, and this line said "No results fit your search." Nobody had
 * opened a single video. That sentence was not true, and it is the one thing
 * this must never say again without the watching behind it.
 *
 * So the outcome decides the sentence, and the number of moments never does.
 */
function words(
  phase: InternetSearchPhase,
  found: number,
  shown: number,
  outcome?: InternetSearchOutcome,
  failure?: { kind: InternetSearchFailureKind; count: number },
  candidates = 0,
  watched?: number,
): string {
  if (phase === "loading") return "Searching the internet."
  if (phase === "searching") return "Watching what the search turned up."

  if (outcome === "watch_failed") {
    const videos = candidates > 0 ? `${candidates} ${plural(candidates, "video", "videos")}` : "the videos"
    return `${becauseOf(failure)} Clipit found ${videos} to watch and could not watch any of them, so this is not an answer about what is in them.`
  }

  if (outcome === "no_candidates") return "The search turned up no videos to watch."

  // Two different gaps, and they need different sentences. `missed` is videos
  // nobody opened at all. A partial search with `missed` at zero means every
  // video was opened and none was watched all the way through — the coarse
  // scan samples a second in every five — so saying videos "could not be
  // watched" there would be its own small lie.
  const missed = Math.max(0, candidates - (watched ?? candidates))
  const partial = outcome === "partly_watched"

  if (found === 0) {
    if (!partial) return "No results fit your search."
    return missed > 0
      ? `Nothing fit in what Clipit could watch. ${missed} ${plural(missed, "video", "videos")} could not be watched, so there may be more.`
      : "Nothing fit in what Clipit watched, and it did not watch every second — so there may be more."
  }

  const fit = `${found} ${plural(found, "video fits", "videos fit")} your search.`
  const strongest = found > shown ? `${fit} The strongest ${shown} are here.` : fit
  if (!partial) return strongest
  return missed > 0
    ? `${strongest} ${missed} ${plural(missed, "video", "videos")} could not be watched, so there may be more.`
    : `${strongest} It did not watch every second, so there may be more.`
}

type Slot = { kind: "moment"; key: string; moment: InternetMoment } | { kind: "pending"; key: string }

export function InternetStage({ query, phase, moments, outcome, failure, candidatesFound = 0, candidatesWatched }: InternetStageProps) {
  const compact = useMediaQuery(PHONE)
  const apiRef = useRef<CoverflowApi | null>(null)
  const found = useMemo(() => moments.slice(0, MAX_SLOTS), [moments])
  const slots = useMemo<Slot[]>(() => {
    if (phase === "loading") return []
    const taken: Slot[] = found.map((moment) => ({ kind: "moment", key: moment.id, moment }))
    if (phase !== "searching") return taken
    return [
      ...taken,
      ...Array.from({ length: Math.max(0, MAX_SLOTS - taken.length) }, (_, index) => ({ kind: "pending" as const, key: `pending@${taken.length + index}` })),
    ]
  }, [found, phase])

  const [activeKey, setActiveKey] = useState<string | null>(null)
  const slotsRef = useRef(slots)
  slotsRef.current = slots
  const onSelect = useCallback((index: number) => {
    const slot = slotsRef.current[index]
    if (slot) setActiveKey(slot.key)
  }, [])
  const onApi = useCallback((api: CoverflowApi) => {
    apiRef.current = api
  }, [])
  const activeIndex = activeKey ? slots.findIndex((slot) => slot.key === activeKey) : -1
  const active = activeIndex >= 0 ? slots[activeIndex] : slots[0]
  const activeMoment = active?.kind === "moment" ? active.moment : null

  useEffect(() => {
    if (activeIndex >= 0 || slots.length === 0) return
    setActiveKey(slots[0]!.key)
  }, [activeIndex, slots])

  const slides = useMemo(() => slots.map((slot) => ({ alt: slot.kind === "moment" ? titleOf(slot.moment) : "A moment still being looked for" })), [slots])
  const ended = phase === "answered" || phase === "failed"
  const line = words(phase, moments.length, found.length, outcome, failure, candidatesFound, candidatesWatched)

  return (
    <div className="w-full py-6" data-testid="internet-stage" data-phase={phase}>
      <div className="mx-auto w-full max-w-[900px] px-5 text-center sm:px-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[#8b9bad] uppercase">{phase === "answered" ? "Found for" : phase === "failed" ? "Searched for" : "Looking for"}</p>
        <h2 className="mx-auto mt-2 max-w-[720px] text-[clamp(22px,3vw,32px)] leading-tight font-medium tracking-[-0.025em] text-[#152337]" data-testid="internet-question">
          {query}
        </h2>
        <div className="mx-auto mt-3 max-w-[640px] text-sm leading-relaxed text-[#76889b]" aria-live="polite" data-testid="internet-words">
          {ended ? <p>{line}</p> : <TextShimmer as="p">{line}</TextShimmer>}
        </div>
      </div>

      {slots.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 w-full">
          <CoverflowCarousel
            slides={slides}
            onSelect={onSelect}
            onApi={onApi}
            loop={slots.length > 2}
            label="Moments found on the internet"
            cardWidth={compact ? "clamp(260px,78vw,360px)" : "clamp(360px,38vw,520px)"}
            cardHeight={compact ? "calc(clamp(260px,78vw,360px) * 3 / 4)" : "calc(clamp(360px,38vw,520px) * 3 / 4)"}
            rotate={compact ? 2 : 8}
            depth={compact ? 0.03 : 0.08}
            perspective={7}
            falloff={0.9}
            fade={0.12}
            gap={0.08}
            frameClassName={compact ? "py-5" : "py-8"}
            cardClassName="rounded-[26px] border border-[#dfe9f3] bg-white p-2.5 shadow-[0_18px_50px_rgba(71,111,153,0.10)]"
            renderSlide={(_slide, index, isActive) => {
              const slot = slots[index]!
              if (slot.kind === "pending") return <Skeleton aria-hidden className="size-full rounded-[19px] bg-[#edf4fa]" data-testid="moment-slot-pending" />
              const moment = slot.moment
              const percent = matchPercent(moment)
              return (
                <motion.div animate={{ y: isActive ? -2 : 0 }} className={cn("relative size-full overflow-hidden rounded-[19px] bg-neutral-950", isActive && "shadow-[0_20px_52px_rgba(27,50,73,0.18)]")} data-testid="moment-slot-filled">
                  {moment.still ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={moment.still} alt="" draggable={false} className="size-full object-cover" />
                  ) : (
                    <p className="flex size-full items-center justify-center px-5 text-center text-xs text-white/70"><span className="line-clamp-5">{titleOf(moment)}</span></p>
                  )}
                  {percent !== null && <MatchBadge value={percent} className="absolute top-3 left-3" />}
                </motion.div>
              )
            }}
          />

          <div className="mx-auto flex max-w-[620px] flex-col items-center px-6 text-center" data-testid="internet-caption">
            <div className="flex min-h-16 flex-col items-center justify-start">
              {activeMoment && (
                <motion.div key={activeMoment.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[48ch]">
                  <p className="line-clamp-2 text-[17px] leading-snug text-[#1d2b3d]" title={titleOf(activeMoment)}>{titleOf(activeMoment)}</p>
                  <p className="mt-2 truncate text-[13px] text-[#7e8fa2]">{siteName(activeMoment.pageUrl) ?? activeMoment.source ?? ""}</p>
                </motion.div>
              )}
            </div>
            <div className={cn("mt-4 flex items-center gap-3", slots.length < 2 && "invisible")}>
              <Button variant="outline" size="icon-sm" aria-label="Previous moment" onClick={() => apiRef.current?.prev()} className="rounded-full border-[#dfe8f1] bg-white"><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="icon-sm" aria-label="Next moment" onClick={() => apiRef.current?.next()} className="rounded-full border-[#dfe8f1] bg-white"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
