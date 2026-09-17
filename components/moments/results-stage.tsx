"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Play } from "lucide-react"
import { motion } from "motion/react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Badge } from "@/components/space/badge"
import { Button, buttonVariants } from "@/components/space/button"
import { CoverflowCarousel, type CoverflowApi } from "@/components/space/coverflow-carousel"
import { candidatesLine, progressLine } from "@/components/start/answer-words"
import { exchangeLines, isSearching } from "@/components/start/conversation"
import { evidenceWords, formatRange, momentTitle, type FeedMoment } from "@/components/start/moments"
import type { Exchange } from "@/components/start/types"
import { PHONE, useMediaQuery } from "@/hooks/use-media-query"
import type { Video } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MatchBadge } from "./match-badge"
import { MomentPlayer } from "./moment-player"

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
    <div className="mx-auto flex aspect-[4/3] w-[clamp(260px,42vw,520px)] flex-col items-center justify-center gap-3 rounded-[24px] border border-[#dfe9f3] bg-white p-6 text-center shadow-[0_18px_50px_rgba(71,111,153,0.09)]">
      <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-[#91d7ff]" />
      <p className="text-sm text-[#7b8da0]">Moments land here once they&apos;re found.</p>
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
  const slides = useMemo(() => moments.map((moment) => ({ alt: momentTitle(moment.match) })), [moments])

  return (
    <div className="w-full py-6" data-testid="results-stage">
      <div className="mx-auto w-full max-w-[900px] px-5 text-center sm:px-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[#8b9bad] uppercase">{searching ? "Looking for" : "Found for"}</p>
        <h2 className="mx-auto mt-2 max-w-[720px] text-[clamp(22px,3vw,32px)] leading-tight font-medium tracking-[-0.025em] text-[#152337]" data-testid="stage-question">
          {request.instruction}
        </h2>
        <div className="mx-auto mt-3 max-w-[640px] text-sm leading-relaxed text-[#76889b]" data-testid="stage-words">
          {searching ? (
            <>
              <TextShimmer as="p">{progressLine(request, video)}</TextShimmer>
              {candidates && <p className="mt-1">{candidates}</p>}
            </>
          ) : (
            lines.map((line, index) => <p key={`${request.id}-${index}`} className={index > 0 ? "mt-1" : undefined}>{line}</p>)
          )}
        </div>
      </div>

      {count > 0 ? (
        <div className="mt-3 w-full">
          <CoverflowCarousel
            key={request.id}
            slides={slides}
            initialIndex={initialIndex}
            onSelect={onSelect}
            onApi={onApi}
            loop={count > 2}
            label="Moments found"
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
              const entry = moments[index]!
              const match = Math.round(entry.match.confidence * 100)
              return (
                <motion.div
                  animate={{ y: isActive ? -2 : 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn("relative size-full overflow-hidden rounded-[19px] bg-neutral-950", isActive && "shadow-[0_20px_52px_rgba(27,50,73,0.18)]")}
                >
                  {isActive ? (
                    <MomentPlayer compact moment={entry} video={video} muted={muted} onMutedChange={onMutedChange} />
                  ) : entry.still ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.still} alt="" draggable={false} className="size-full object-cover" />
                  ) : (
                    <p className="flex size-full items-center justify-center px-5 text-center text-xs text-white/70">{momentTitle(entry.match)}</p>
                  )}
                  <MatchBadge value={match} className="absolute top-3 left-3" />
                  {!isActive && (
                    <>
                      <Badge variant="ghost" className="absolute right-3 bottom-3 h-auto bg-black/36 px-2.5 py-1 text-[11px] font-normal text-white/85 backdrop-blur-md hover:bg-black/36">
                        {formatRange(entry.match)}
                      </Badge>
                      <span className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur-sm">
                        <Play className="ml-0.5 size-4 fill-current" />
                      </span>
                    </>
                  )}
                </motion.div>
              )
            }}
          />

          {active && (
            <motion.div key={active.match.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-[620px] flex-col items-center px-6 text-center" data-testid="stage-caption">
              <p className="max-w-[48ch] text-[17px] leading-snug text-[#1d2b3d]">{momentTitle(active.match)}</p>
              <p className="mt-2 text-[13px] text-[#7e8fa2]"><span className="tabular-nums">{formatRange(active.match)}</span> · {evidenceWords(active.match)}</p>
              <div className="mt-5 flex items-center gap-3">
                <Button variant="outline" size="icon-sm" aria-label="Previous moment" onClick={() => apiRef.current?.prev()} className={cn("rounded-full border-[#dfe8f1] bg-white", count < 2 && "invisible")}><ChevronLeft className="size-4" /></Button>
                <a
                  href={momentHref(active)}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
                    event.preventDefault()
                    onOpen(active)
                  }}
                  className={cn(buttonVariants({ variant: "default", size: "default" }), "rounded-full border-0 bg-[linear-gradient(135deg,#d8f6ff_0%,#a9e3ff_48%,#bfcbff_100%)] px-5 text-[#102033] shadow-[0_10px_28px_rgba(100,190,255,0.24)]")}
                >
                  Ask about moment
                </a>
                <Button variant="outline" size="icon-sm" aria-label="Next moment" onClick={() => apiRef.current?.next()} className={cn("rounded-full border-[#dfe8f1] bg-white", count < 2 && "invisible")}><ChevronRight className="size-4" /></Button>
              </div>
            </motion.div>
          )}
        </div>
      ) : searching ? (
        <div className="py-10"><SearchingCard /></div>
      ) : null}
    </div>
  )
}
