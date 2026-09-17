"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Button } from "@/components/space/button"
import { CoverflowCarousel, type CoverflowApi } from "@/components/space/coverflow-carousel"
import { Skeleton } from "@/components/space/skeleton"
import { MatchBadge } from "@/components/moments/match-badge"
import { PHONE, useMediaQuery } from "@/hooks/use-media-query"
import type { InternetMoment, InternetSearchFailureKind, InternetSearchOutcome } from "@/lib/types"
import { siteName } from "@/lib/video-embed"
import { cn } from "@/lib/utils"

/** The most slots the band ever shows. A ceiling, not a quota. */
export const MAX_SLOTS = 5

export type InternetSearchPhase =
  | "loading"
  | "searching"
  | "answered"
  | "failed"

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

/**
 * How sure the watcher said it was, expressed as the percentage the badge
 * needs. Nothing means no badge; zero remains a real answer and shows as 0%.
 */
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

  const missed = Math.max(0, candidates - (watched ?? candidates))
  const partial = outcome === "partly_watched"

  if (found === 0) {
    if (!partial) return "No results fit your search."
    return missed > 0
      ? `Nothing fit in what Clipit could watch. ${missed} ${plural(missed, "video", "videos")} could not be watched, so there may be more.`
      : "Nothing fit in what Clipit could watch, but it did not get through all of it — so there may be more."
  }

  const fit = `${found} ${plural(found, "video fits", "videos fit")} your search.`
  const strongest = found > shown ? `${fit} The strongest ${shown} are here.` : fit
  if (!partial) return strongest
  return missed > 0
    ? `${strongest} ${missed} ${plural(missed, "video", "videos")} could not be watched, so there may be more.`
    : `${strongest} Clipit did not get through all of it, so there may be more.`
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
    const open = Math.max(0, MAX_SLOTS - taken.length)
    return [
      ...taken,
      ...Array.from({ length: open }, (_, index) => ({ kind: "pending" as const, key: `pending@${taken.length + index}` })),
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

  const lastIndex = useRef(activeIndex)
  useEffect(() => {
    if (activeIndex < 0) return
    if (activeIndex !== lastIndex.current) apiRef.current?.goTo(activeIndex)
    lastIndex.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    if (activeIndex >= 0 || slots.length === 0) return
    const at = Math.min(Math.max(0, lastIndex.current), slots.length - 1)
    setActiveKey(slots[at]!.key)
  }, [activeIndex, slots])

  const slides = useMemo(
    () => slots.map((slot) => ({ alt: slot.kind === "moment" ? titleOf(slot.moment) : "A moment still being looked for" })),
    [slots],
  )

  const measure = "mx-auto w-full max-w-[1100px] px-4 sm:px-10"
  const loading = phase === "loading"
  const ended = phase === "answered" || phase === "failed"
  const line = words(phase, moments.length, found.length, outcome, failure, candidatesFound, candidatesWatched)

  const heading = (
    <div className={measure}>
      <p className="pt-6 pb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase max-[860px]:pt-3">
        {phase === "answered" ? "Found for" : phase === "failed" ? "Searched for" : "Looking for"}
      </p>
      <h2
        className="max-w-[760px] text-[27px] leading-[1.35] font-medium tracking-[-0.01em] text-foreground max-[860px]:text-[19px] max-[860px]:leading-snug"
        data-testid="internet-question"
      >
        {query}
      </h2>

      <div className="pt-3 pb-2 text-sm text-muted-foreground" aria-live="polite" data-testid="internet-words">
        {ended ? <p className="max-w-[640px]">{line}</p> : <TextShimmer as="p">{line}</TextShimmer>}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex w-full flex-1 flex-col justify-center" data-testid="internet-stage" data-phase={phase}>
        <div data-testid="internet-loading">{heading}</div>
      </div>
    )
  }

  return (
    <div className="w-full" data-testid="internet-stage" data-phase={phase}>
      {heading}

      {slots.length > 0 && (
        <div className="w-full duration-300 animate-in fade-in">
          <CoverflowCarousel
            slides={slides}
            onSelect={onSelect}
            onApi={onApi}
            loop={slots.length > 2}
            label="Moments found on the internet"
            cardWidth={compact ? "clamp(190px, 60vw, 250px)" : "clamp(176px, 15vw, 236px)"}
            cardHeight={compact ? "calc(clamp(190px, 60vw, 250px) * 16 / 9)" : "calc(clamp(176px, 15vw, 236px) * 16 / 9)"}
            rotate={compact ? 5 : 26}
            depth={compact ? 0.05 : 0.2}
            perspective={compact ? 7 : 4.5}
            falloff={compact ? 1 : 0.75}
            fade={compact ? 0.18 : 0.07}
            gap={compact ? 0.06 : 0.1}
            frameClassName={compact ? "py-4" : "py-10"}
            cardClassName="rounded-[20px] border bg-shcard p-2.5 shadow-[0_2px_14px_rgba(0,0,0,0.06)]"
            renderSlide={(_slide, index, isActive) => {
              const slot = slots[index]!
              if (slot.kind === "pending") {
                return <Skeleton aria-hidden className="size-full rounded-[14px]" data-testid="moment-slot-pending" />
              }

              const moment = slot.moment
              const percent = matchPercent(moment)

              return (
                <div
                  className={cn(
                    "relative size-full overflow-hidden rounded-[14px] bg-neutral-950 transition-shadow duration-200",
                    isActive && "shadow-[0_18px_48px_rgba(0,0,0,0.18)]",
                  )}
                  data-testid="moment-slot-filled"
                >
                  {moment.still ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={moment.still} alt="" draggable={false} className="size-full object-cover" />
                  ) : (
                    <p className="flex size-full items-center justify-center px-4 text-center text-xs text-white/70">
                      <span className="line-clamp-6">{titleOf(moment)}</span>
                    </p>
                  )}

                  {percent !== null && (
                    <MatchBadge
                      value={percent}
                      className="absolute top-2.5 left-2.5"
                    />
                  )}
                </div>
              )
            }}
          />

          <div
            className="-mt-2 flex flex-col items-center px-6 text-center max-[860px]:mt-0"
            data-testid="internet-caption"
          >
            <div className="flex h-20 flex-col items-center justify-start" data-testid="internet-caption-room">
              {activeMoment && (
                <div key={activeMoment.id} className="w-full max-w-[44ch] duration-200 animate-in fade-in" data-testid="internet-caption-words">
                  <p className="line-clamp-2 text-[17px] leading-snug tracking-[-0.01em] text-foreground" title={titleOf(activeMoment)}>
                    {titleOf(activeMoment)}
                  </p>
                  <p className="mt-2 truncate text-[13px] text-muted-foreground">
                    {siteName(activeMoment.pageUrl) ?? activeMoment.source ?? ""}
                  </p>
                </div>
              )}
            </div>

            <div className={cn("mt-5 flex items-center gap-3", slots.length < 2 && "invisible")}>
              <Button variant="outline" size="icon-sm" aria-label="Previous moment" onClick={() => apiRef.current?.prev()} className="rounded-full">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Next moment" onClick={() => apiRef.current?.next()} className="rounded-full">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
