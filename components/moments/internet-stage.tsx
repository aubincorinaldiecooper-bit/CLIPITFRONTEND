"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Button } from "@/components/space/button"
import { CoverflowCarousel, type CoverflowApi } from "@/components/space/coverflow-carousel"
import { Skeleton } from "@/components/space/skeleton"
import { MatchBadge } from "@/components/moments/match-badge"
import { PHONE, useMediaQuery } from "@/hooks/use-media-query"
import type { InternetMoment } from "@/lib/types"
import { siteName } from "@/lib/video-embed"
import { cn } from "@/lib/utils"

/** The most slots the band ever shows. A ceiling, not a quota. */
export const MAX_SLOTS = 5

export type InternetSearchPhase =
  | "loading"
  | "searching"
  | "answered"

export interface InternetStageProps {
  query: string
  phase: InternetSearchPhase
  moments: InternetMoment[]
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

function words(phase: InternetSearchPhase, found: number, shown: number): string {
  if (phase === "loading") return "Searching the internet."
  if (phase === "searching") return "Watching what the search turned up."
  if (found === 0) return "No results fit your search."
  const fit = `${found} ${plural(found, "video fits", "videos fit")} your search.`
  return found > shown ? `${fit} The strongest ${shown} are here.` : fit
}

type Slot = { kind: "moment"; key: string; moment: InternetMoment } | { kind: "pending"; key: string }

export function InternetStage({ query, phase, moments }: InternetStageProps) {
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
  const line = words(phase, moments.length, found.length)

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
