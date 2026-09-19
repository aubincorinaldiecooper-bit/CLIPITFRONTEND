"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, Library, Plus, RotateCw, Search, Users } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Button, buttonVariants } from "@/components/space/button"
import { Skeleton } from "@/components/space/skeleton"
import { VideoCaption, VideoTile } from "@/components/moments/video-tile"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/space/carousel"
import { StepRows } from "@/components/moments/step-rows"
import { StreamedText } from "@/components/start/streamed-text"
import type {
  InternetMoment,
  InternetSearchCandidate,
  InternetSearchFailureKind,
  InternetSearchOutcome,
} from "@/lib/types"
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
  /** The pages themselves, as far as the search got with each. */
  candidates?: InternetSearchCandidate[]
  /**
   * Run the same words again. Absent when there is nothing to offer.
   *
   * Deliberately a labelled button and not the retry glyph the reference
   * tucks inside the Failed pill. It does not resume anything — there is no
   * way to resume a Clipit search — it pays for a whole new one, watchers and
   * all. A twelve-pixel icon you can catch with a thumb is the wrong control
   * for something that costs money every time it is pressed.
   */
  onSearchAgain?: () => void
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
  candidates,
  onSearchAgain,
  composer,
}: InternetStageProps & { composer?: ReactNode }) {
  const found = useMemo(() => moments.slice(0, MAX_SLOTS), [moments])
  const pendingCount = phase === "searching" ? Math.max(0, MAX_SLOTS - found.length) : 0
  const ended = phase === "answered" || phase === "failed"
  const line = words(phase, moments.length, found.length, outcome, failure, candidatesFound, candidatesWatched)
  const slides = found.length + pendingCount

  // Which one is on screen. Read back from the carousel rather than kept
  // alongside it, so dragging, the arrows, the dots and the arrow keys can
  // never disagree about where we are. Embla re-reads its own slides when
  // results arrive mid-search, which is what keeps this honest as the count
  // grows.
  const [api, setApi] = useState<CarouselApi>()
  const [at, setAt] = useState(0)
  useEffect(() => {
    if (!api) return
    const read = () => setAt(api.selectedScrollSnap())
    read()
    api.on("select", read)
    api.on("reInit", read)
    return () => {
      api.off("select", read)
      api.off("reInit", read)
    }
  }, [api])

  const here = at < found.length ? found[at] : undefined


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

        {/* No surface behind the media (the owner, 2026-09-18). The reference
            has two things on the canvas — the media and the chat — not three
            panels. A white card behind a card is a frame around a frame, and
            it is what made the result look small and marooned. The header and
            the pager sit directly on the ground with it. */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-1">
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
              <Carousel
                setApi={setApi}
                opts={{ align: "center", containScroll: false }}
                aria-label="Videos found"
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="relative min-h-0 flex-1">
                  <CarouselContent>
                    {found.map((moment) => (
                      <CarouselItem key={moment.id} className="flex h-full justify-center">
                        <VideoTile moment={moment} />
                      </CarouselItem>
                    ))}

                    {Array.from({ length: pendingCount }, (_, index) => (
                      <CarouselItem key={`pending-${index}`} className="flex h-full justify-center">
                        <Skeleton
                          className="aspect-[9/16] h-full w-auto rounded-[18px] bg-[#e3e6e9]"
                          data-testid="moment-slot-pending"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>

                  {/* The arrows belong to the picture's edges, not the
                      column's. This box is invisible and carries the same
                      height and ratio as the card, so its sides are the
                      card's sides however the window is resized — the width
                      of a 9:16 card is only knowable from its height. */}
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 aspect-[9/16] -translate-x-1/2">
                    <CarouselPrevious className="pointer-events-auto absolute top-1/2 -left-14 -translate-y-1/2">
                      <ChevronLeft className="size-4" />
                    </CarouselPrevious>
                    <CarouselNext className="pointer-events-auto absolute top-1/2 -right-14 -translate-y-1/2">
                      <ChevronRight className="size-4" />
                    </CarouselNext>
                  </div>
                </div>

                <div className="shrink-0 pt-3.5">
                  {here && <VideoCaption moment={here} />}

                  <div className="mt-3.5 flex items-center justify-center gap-2" data-testid="deck-dots">
                    {Array.from({ length: slides }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => api?.scrollTo(index)}
                        aria-label={`Video ${index + 1} of ${slides}`}
                        aria-current={index === at}
                        className={cn(
                          "h-2 rounded-full transition-all duration-300 motion-reduce:transition-none",
                          index === at ? "w-6 bg-[#1d2127]" : "w-2 bg-[#c3c8ce] hover:bg-[#a7adb4]",
                        )}
                      />
                    ))}
                  </div>
                </div>
              </Carousel>
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
                reference puts them in, and the order they happened in.

                Shown from the first frame, including while the first poll is
                still in flight: a row spinning on "Searched the internet" is
                the truth at that moment, and an empty panel is not. */}
            <div className="mt-4">
              <StepRows
                phase={phase}
                moments={moments}
                candidatesFound={candidatesFound}
                candidatesWatched={candidatesWatched}
                candidates={candidates}
                outcome={outcome}
                failure={failure}
              />
            </div>

            <div
              className="mt-3.5 text-[13.5px] leading-relaxed text-[#3d444c]"
              aria-live="polite"
              data-testid="internet-words"
            >
              {ended ? <p><StreamedText text={line} /></p> : <TextShimmer as="p">{line}</TextShimmer>}
            </div>

            {/* Beside the sentence that says what went wrong, which is where
                someone reads "this did not work" and wants to do something
                about it. Only on a search that failed: offering it after a
                search that finished and found nothing would be inviting
                someone to pay again for the same answer. */}
            {phase === "failed" && onSearchAgain && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSearchAgain}
                  className="h-8 rounded-lg border-[#dfe2e6] bg-white px-3 text-[12.5px] font-medium whitespace-nowrap text-[#262b31]"
                  data-testid="search-again"
                >
                  <RotateCw className="mr-1.5 size-3.5" />
                  Search again
                </Button>
              </div>
            )}
          </div>

          {composer && <div className="shrink-0 border-t border-[#eef0f2] p-3">{composer}</div>}
        </aside>
      </div>
    </div>
  )
}
