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
import type { InternetMoment } from "@/lib/types"
import { siteName } from "@/lib/video-embed"
import { cn } from "@/lib/utils"

export const MAX_SLOTS = 5
export type InternetSearchPhase = "loading" | "searching" | "answered"

export interface InternetStageProps {
  query: string
  phase: InternetSearchPhase
  moments: InternetMoment[]
}

function matchPercent(moment: InternetMoment): number | null {
  if (moment.confidence === undefined) return null
  return Math.round(moment.confidence * 100)
}

function titleOf(moment: InternetMoment): string {
  return moment.title || moment.marks[0]?.description || "A video from this site"
}

function words(phase: InternetSearchPhase, found: number, shown: number): string {
  if (phase === "loading") return "Searching the internet."
  if (phase === "searching") return "Watching what the search turned up."
  if (found === 0) return "No results fit your search."
  const fit = `${found} ${found === 1 ? "video fits" : "videos fit"} your search.`
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
  const line = words(phase, moments.length, found.length)

  return (
    <div className="w-full py-6" data-testid="internet-stage" data-phase={phase}>
      <div className="mx-auto w-full max-w-[900px] px-5 text-center sm:px-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[#8b9bad] uppercase">{phase === "answered" ? "Found for" : "Looking for"}</p>
        <h2 className="mx-auto mt-2 max-w-[720px] text-[clamp(22px,3vw,32px)] leading-tight font-medium tracking-[-0.025em] text-[#152337]" data-testid="internet-question">
          {query}
        </h2>
        <div className="mx-auto mt-3 max-w-[640px] text-sm leading-relaxed text-[#76889b]" aria-live="polite" data-testid="internet-words">
          {phase === "answered" ? <p>{line}</p> : <TextShimmer as="p">{line}</TextShimmer>}
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
