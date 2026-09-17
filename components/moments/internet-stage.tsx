"use client"

import { useMemo, type ReactNode } from "react"
import { Library, Plus, Search, Users } from "lucide-react"
import { motion } from "motion/react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { buttonVariants } from "@/components/space/button"
import { Skeleton } from "@/components/space/skeleton"
import { MatchBadge } from "@/components/moments/match-badge"
import type { InternetMoment, InternetSearchFailureKind, InternetSearchOutcome } from "@/lib/types"
import { siteName } from "@/lib/video-embed"
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

  return (
    <div
      className="grid min-h-dvh w-full bg-white text-[#17191d] lg:grid-cols-[270px_minmax(0,1fr)_390px]"
      data-testid="internet-stage"
      data-phase={phase}
    >
      <aside className="hidden border-r border-[#e5e7eb] bg-[#fbfbfb] lg:flex lg:min-h-dvh lg:flex-col">
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
        </nav>
      </aside>

      <section className="min-w-0 border-r border-[#e5e7eb]">
        <header className="flex h-16 items-center justify-between border-b border-[#e5e7eb] px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Search className="size-4 shrink-0 text-[#4b525b]" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1d2127]">Internet results</p>
              <p className="truncate text-xs text-[#7a818b]" data-testid="internet-question">{query}</p>
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

        <div className="space-y-4 px-5 py-5">
          {found.map((moment) => {
            const percent = matchPercent(moment)
            return (
              <motion.a
                key={moment.id}
                href={moment.pageUrl}
                target="_blank"
                rel="noreferrer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="block overflow-hidden rounded-[18px] border border-[#e6e8eb] bg-[#f7f8f9] transition-colors hover:border-[#d4d7db]"
                data-testid="moment-slot-filled"
              >
                <div className="relative aspect-[16/7] min-h-[170px] w-full overflow-hidden bg-[#f1f2f3]">
                  {moment.still ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={moment.still} alt="" draggable={false} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center px-8 text-center text-sm text-[#707780]">
                      {titleOf(moment)}
                    </div>
                  )}
                  {percent !== null && <MatchBadge value={percent} className="absolute top-3 left-3" />}
                </div>
                <div className="px-4 py-3.5">
                  <p className="line-clamp-2 text-sm font-medium text-[#20242a]">{titleOf(moment)}</p>
                  <p className="mt-1 truncate text-xs text-[#7a818b]">
                    {siteName(moment.pageUrl) ?? moment.source ?? ""}
                  </p>
                </div>
              </motion.a>
            )
          })}

          {Array.from({ length: pendingCount }, (_, index) => (
            <Skeleton
              key={`pending-${index}`}
              aria-hidden
              className="h-[clamp(170px,22vh,230px)] w-full rounded-[18px] bg-[#f5f6f7]"
              data-testid="moment-slot-pending"
            />
          ))}
        </div>
      </section>

      <aside className="flex min-h-[540px] flex-col bg-white lg:min-h-dvh">
        <header className="flex h-16 items-center border-b border-[#e5e7eb] px-5">
          <p className="text-sm font-semibold text-[#1d2127]">Search chat</p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center px-7 py-8 text-center">
            <div className="flex size-11 items-center justify-center rounded-full border border-[#e0e3e7] bg-[#f7f8f9]">
              <Search className="size-4 text-[#343a42]" />
            </div>
            <p className="mt-5 max-w-[28ch] text-[17px] font-semibold leading-snug text-[#1d2127]">
              {query}
            </p>
            <div className="mt-3 max-w-[32ch] text-sm leading-relaxed text-[#68707a]" aria-live="polite" data-testid="internet-words">
              {ended ? <p>{line}</p> : <TextShimmer as="p">{line}</TextShimmer>}
            </div>
          </div>

          {composer && <div className="border-t border-[#e5e7eb] p-3">{composer}</div>}
        </div>
      </aside>
    </div>
  )
}
