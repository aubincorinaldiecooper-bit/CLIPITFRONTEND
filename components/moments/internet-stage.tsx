"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Badge } from "@/components/space/badge"
import { Button } from "@/components/space/button"
import { CoverflowCarousel, type CoverflowApi } from "@/components/space/coverflow-carousel"
import { Skeleton } from "@/components/space/skeleton"
import { formatRange } from "@/components/start/moments"
import { PHONE, useMediaQuery } from "@/hooks/use-media-query"
import type { InternetMoment } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * The results of a question asked of the internet — the same stage a
 * question about an uploaded video gets, standing in the same band.
 *
 * Three states, in this order (the owner, 2026-09-16):
 *
 *   loading    the question and nothing else, while the search runs. This
 *              comes first every time, whatever the search turns out to
 *              find — including nothing.
 *   searching  pages were found and are being watched, so the band appears:
 *              up to five slots, each a skeleton until a moment fills it.
 *              Every `moment.found` takes the next one.
 *   answered   the swarm finished. Slots nothing filled are taken away, and
 *              if nothing was found at all: "No results fit your search."
 *
 * Skeletons never come before there is something to watch. A skeleton is a
 * promise that a card is on its way, and before the search has found a page
 * there is nothing to promise. That is why loading is its own state rather
 * than five skeletons shown on spec.
 *
 * Five is the MOST slots the band shows, never a number of answers to reach.
 * Four moments are four cards, not four and a spare, and one is one.
 *
 * The pages the provider returned are not results and never appear here. A
 * page is somewhere to look; a moment is something that was looked at.
 */

/** The most slots the band ever shows. A ceiling, not a quota. */
export const MAX_SLOTS = 5

export type InternetSearchPhase =
  /** The search has been asked and has not come back. No band yet. */
  | "loading"
  /** Pages were found; the scouts are watching them. Slots appear. */
  | "searching"
  /** The swarm finished: `moments` is everything it found, which may be none. */
  | "answered"

export interface InternetStageProps {
  /** The question, as it was asked. */
  query: string
  phase: InternetSearchPhase
  /** Every moment the scouts have found so far, strongest first. */
  moments: InternetMoment[]
}

/** What a moment is called when the watcher gave it no words. */
function titleOf(moment: InternetMoment): string {
  return moment.description || "A moment from this page"
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

/** The sentence under the question: what is happening, or what came of it. */
function words(phase: InternetSearchPhase, found: number, shown: number): string {
  if (phase === "loading") return "Searching the internet."
  if (phase === "searching") return "Watching what the search turned up."
  // The scouts ran to the end. Zero is an answer, and one is an answer.
  if (found === 0) return "No results fit your search."
  const fit = `${found} ${plural(found, "moment fits", "moments fit")} your search.`
  // More were found than the band can hold. Saying only the five would
  // undercount what the search actually came back with.
  return found > shown ? `${fit} The strongest ${shown} are here.` : fit
}

type Slot = { kind: "moment"; key: string; moment: InternetMoment } | { kind: "pending"; key: string }

export function InternetStage({ query, phase, moments }: InternetStageProps) {
  const compact = useMediaQuery(PHONE)
  const apiRef = useRef<CoverflowApi | null>(null)
  const [selected, setSelected] = useState(0)

  const found = useMemo(() => moments.slice(0, MAX_SLOTS), [moments])

  /**
   * The band. Moments first, then — only while the scouts are still out —
   * skeletons for the slots still open. Once the swarm has finished there
   * are no skeletons at all: an empty slot at the end of a search is not a
   * moment still coming, it is a moment that never was.
   */
  const slots = useMemo<Slot[]>(() => {
    if (phase === "loading") return []
    const taken: Slot[] = found.map((moment) => ({ kind: "moment", key: moment.id, moment }))
    if (phase !== "searching") return taken
    const open = Math.max(0, MAX_SLOTS - taken.length)
    return [...taken, ...Array.from({ length: open }, (_, index) => ({ kind: "pending" as const, key: `pending-${index}` }))]
  }, [found, phase])

  const onSelect = useCallback((index: number) => setSelected(index), [])
  const onApi = useCallback((api: CoverflowApi) => {
    apiRef.current = api
  }, [])

  // The centre can be a slot that has gone — the skeletons left when the
  // swarm ended — so the caption reads the list, not the last index seen.
  const active = slots[selected] ?? slots[0]
  const activeMoment = active?.kind === "moment" ? active.moment : null

  const slides = useMemo(
    () => slots.map((slot) => ({ alt: slot.kind === "moment" ? titleOf(slot.moment) : "A moment still being looked for" })),
    [slots],
  )

  const measure = "mx-auto w-full max-w-[1100px] px-4 sm:px-10"
  const loading = phase === "loading"
  const line = words(phase, moments.length, found.length)

  /*
   * While the search is loading the question stands in the middle of the
   * screen, because it is the only thing on it. Once the band arrives the
   * same words sit above it, where the results stage keeps them.
   */
  const heading = (
    <div className={measure}>
      <p className="pt-6 pb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase max-[860px]:pt-3">
        {phase === "answered" ? "Found for" : "Looking for"}
      </p>
      <h2
        className="max-w-[760px] text-[27px] leading-[1.35] font-medium tracking-[-0.01em] text-foreground max-[860px]:text-[19px] max-[860px]:leading-snug"
        data-testid="internet-question"
      >
        {query}
      </h2>

      <div className="pt-3 pb-2 text-sm text-muted-foreground" aria-live="polite" data-testid="internet-words">
        {phase === "answered" ? <p className="max-w-[640px]">{line}</p> : <TextShimmer as="p">{line}</TextShimmer>}
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
                // A shape and nothing else. A skeleton that carried a title,
                // a time or a site would be telling you what it found before
                // anything had found it.
                return <Skeleton aria-hidden className="size-full rounded-[14px]" data-testid="moment-slot-pending" />
              }
              const moment = slot.moment
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
                    <p className="flex size-full items-center justify-center px-4 text-center text-xs text-white/70">{titleOf(moment)}</p>
                  )}
                  <Badge
                    variant="ghost"
                    className="absolute top-2.5 left-2.5 h-auto bg-black/32 px-2 py-1 text-[11px] font-normal text-white/85 backdrop-blur-md hover:bg-black/32 hover:text-white/85"
                  >
                    {formatRange(moment)}
                  </Badge>
                </div>
              )
            }}
          />

          {activeMoment && (
            <div
              key={activeMoment.id}
              className="-mt-2 flex flex-col items-center px-6 text-center duration-200 animate-in fade-in max-[860px]:mt-0"
              data-testid="internet-caption"
            >
              <p className="max-w-[44ch] text-[17px] leading-snug tracking-[-0.01em] text-foreground">{titleOf(activeMoment)}</p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                <span className="tabular-nums">{formatRange(activeMoment)}</span>
                {activeMoment.source ? ` · ${activeMoment.source}` : ""}
              </p>

              {slots.length > 1 && (
                <div className="mt-5 flex items-center gap-3">
                  <Button variant="outline" size="icon-sm" aria-label="Previous moment" onClick={() => apiRef.current?.prev()} className="rounded-full">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon-sm" aria-label="Next moment" onClick={() => apiRef.current?.next()} className="rounded-full">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
