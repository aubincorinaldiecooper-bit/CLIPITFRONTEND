"use client"

import { useState } from "react"
import { ChevronDown, Globe, Search as SearchIcon, Sparkles } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { siteName } from "@/lib/video-embed"
import type { InternetMoment } from "@/lib/types"

/**
 * What the search actually did, while it is doing it.
 *
 * An expandable trace in the chat panel: the question that was asked, then
 * each video the watcher found something in, as it finds them.
 *
 * Every line here is something that happened. That sounds like a small point
 * and it is the whole design. A trace is read as provenance — it is the part
 * of the screen that says "here is where this came from" — so a trace that
 * animates a plausible sequence is worse than no trace at all, because it
 * lends borrowed credibility to whatever sits underneath it. The band
 * underneath is built to never claim an unverified thing; this must not undo
 * that one row higher up.
 *
 * Two things the reference design does that are deliberately not done here:
 *
 * There is no duration. "Thought for 4 seconds" would have to be measured
 * from when this component mounted, and the search began on a server before
 * the page was ever asked for. A count of videos is exactly true and needs no
 * stopwatch, so the header counts instead of timing.
 *
 * The rows are videos something was found in, not everything that was
 * watched, because those are the only ones there is an address for. Where the
 * two differ the difference is said out loud rather than left to imply that
 * three rows were the whole of the watching.
 */

export interface SearchTraceProps {
  /** The question, shown at the head of the trace as it was asked. */
  query: string
  /** Videos something was found in, in the order they were approved. */
  moments: InternetMoment[]
  /** True while the watchers are still going. */
  watching: boolean
  /** Videos discovered to watch. */
  candidatesFound?: number
  /** Of those, how many were actually watched. */
  candidatesWatched?: number
}

const INK = "#1d2127"
const INK_2 = "#68707a"
const INK_3 = "#9aa1aa"
const LINE = "#e5e7eb"
const HOVER = "#f5f6f7"

/** A dot per source, so a row reads as a place and not a bullet. */
const TONES = ["#2f6fec", "#e56d24", "#1f7a5f"]

function headline(watching: boolean, watched: number, found: number, rows: number): string {
  if (watching) return "Watching videos"
  // A count, never a duration: see the note above.
  if (watched > 0) return watched === 1 ? "Watched 1 video" : `Watched ${watched} videos`
  if (found > 0) return found === 1 ? "Could not watch 1 video" : `Could not watch ${found} videos`
  return rows > 0 ? "Watched what the search turned up" : "Nothing to watch"
}

/**
 * The videos watched that are not listed, said plainly.
 *
 * Without this the trace shows three rows under "Watched seven videos" and
 * leaves the reader to assume the three were the seven.
 */
function rest(watched: number, listed: number): string | null {
  const others = watched - listed
  if (others <= 0) return null
  if (listed === 0) return others === 1 ? "1 video watched, nothing found in it" : `${others} videos watched, nothing found in them`
  return others === 1 ? "and 1 more with nothing in it" : `and ${others} more with nothing in them`
}

export function SearchTrace({ query, moments, watching, candidatesFound = 0, candidatesWatched = 0 }: SearchTraceProps) {
  // Open while it is working, because that is when it is worth watching, and
  // closable at any point. Once a person has said which they want, that wins.
  const [chosen, setChosen] = useState<boolean | null>(null)
  const open = chosen ?? watching

  const others = rest(candidatesWatched, moments.length)
  const status = headline(watching, candidatesWatched, candidatesFound, moments.length)

  return (
    <div className="flex w-full flex-col" data-testid="search-trace">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setChosen((current) => !(current ?? watching))}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-[7px] px-1.5 py-1 transition-colors duration-100 hover:bg-[#f5f6f7]"
      >
        <Sparkles className="size-4 shrink-0" style={{ color: watching ? INK_2 : INK_3 }} aria-hidden />
        {/* `role="status"` and not an aria-live region on the trace itself:
            the rows are a record to read, not news to be read out. */}
        <span role="status" className="contents">
          {watching ? (
            <TextShimmer as="span" className="text-[13px] font-medium whitespace-nowrap">
              {status}
            </TextShimmer>
          ) : (
            <span className="text-[13px] font-medium whitespace-nowrap" style={{ color: INK_2 }}>
              {status}
            </span>
          )}
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 transition-transform duration-300"
          style={{ color: INK_3, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          aria-hidden
        />
      </button>

      {/* Height, not display, so opening and closing is a movement rather than
          a jump — and so the rows stay in the page for anything reading it. */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-4">
            <span aria-hidden className="absolute top-0 left-[3px] h-full w-px" style={{ background: LINE }} />
            <div className="flex flex-col gap-1 py-1">
              <div className="flex h-6 items-center gap-2 px-1.5">
                <SearchIcon className="size-3.5 shrink-0" style={{ color: INK_3 }} aria-hidden />
                <span className="truncate text-[12.5px]" style={{ color: INK_2 }} title={query}>
                  {query}
                </span>
              </div>

              {moments.map((moment, index) => {
                const where = siteName(moment.pageUrl) ?? moment.source ?? ""
                return (
                  <a
                    key={moment.id}
                    href={moment.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-7 w-full items-center gap-2 rounded-[6px] px-1.5 py-0.5 text-left transition-colors duration-150 hover:bg-[#f5f6f7]"
                    style={{ animation: `fade-up 320ms cubic-bezier(0.23,1,0.32,1) ${Math.min(index, 6) * 90}ms both` }}
                    data-testid="search-trace-source"
                  >
                    <span
                      className="flex size-3.5 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: TONES[index % TONES.length] }}
                      aria-hidden
                    >
                      <Globe className="size-2.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium" style={{ color: INK }}>
                      {moment.title || where || "A video"}
                    </span>
                    {where && (
                      <span className="shrink-0 text-[11.5px]" style={{ color: INK_3 }}>
                        {where}
                      </span>
                    )}
                  </a>
                )
              })}

              {others && (
                <span className="px-1.5 text-[12px]" style={{ color: INK_3 }} data-testid="search-trace-rest">
                  {others}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
