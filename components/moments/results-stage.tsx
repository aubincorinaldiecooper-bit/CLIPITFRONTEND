"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Badge } from "@/components/space/badge"
import { Button, buttonVariants } from "@/components/space/button"
import { CoverflowCarousel, type CoverflowApi } from "@/components/space/coverflow-carousel"
import { candidatesLine, progressLine } from "@/components/start/answer-words"
import { exchangeLines, isSearching } from "@/components/start/conversation"
import { formatRange, momentTitle, type FeedMoment } from "@/components/start/moments"
import type { Exchange } from "@/components/start/types"
import { PHONE, useMediaQuery } from "@/hooks/use-media-query"
import type { Video } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MomentPlayer } from "./moment-player"

/**
 * The results — the second screen of the owner's prototype (2026-09-14):
 * what was asked, what came of it, and the moments on a coverflow with one
 * in the centre playing.
 *
 * One canonical active moment: the coverflow reports its centred card, this
 * component holds it, and playback, the caption and "Open moment" all read
 * from it. Only the active card plays; neighbours are stills.
 */
export interface ResultsStageProps {
  exchange: Exchange
  video: Video | null
  moments: FeedMoment[]
  followUp: boolean
  initialMomentId?: string | null
  onActiveChange?: (moment: FeedMoment | undefined) => void
  momentHref: (moment: FeedMoment) => string
  onOpen: (moment: FeedMoment) => void
  others?: Array<{ id: string; instruction: string }>
  onPickOther?: (requestId: string) => void
  muted: boolean
  onMutedChange: (muted: boolean) => void
}

function SearchingCard() {
  return (
    <div
      className="mx-auto flex aspect-[9/16] w-[clamp(150px,18vw,224px)] flex-col items-center justify-center gap-3 rounded-[20px] border bg-shcard p-6 text-center shadow-[0_2px_14px_rgba(0,0,0,0.06)]"
      data-testid="stage-searching"
    >
      <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-foreground/60" />
      <p className="text-sm leading-relaxed text-muted-foreground">Moments land here once they&apos;re found.</p>
    </div>
  )
}

