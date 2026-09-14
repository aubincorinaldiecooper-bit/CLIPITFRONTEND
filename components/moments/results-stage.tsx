"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Play } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Badge } from "@/components/space/badge"
import { Button, buttonVariants } from "@/components/space/button"
import { CoverflowCarousel, type CoverflowApi } from "@/components/space/coverflow-carousel"
import { candidatesLine, progressLine } from "@/components/start/answer-words"
import { exchangeLines, isSearching } from "@/components/start/conversation"
import { evidenceWords, formatRange, momentTitle, type FeedMoment } from "@/components/start/moments"
import type { Exchange } from "@/components/start/types"
import { useMediaQuery } from "@/hooks/use-media-query"
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
 *
 * The words above the stage are the search's own, from the state the
 * server reports — while it runs, what it is doing; once it has answered,
 * the count it finished with, a stretch it could not look at, moments it
 * saw but was not sure of. A count is only ever what the server returned.
 */
export interface ResultsStageProps {
  /** The question on stage and what it produced. */
  exchange: Exchange
  video: Video | null
  /** The question's moments, strongest first. */
  moments: FeedMoment[]
  /** Whether this question was asked after another of this video. */
  followUp: boolean
  /** The moment to open on — the one that was on stage before, when coming back. */
  initialMomentId?: string | null
  /** The moment in the centre, whenever it changes. */
  onActiveChange?: (moment: FeedMoment | undefined) => void
  /** Where a moment's own page is, for the link. */
  momentHref: (moment: FeedMoment) => string
  /** Open the moment's page. */
  onOpen: (moment: FeedMoment) => void
  /** The other questions asked of this video, to put on stage instead. */
  others?: Array<{ id: string; instruction: string }>
  onPickOther?: (requestId: string) => void
  muted: boolean
  onMutedChange: (muted: boolean) => void
}

/** The card that stands where the first moment will: a search is running and nothing has been found yet. */
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
  const compact = useMediaQuery("(max-width: 860px)")
  const apiRef = useRef<CoverflowApi | null>(null)

  // Held as the MOMENT in the centre rather than a number: the list is
  // rebuilt on every poll, strongest first, and a number would point at
  // whatever landed in that place (Devin's and Codex's finding on #87).
  const initialIndex = Math.max(0, initialMomentId ? moments.findIndex((moment) => moment.match.id === initialMomentId) : 0)
  const [activeId, setActiveId] = useState<string | null>(moments[initialIndex]?.match.id ?? null)
  const activeIndex = activeId ? moments.findIndex((moment) => moment.match.id === activeId) : -1
  const active = activeIndex >= 0 ? moments[activeIndex] : moments[0]

  // Read through a ref, so the callback is the same function for the life
  // of the ring. The ring calls it when ITS index changes; a new function on
  // every poll made it call again with a stale index, and with the list
  // re-sorted underneath that named the wrong moment and the two chased
  // each other round the ring.
  const momentsRef = useRef(moments)
  momentsRef.current = moments
  const onSelect = useCallback((index: number) => {
    const moment = momentsRef.current[index]
    if (moment) setActiveId(moment.match.id)
  }, [])
  const onApi = useCallback((api: CoverflowApi) => {
    apiRef.current = api
  }, [])

  // The list re-sorted under the ring (a stronger moment landed above): keep
  // the same moment in the centre rather than whatever took its place.
  const lastIndex = useRef(activeIndex)
  useEffect(() => {
    if (activeIndex >= 0 && activeIndex !== lastIndex.current) apiRef.current?.goTo(activeIndex)
    lastIndex.current = activeIndex
  }, [activeIndex])

  // Moments that land while nothing was on stage bring the first one on.
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
  // Looping needs a ring; with one or two moments it would hide a neighbour.
  const loop = count > 2
  const slides = useMemo(() => moments.map((moment) => ({ alt: momentTitle(moment.match) })), [moments])

  return (
    <div className="mx-auto w-full max-w-[1100px]" data-testid="results-stage">
      <p className="pt-[30px] pb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{searching ? "Looking for" : "Found for"}</p>
      <h2 className="max-w-[760px] text-[27px] leading-[1.35] font-medium tracking-[-0.01em] text-foreground" data-testid="stage-question">
        {request.instruction}
      </h2>

      <div className="pt-3 pb-2 text-sm text-muted-foreground" data-testid="stage-words">
        {searching ? (
          <>
            <TextShimmer as="p">{progressLine(request, video)}</TextShimmer>
            {candidates && <p className="mt-1">{candidates}</p>}
          </>
        ) : (
          // The search's own words: the count it finished with, in a sentence,
          // then a stretch it could not look at, then the maybes. No separate
          // number — a count the sentence does not say is one it disagrees with.
          lines.map((line, index) => (
            <p key={`${request.id}-${index}`} className={cn("max-w-[640px]", index > 0 && "mt-1")}>
              {line}
            </p>
          ))
        )}
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
            cardWidth={compact ? "clamp(196px, 62vw, 260px)" : "clamp(150px, 18vw, 224px)"}
            cardHeight={compact ? "calc(clamp(196px, 62vw, 260px) * 16 / 9)" : "calc(clamp(150px, 18vw, 224px) * 16 / 9)"}
            rotate={compact ? 14 : 38}
            depth={compact ? 0.18 : 0.5}
            perspective={compact ? 5 : 3.4}
            fade={0.12}
            gap={compact ? 0.12 : 0.06}
            cardClassName="rounded-[20px] border bg-shcard p-2.5 shadow-[0_2px_14px_rgba(0,0,0,0.06)]"
            renderSlide={(_slide, index, isActive) => {
              const entry = moments[index]!
              return (
                <div
                  className={cn(
                    "relative size-full overflow-hidden rounded-[14px] bg-neutral-950 transition-shadow duration-200",
                    isActive && "shadow-[0_18px_48px_rgba(0,0,0,0.18)]",
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
                      <span className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm">
                        <Play className="ml-0.5 size-4 fill-current" />
                      </span>
                    </>
                  )}
                </div>
              )
            }}
          />

          {/* The caption follows the active moment: what happens, then when, then how it was found. */}
          {active && (
            <div key={active.match.id} className="-mt-2 flex flex-col items-center px-6 text-center duration-200 animate-in fade-in" data-testid="stage-caption">
              <p className="max-w-[44ch] text-[17px] leading-snug tracking-[-0.01em] text-foreground">{momentTitle(active.match)}</p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                <span className="tabular-nums">{formatRange(active.match)}</span> · {evidenceWords(active.match)}
              </p>

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

                {/* A link, because it is one: it has an address of its own,
                    and a modifier click opens it in a new tab. A plain click
                    stays on this page. */}
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
        <div className="mt-12 flex flex-wrap items-center gap-1.5" data-testid="stage-others">
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
