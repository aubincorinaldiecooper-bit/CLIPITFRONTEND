"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Clock3, Library, Plus, Search, Users } from "lucide-react"
import { motion } from "motion/react"
import { Logo } from "@/components/brand/logo"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Button, buttonVariants } from "@/components/space/button"
import { Skeleton } from "@/components/space/skeleton"
import { candidatesLine, progressLine } from "@/components/start/answer-words"
import { exchangeLines, isSearching } from "@/components/start/conversation"
import { evidenceWords, formatRange, momentTitle, type FeedMoment } from "@/components/start/moments"
import type { Exchange } from "@/components/start/types"
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
  composer?: ReactNode
}

function SearchingStack() {
  return (
    <div className="space-y-4 px-5 py-5" data-testid="stage-searching">
      {[0, 1, 2].map((index) => (
        <Skeleton
          key={index}
          className="h-[clamp(170px,22vh,230px)] w-full rounded-[18px] bg-[#f5f6f7]"
        />
      ))}
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
  composer,
}: ResultsStageProps) {
  const { request } = exchange
  const searching = isSearching(exchange)
  const initialIndex = Math.max(
    0,
    initialMomentId ? moments.findIndex((moment) => moment.match.id === initialMomentId) : 0,
  )
  const [activeId, setActiveId] = useState<string | null>(moments[initialIndex]?.match.id ?? null)
  const activeIndex = activeId ? moments.findIndex((moment) => moment.match.id === activeId) : -1
  const active = activeIndex >= 0 ? moments[activeIndex] : moments[0]

  useEffect(() => {
    if (activeIndex < 0 && moments.length > 0) setActiveId(moments[0]!.match.id)
  }, [activeIndex, moments])

  useEffect(() => {
    onActiveChange?.(active)
    return () => onActiveChange?.(undefined)
  }, [active, onActiveChange])

  const lines = useMemo(
    () => exchangeLines(exchange, video?.index?.readThroughSeconds, followUp),
    [exchange, video, followUp],
  )
  const candidates = searching ? candidatesLine(request) : null

  return (
    <div
      className="grid min-h-dvh w-full bg-white text-[#17191d] lg:grid-cols-[270px_minmax(0,1fr)_390px]"
      data-testid="results-stage"
    >
            {/* Both side columns stay put while the middle scrolls, which is what
          "fixed rail" and "fixed chat panel" mean and what they were not.
          Without this they are ordinary grid cells: they stretch to the
          height of the results column, and because the chat centres itself
          inside that column, five results put it about 1100px down the page.
          The panel existed and nobody could see it. */}
      <aside className="hidden border-r border-[#e5e7eb] bg-[#fbfbfb] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex h-16 items-center border-b border-[#e5e7eb] px-5">
          <a href="/start" aria-label="Clipit home" className="inline-flex items-center">
            <Logo size={18} />
          </a>
        </div>

        <nav className="flex-1 px-4 py-5">
          <a
            href="/start"
            className={cn(
              buttonVariants({ variant: "ghost", size: "default" }),
              "w-full justify-start gap-2 rounded-lg px-2.5 font-normal text-[#262b31] hover:bg-[#f0f1f2]",
            )}
          >
            <Plus className="size-4" />
            New search
          </a>
          <a
            href="/clips"
            className={cn(
              buttonVariants({ variant: "ghost", size: "default" }),
              "mt-1 w-full justify-start gap-2 rounded-lg px-2.5 font-normal text-[#4b525b] hover:bg-[#f0f1f2]",
            )}
          >
            <Library className="size-4" />
            Library
          </a>
          <a
            href="/shared"
            className={cn(
              buttonVariants({ variant: "ghost", size: "default" }),
              "mt-1 w-full justify-start gap-2 rounded-lg px-2.5 font-normal text-[#4b525b] hover:bg-[#f0f1f2]",
            )}
          >
            <Users className="size-4" />
            Shared
          </a>

          {others.length > 0 && (
            <div className="mt-8">
              <p className="px-2.5 text-xs font-medium text-[#747b84]">Recent</p>
              <div className="mt-2 space-y-1">
                {others.slice(0, 6).map((other) => (
                  <Button
                    key={other.id}
                    variant="ghost"
                    onClick={() => onPickOther?.(other.id)}
                    className="h-auto w-full justify-start gap-2 rounded-lg px-2.5 py-2 text-left font-normal text-[#4b525b] hover:bg-[#f0f1f2]"
                  >
                    <Clock3 className="size-3.5 shrink-0" />
                    <span className="truncate">{other.instruction}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>

      <section className="min-w-0 border-r border-[#e5e7eb]">
        <header className="flex h-16 items-center justify-between border-b border-[#e5e7eb] px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Search className="size-4 shrink-0 text-[#4b525b]" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1d2127]">Results</p>
              <p className="truncate text-xs text-[#7a818b]">{request.instruction}</p>
            </div>
          </div>
          <a
            href="/start"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "rounded-lg border-[#dfe2e6] bg-white font-medium text-[#262b31]",
            )}
          >
            New search
          </a>
        </header>

        {moments.length > 0 ? (
          <div className="space-y-4 px-5 py-5">
            {moments.map((entry) => {
              const selected = active?.match.id === entry.match.id
              const match = Math.round(entry.match.confidence * 100)
              return (
                <motion.article
                  key={entry.match.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "overflow-hidden rounded-[18px] border bg-[#f7f8f9] transition-colors",
                    selected ? "border-[#cfd3d8]" : "border-[#e6e8eb] hover:border-[#d7dade]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(entry.match.id)}
                    className="block w-full text-left"
                    aria-label={`Select ${momentTitle(entry.match)}`}
                  >
                    <div className="relative aspect-[16/7] min-h-[170px] w-full overflow-hidden bg-[#f1f2f3]">
                      {selected ? (
                        <MomentPlayer
                          compact
                          moment={entry}
                          video={video}
                          muted={muted}
                          onMutedChange={onMutedChange}
                        />
                      ) : entry.still ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.still} alt="" draggable={false} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center px-8 text-center text-sm text-[#707780]">
                          {momentTitle(entry.match)}
                        </div>
                      )}
                      <MatchBadge value={match} className="absolute top-3 left-3" />
                    </div>
                  </button>

                  <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#20242a]">{momentTitle(entry.match)}</p>
                      <p className="mt-1 text-xs text-[#7a818b]">
                        {formatRange(entry.match)} · {evidenceWords(entry.match)}
                      </p>
                    </div>
                    <a
                      href={momentHref(entry)}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
                        event.preventDefault()
                        onOpen(entry)
                      }}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "shrink-0 rounded-lg border-[#dfe2e6] bg-white text-[#2b3037]",
                      )}
                    >
                      Open moment
                    </a>
                  </div>
                </motion.article>
              )
            })}
          </div>
        ) : searching ? (
          <SearchingStack />
        ) : (
          <div className="flex min-h-[420px] items-center justify-center px-8 text-center">
            <p className="max-w-md text-sm leading-relaxed text-[#707780]">
              {lines[0] ?? "No moments to show."}
            </p>
          </div>
        )}
      </section>

      <aside className="flex min-h-[540px] flex-col bg-white lg:sticky lg:top-0 lg:h-dvh">
        <header className="flex h-16 items-center border-b border-[#e5e7eb] px-5">
          <p className="text-sm font-semibold text-[#1d2127]">Search chat</p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {/* Scrolls, and starts at the top. It did neither: the content was
              centred in a box with no overflow, so this is the screen where a
              model actually writes prose and the prose could not be reached
              once it ran past the panel. The internet panel already had the
              scroll; this one was missed. */}
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-7 py-8 text-center">
            <div className="flex size-11 items-center justify-center rounded-full border border-[#e0e3e7] bg-[#f7f8f9]">
              <Search className="size-4 text-[#343a42]" />
            </div>
            <p className="mt-5 max-w-[28ch] text-[17px] font-semibold leading-snug text-[#1d2127]" data-testid="stage-question">
              {request.instruction}
            </p>
            <div className="mt-3 max-w-[32ch] text-sm leading-relaxed text-[#68707a]" data-testid="stage-words">
              {searching ? (
                <>
                  <TextShimmer as="p">{progressLine(request, video)}</TextShimmer>
                  {candidates && <p className="mt-1">{candidates}</p>}
                </>
              ) : (
                lines.map((line, index) => (
                  <p key={`${request.id}-${index}`} className={index > 0 ? "mt-1" : undefined}>
                    {line}
                  </p>
                ))
              )}
            </div>

            {active && (
              <motion.div
                key={active.match.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-7 w-full max-w-[310px] rounded-xl border border-[#e4e7ea] bg-[#fafafa] px-4 py-3 text-left"
                data-testid="stage-caption"
              >
                <p className="line-clamp-2 text-sm font-medium text-[#2a2f36]">{momentTitle(active.match)}</p>
                <p className="mt-1.5 text-xs text-[#7a818b]">
                  {formatRange(active.match)} · {evidenceWords(active.match)}
                </p>
              </motion.div>
            )}

            {others.length > 0 && (
              <div className="mt-6 flex w-full max-w-[310px] flex-col gap-2">
                {others.slice(0, 3).map((other) => (
                  <Button
                    key={other.id}
                    variant="outline"
                    onClick={() => onPickOther?.(other.id)}
                    className="h-auto min-h-9 rounded-full border-[#dfe2e6] bg-white px-4 py-2 text-sm font-normal text-[#262b31]"
                  >
                    <span className="truncate">{other.instruction}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {composer && (
            <div className="border-t border-[#e5e7eb] p-3">
              {composer}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