export function ResultsStage({
  exchange,
  video,
  moments,
  followUp,
  initialMomentId,
  onActiveChange,
  momentHref,
  onOpen,
  others = [],
  onPickOther,
  muted,
  onMutedChange,
}: ResultsStageProps) {
  const { request } = exchange
  const searching = isSearching(exchange)
  const compact = useMediaQuery(PHONE)
  const apiRef = useRef<CoverflowApi | null>(null)

  const initialIndex = Math.max(0, initialMomentId ? moments.findIndex((moment) => moment.match.id === initialMomentId) : 0)
  const [activeId, setActiveId] = useState<string | null>(moments[initialIndex]?.match.id ?? null)
  const activeIndex = activeId ? moments.findIndex((moment) => moment.match.id === activeId) : -1
  const active = activeIndex >= 0 ? moments[activeIndex] : moments[0]

  const momentsRef = useRef(moments)
  momentsRef.current = moments
  const onSelect = useCallback((index: number) => {
    const moment = momentsRef.current[index]
    if (moment) setActiveId(moment.match.id)
  }, [])
  const onApi = useCallback((api: CoverflowApi) => {
    apiRef.current = api
  }, [])

  const lastIndex = useRef(activeIndex)
  useEffect(() => {
    if (activeIndex >= 0 && activeIndex !== lastIndex.current) apiRef.current?.goTo(activeIndex)
    lastIndex.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    if (activeIndex < 0 && moments.length > 0) setActiveId(moments[0]!.match.id)
  }, [activeIndex, moments])

  useEffect(() => {
    onActiveChange?.(active)
    return () => onActiveChange?.(undefined)
  }, [active, onActiveChange])

  const lines = useMemo(() => exchangeLines(exchange, video?.index?.readThroughSeconds, followUp), [exchange, video, followUp])
  const candidates = searching ? candidatesLine(request) : null
  const count = moments.length
  const loop = count > 2
  const slides = useMemo(() => moments.map((moment) => ({ alt: momentTitle(moment.match) })), [moments])
  const measure = "mx-auto w-full max-w-[1100px] px-4 sm:px-10"

  return (
    <div className="w-full" data-testid="results-stage">
      <div className={measure}>
        <p className="pt-6 pb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase max-[860px]:pt-3">{searching ? "Looking for" : "Found for"}</p>
        <h2 className="max-w-[760px] text-[27px] leading-[1.35] font-medium tracking-[-0.01em] text-foreground max-[860px]:text-[19px] max-[860px]:leading-snug" data-testid="stage-question">
          {request.instruction}
        </h2>

        <div className="pt-3 pb-2 text-sm text-muted-foreground" data-testid="stage-words">
          {searching ? (
            <>
              <TextShimmer as="p">{progressLine(request, video)}</TextShimmer>
              {candidates && <p className="mt-1">{candidates}</p>}
            </>
          ) : (
            lines.map((line, index) => (
              <p key={`${request.id}-${index}`} className={cn("max-w-[640px]", index > 0 && "mt-1")}>
                {line}
              </p>
            ))
          )}
        </div>
      </div>

      {count > 0 ? (
        <div className="w-full">
          <CoverflowCarousel
            key={request.id}
            slides={slides}
            initialIndex={initialIndex}
            onSelect={onSelect}
            onApi={onApi}
            loop={loop}
            label="Moments found"
            cardWidth={compact ? "clamp(176px, 56vw, 232px)" : "clamp(176px, 15vw, 236px)"}
            cardHeight={compact ? "calc(clamp(176px, 56vw, 232px) * 16 / 9)" : "calc(clamp(176px, 15vw, 236px) * 16 / 9)"}
            rotate={compact ? 4 : 26}
            depth={compact ? 0.04 : 0.2}
            perspective={compact ? 7 : 4.5}
            falloff={compact ? 1 : 0.75}
            fade={compact ? 0.16 : 0.07}
            gap={compact ? 0.05 : 0.1}
            frameClassName={compact ? "py-3" : "py-10"}
            cardClassName="rounded-[18px] border bg-shcard p-2 shadow-[0_2px_12px_rgba(0,0,0,0.055)]"
            renderSlide={(_slide, index, isActive) => {
              const entry = moments[index]!
              return (
                <div
                  className={cn(
                    "relative size-full overflow-hidden rounded-[13px] bg-neutral-950 transition-shadow duration-200",
                    isActive && "shadow-[0_16px_42px_rgba(0,0,0,0.16)]",
                  )}
                >
                  {isActive ? (
                    <MomentPlayer compact moment={entry} video={video} muted={muted} onMutedChange={onMutedChange} />
                  ) : (
                    <>
                      {entry.still ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.still} alt="" draggable={false} className="size-full object-cover" />
                      ) : (
                        <p className="flex size-full items-center justify-center px-4 text-center text-xs text-white/70">{momentTitle(entry.match)}</p>
                      )}
                      <Badge variant="ghost" className="absolute top-2.5 left-2.5 h-auto bg-black/32 px-2 py-1 text-[11px] font-normal text-white/85 backdrop-blur-md hover:bg-black/32 hover:text-white/85">
                        {formatRange(entry.match)}
                      </Badge>
                    </>
                  )}
                </div>
              )
            }}
          />

          {active && (
            <div key={active.match.id} className="-mt-2 flex flex-col items-center px-6 text-center duration-200 animate-in fade-in max-[860px]:mt-0" data-testid="stage-caption">
              <p className="max-w-[44ch] text-[17px] leading-snug tracking-[-0.01em] text-foreground">{momentTitle(active.match)}</p>
              <p className="mt-2 text-[13px] tabular-nums text-muted-foreground">{formatRange(active.match)}</p>

              <div className="mt-5 flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous moment"
                  onClick={() => apiRef.current?.prev()}
                  className={cn("rounded-full", count < 2 && "invisible")}
                >
                  <ChevronLeft className="size-4" />
                </Button>

                <a
                  href={momentHref(active)}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
                    event.preventDefault()
                    onOpen(active)
                  }}
                  className={cn(buttonVariants({ variant: "default", size: "default" }), "rounded-full px-5")}
                >
                  Open moment
                </a>

                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next moment"
                  onClick={() => apiRef.current?.next()}
                  className={cn("rounded-full", count < 2 && "invisible")}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : searching ? (
        <div className="py-10">
          <SearchingCard />
        </div>
      ) : null}

      {others.length > 0 && (
        <div className={cn(measure, "mt-12 flex flex-wrap items-center gap-1.5")} data-testid="stage-others">
          <span className="mr-1 text-xs text-muted-foreground">Also asked of this video:</span>
          {others.map((other) => (
            <Button
              key={other.id}
              variant="ghost"
              size="xs"
              onClick={() => onPickOther?.(other.id)}
              className="max-w-[36ch] rounded-full bg-foreground/[0.035] font-normal text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground/80"
            >
              <span className="truncate">{other.instruction}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
