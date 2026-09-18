"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, Library, Plus, Search, Users } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Button, buttonVariants } from "@/components/space/button"
import { Skeleton } from "@/components/space/skeleton"
import { VideoTile } from "@/components/moments/video-tile"
import { SearchTrace } from "@/components/moments/search-trace"
import { StreamedText } from "@/components/start/streamed-text"
import type { InternetMoment, InternetSearchFailureKind, InternetSearchOutcome } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"

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

  if (outcome === "search_failed") {
    const some = found > 0 ? `${found} ${plural(found, "video", "videos")} turned up before it stopped, and ` : ""
    return `${becauseOf(failure)} Clipit's search stopped before it finished, so ${some}this is not an answer about what is in the videos.`
  }

  // Everything below this line makes a claim about the world — that there were
  // no videos, or that the ones there were did not have it in them. A search
  // that did not finish has not earned any of them, so it stops here.
  //
  // It sits above `no_candidates` rather than further down because that is
  // where the first version put it, and it was wrong: a failed search carrying
  // `no_candidates` still returned "The search turned up no videos to watch",
  // which is every bit as conclusive as the sentence the guard was written to
  // prevent. The test passed anyway, because it only checked for the absence
  // of that one phrase. Caught by Codex on #111.
  if (phase === "failed") {
    return `${becauseOf(failure)} Clipit's search did not finish, so this is not an answer about what is in the videos.`
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


export function InternetStage({
  query,
  phase,
  moments,
  outcome,
  failure,
  candidatesFound = 0,
  candidatesWatched,
  composer,
}: InternetStageProps & { composer?: ReactNode }) {
  const found = useMemo(() => moments.slice(0, MAX_SLOTS), [moments])
  const pendingCount = phase === "searching" ? Math.max(0, MAX_SLOTS - found.length) : 0
  const ended = phase === "answered" || phase === "failed"
  const line = words(phase, moments.length, found.length, outcome, failure, candidatesFound, candidatesWatched)
  const slides = found.length + pendingCount

  // Which one is on screen. Clamped rather than trusted: results arrive while
  // the search runs, and a skeleton the person had paged to can be replaced by
  // a real card or disappear entirely when the count settles.
  const [at, setAt] = useState(0)
  useEffect(() => {
    setAt((n) => Math.min(Math.max(0, n), Math.max(0, slides - 1)))
  }, [slides])


  return (
    /* A canvas, with the three panels floating on it (the owner's reference,
       2026-09-18). They used to be flush columns divided by hairlines, which
       reads as a dashboard; separate surfaces on a ground read as a
       workspace. The grid is exactly the viewport tall and every panel
       scrolls inside itself, so none of them can push another off screen —
       which is the bug that hid the chat panel entirely before this. */
    <div
      className="h-dvh w-full overflow-hidden bg-[#eceef0] p-3 text-[#17191d]"
      data-testid="internet-stage"
      data-phase={phase}
    >
      <div className="grid h-full w-full gap-3 lg:grid-cols-[248px_minmax(0,1fr)_392px]">
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl bg-white lg:flex">
          <div className="flex h-14 shrink-0 items-center px-4">
            <a href="/start" aria-label="Clipit home" className="inline-flex items-center">
              <Logo size={18} />
            </a>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
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
          </nav>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-white">
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#eef0f2] px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <Search className="size-4 shrink-0 text-[#4b525b]" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#1d2127]">Internet results</p>
                <p className="truncate text-[11.5px] text-[#7a818b]" data-testid="internet-question">
                  {query}
                </p>
              </div>
            </div>
            <a
              href="/start"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "shrink-0 rounded-lg border-[#dfe2e6] bg-white font-medium whitespace-nowrap text-[#262b31]",
              )}
            >
              New search
            </a>
          </header>

          {/* One result at a time (the owner's decision, 2026-09-18). Every
              result stays in the page and the track slides, rather than the
              others being torn out and rebuilt — so the count of what came
              back is always really there, and moving between them costs
              nothing. Reduced motion turns the slide off; the card still
              changes. */}
          <div className="flex min-h-0 flex-1 flex-col">
            {slides === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-6">
                {/* Deliberately about this panel, not about the world. Why
                    there is nothing is the chat panel's job to say, and it is
                    the only place that knows whether anything was watched. */}
                <p className="text-[13px] text-[#9aa1aa]">Nothing to show here.</p>
              </div>
            ) : (
              <>
                <div className="relative min-h-0 flex-1 overflow-hidden px-6 py-5">
                  <div
                    className="flex h-full transition-transform duration-[420ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                    style={{ transform: `translateX(-${at * 100}%)` }}
                  >
                    {found.map((moment, index) => (
                      <div
                        key={moment.id}
                        className="flex h-full w-full shrink-0 justify-center"
                        aria-hidden={index !== at}
                      >
                        <VideoTile moment={moment} />
                      </div>
                    ))}

                    {Array.from({ length: pendingCount }, (_, index) => (
                      <div
                        key={`pending-${index}`}
                        className="flex h-full w-full shrink-0 justify-center"
                        aria-hidden
                      >
                        <Skeleton
                          className="aspect-[9/16] min-h-0 w-auto flex-1 rounded-[18px] bg-[#f2f3f5]"
                          data-testid="moment-slot-pending"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-center gap-3 border-t border-[#eef0f2] px-4 py-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Previous video"
                    disabled={at === 0}
                    onClick={() => setAt((n) => Math.max(0, n - 1))}
                    className="size-8 rounded-lg text-[#4b525b] hover:bg-[#f0f1f2] disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>

                  <p
                    className="min-w-[5.5rem] text-center text-[12px] tabular-nums whitespace-nowrap text-[#68707a]"
                    aria-live="polite"
                    data-testid="deck-position"
                  >
                    {at + 1} of {slides}
                  </p>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Next video"
                    disabled={at >= slides - 1}
                    onClick={() => setAt((n) => Math.min(slides - 1, n + 1))}
                    className="size-8 rounded-lg text-[#4b525b] hover:bg-[#f0f1f2] disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white">
          <header className="flex h-14 shrink-0 items-center border-b border-[#eef0f2] px-4">
            <p className="text-[13px] font-semibold text-[#1d2127]">Search chat</p>
          </header>

          {/* The conversation starts at the top and grows downward, like any
              chat. It used to centre itself, which is why a single question
              and answer sat marooned in the middle of an empty column. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex justify-end">
              <p className="max-w-[86%] rounded-[16px] bg-[#f1f2f4] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#1d2127]">
                {query}
              </p>
            </div>

            {/* The work, then what it concluded — the order the owner's
                reference puts them in, and the order they happened in. */}
            {(phase === "searching" || ended) && (
              <div className="mt-4">
                <SearchTrace
                  query={query}
                  moments={moments}
                  watching={!ended}
                  candidatesFound={candidatesFound}
                  candidatesWatched={candidatesWatched}
                />
              </div>
            )}

            <div
              className="mt-3.5 text-[13.5px] leading-relaxed text-[#3d444c]"
              aria-live="polite"
              data-testid="internet-words"
            >
              {ended ? <p><StreamedText text={line} /></p> : <TextShimmer as="p">{line}</TextShimmer>}
            </div>
          </div>

          {composer && <div className="shrink-0 border-t border-[#eef0f2] p-3">{composer}</div>}
        </aside>
      </div>
    </div>
  )
}
