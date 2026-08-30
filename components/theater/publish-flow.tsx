"use client"

import { useEffect, useMemo, useState } from "react"
import { api, ApiError } from "@/lib/api"
import type { SocialAccount, SocialAccountsPage } from "@/lib/types"
import { ReclipIcon } from "./review-deck"

/**
 * Publishing, from the deck: Where do they go? → now or later → the truth
 * about what happened. The owner's screens of 2026-08-30, adapted onto the
 * real Zernio surface this app already has.
 *
 * The honest edges, kept visible rather than smoothed over:
 * - A platform with no connected account shows "Not connected" and leads to
 *   the Publishing page — it is never a silently disabled row.
 * - "N clips ready" counts clips whose files exist; a keep still cutting is
 *   named, not hidden, and publishing posts only what is ready.
 * - Post now reports per clip. A submission the platform must reshape first
 *   says "being cut for TikTok" instead of pretending it's live.
 * - Schedule writes a real promise (a scheduled_posts row and a worker
 *   alarm); the confirmation repeats the minute the backend accepted, and a
 *   failure at fire time lands on the Publishing page's scheduled list.
 */

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube Shorts",
}
/** The order the owner's screen lists them in. */
const PLATFORM_ORDER = ["tiktok", "instagram", "youtube"] as const

export interface PublishableClip {
  id: string
  title: string
  ready: boolean
}

/** One clip's outcome from a Post now / Schedule submission. */
export interface PublishOutcome {
  clipId: string
  title: string
  ok: boolean
  /** 'submitted' | 'rendering' | 'scheduled' when ok; the refusal when not. */
  detail: string
}

// --- Calendar math, kept pure so the tests can hold it still --------------

export interface MonthCell {
  day: number
  /** ISO yyyy-mm-dd in LOCAL terms — what picking this cell means. */
  iso: string
  disabled: boolean
}

const pad2 = (n: number) => String(n).padStart(2, "0")
export const localIso = (year: number, month: number, day: number) => `${year}-${pad2(month + 1)}-${pad2(day)}`

/**
 * The weeks of one month, Sunday-first, with days before `today` disabled.
 * `year`/`month` are local; cells are null where the grid has no day.
 */
export function monthGrid(year: number, month: number, today: Date): Array<Array<MonthCell | null>> {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayIso = localIso(today.getFullYear(), today.getMonth(), today.getDate())

  const weeks: Array<Array<MonthCell | null>> = []
  let week: Array<MonthCell | null> = Array.from({ length: first.getDay() }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = localIso(year, month, day)
    week.push({ day, iso, disabled: iso < todayIso })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

/** "6:00 PM" from "18:00" — the confirmation speaks clock, not code. */
export function speakTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const period = h! >= 12 ? "PM" : "AM"
  const hour = h! % 12 === 0 ? 12 : h! % 12
  return `${hour}:${pad2(m!)} ${period}`
}

/** The chosen local day + time as a Date; null when either is missing/bad. */
export function scheduleDate(dayIso: string | null, hhmm: string): Date | null {
  if (!dayIso) return null
  const [y, mo, d] = dayIso.split("-").map(Number)
  const [h, mi] = hhmm.split(":").map(Number)
  if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return null
  return new Date(y!, mo! - 1, d!, h!, mi!, 0, 0)
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// --- The stages -----------------------------------------------------------

function BackDisc({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onBack}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-shborder transition-colors hover:bg-shaccent"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
    </button>
  )
}

/**
 * "Where do they go?" — the accounts, the caption, and the two ways out.
 * Multi-select: the same clips can go to every ticked account at once.
 */
export function WhereTo({
  clips,
  onBack,
  onPostNow,
  onSchedule,
  busy,
}: {
  clips: PublishableClip[]
  onBack: () => void
  onPostNow: (accountIds: string[], caption: string) => void
  onSchedule: (accountIds: string[], caption: string) => void
  busy: boolean
}) {
  const [page, setPage] = useState<SocialAccountsPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [caption, setCaption] = useState("")

  useEffect(() => {
    let cancelled = false
    api
      .listSocialAccounts()
      .then((result) => {
        if (cancelled) return
        setPage(result)
        // Every connected account starts ticked — the common case is "post
        // it everywhere I post", and unticking is one tap.
        setChosen(new Set(result.accounts.filter((a) => a.status === "connected").map((a) => a.id)))
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  const ready = clips.filter((clip) => clip.ready)
  const cutting = clips.length - ready.length
  const connected = page?.accounts.filter((a) => a.status === "connected") ?? []
  const byPlatform = new Map<string, SocialAccount[]>()
  for (const account of connected) {
    byPlatform.set(account.platform, [...(byPlatform.get(account.platform) ?? []), account])
  }
  const missingPlatforms = PLATFORM_ORDER.filter((platform) => !byPlatform.has(platform))
  const canGo = !busy && ready.length > 0 && chosen.size > 0

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div data-testid="publish-where">
      <div className="flex items-center gap-3 pb-5">
        <BackDisc onBack={onBack} label="Back to your kept clips" />
        <h2 className="text-xl font-semibold tracking-tight">Where do they go?</h2>
      </div>

      {failed ? (
        <p className="py-6 text-sm text-destructive">Couldn&apos;t load your accounts. Close this and try again.</p>
      ) : page === null ? (
        <div className="flex flex-col gap-2.5 py-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-shmuted" />
          ))}
        </div>
      ) : !page.configured ? (
        <p className="py-6 text-sm text-muted-foreground">Publishing isn&apos;t configured on this deployment.</p>
      ) : page.signInRequired ? (
        <p className="py-6 text-sm text-muted-foreground">
          Sign in to publish — your connected accounts live with your account, not this tab.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {connected.map((account) => {
              const ticked = chosen.has(account.id)
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => toggle(account.id)}
                  aria-pressed={ticked}
                  className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left ring-1 transition-colors ${
                    ticked ? "bg-shcard ring-2 ring-shprimary" : "bg-shcard ring-shborder hover:bg-shaccent"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-foreground">
                      {PLATFORM_LABELS[account.platform] ?? account.platform}
                    </span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {account.displayName ? `@${account.displayName.replace(/^@/, "")}` : "Connected"}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                      ticked ? "bg-shprimary text-primary-foreground" : "bg-shmuted"
                    }`}
                  >
                    {ticked && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12.5l5 5L20 6.5" />
                      </svg>
                    )}
                  </span>
                </button>
              )
            })}
            {missingPlatforms.map((platform) => (
              <a
                key={platform}
                href="/publishing"
                className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-shborder transition-colors hover:bg-shaccent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-muted-foreground">
                    {PLATFORM_LABELS[platform]}
                  </span>
                  <span className="block text-[13px] text-muted-foreground/80">Not connected</span>
                </span>
                <span aria-hidden className="h-7 w-7 shrink-0 rounded-full bg-shmuted/60" />
              </a>
            ))}
          </div>

          {/* One caption for every post. Optional — an empty caption posts
              as an empty caption, it is never invented. */}
          <input
            type="text"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Add a caption (optional — used for every clip)"
            maxLength={2200}
            className="mt-4 w-full rounded-2xl bg-shmuted px-4 py-3 text-sm outline-none ring-1 ring-shborder transition-shadow placeholder:text-muted-foreground focus:ring-ring"
          />

          <p className="mt-3 h-5 text-[13px] text-muted-foreground">
            {ready.length} {ready.length === 1 ? "clip" : "clips"} ready
            {cutting > 0 ? ` · ${cutting} still cutting (${cutting === 1 ? "it won't" : "they won't"} be posted)` : ""}
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => onPostNow(Array.from(chosen), caption.trim())}
              disabled={!canGo}
              className="w-full whitespace-nowrap rounded-full bg-shprimary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "Posting…" : "Post now"}
            </button>
            <button
              type="button"
              onClick={() => onSchedule(Array.from(chosen), caption.trim())}
              disabled={!canGo}
              className="w-full whitespace-nowrap rounded-full px-4 py-3.5 text-[15px] font-medium text-foreground ring-1 ring-shborder transition-colors hover:bg-shaccent disabled:opacity-50"
            >
              Schedule
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** "When should it go out?" — the calendar, the time, the one commitment. */
export function WhenTo({
  onBack,
  onCommit,
  busy,
  error,
}: {
  onBack: () => void
  onCommit: (when: Date) => void
  busy: boolean
  /** A refusal from the last attempt, shown in place. */
  error: string | null
}) {
  const now = useMemo(() => new Date(), [])
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [dayIso, setDayIso] = useState<string | null>(null)
  const [time, setTime] = useState("18:00")

  const weeks = useMemo(() => monthGrid(view.year, view.month, now), [view, now])
  const atCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth()
  const when = scheduleDate(dayIso, time)
  const tooSoon = when !== null && when.getTime() - Date.now() < 60 * 1000
  const canCommit = !busy && when !== null && !tooSoon

  const step = (offset: number) =>
    setView((current) => {
      const next = new Date(current.year, current.month + offset, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })

  return (
    <div data-testid="publish-when">
      <div className="flex items-center gap-3 pb-5">
        <BackDisc onBack={onBack} label="Back to accounts" />
        <h2 className="text-xl font-semibold tracking-tight">When should it go out?</h2>
      </div>

      <div className="flex items-center justify-between pb-3">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => step(-1)}
          disabled={atCurrentMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-shborder transition-colors hover:bg-shaccent disabled:opacity-35"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <p className="text-[15px] font-semibold">{MONTH_NAMES[view.month]} {view.year}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => step(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-shborder transition-colors hover:bg-shaccent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 pb-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
          <span key={i} className="py-1 text-[12px] font-medium text-muted-foreground">{label}</span>
        ))}
      </div>
      <div role="grid" aria-label="Pick a day" className="grid grid-cols-7 gap-y-1">
        {weeks.flat().map((cell, index) =>
          cell === null ? (
            <span key={`empty-${index}`} aria-hidden />
          ) : (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              aria-selected={dayIso === cell.iso}
              disabled={cell.disabled}
              onClick={() => setDayIso(cell.iso)}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13.5px] tabular-nums transition-colors ${
                dayIso === cell.iso
                  ? "bg-shprimary font-semibold text-primary-foreground"
                  : cell.disabled
                    ? "text-muted-foreground/40"
                    : "font-medium text-foreground hover:bg-shaccent"
              } disabled:cursor-default`}
            >
              {cell.day}
            </button>
          ),
        )}
      </div>

      <label className="mt-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-shborder">
        <span className="text-[15px] font-medium">Time</span>
        <span className="flex items-center gap-2">
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value || "18:00")}
            className="bg-transparent text-right font-mono text-[14px] tabular-nums outline-none"
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-muted-foreground" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
        </span>
      </label>

      {/* Reserved line: a refusal appearing must not shove the button. */}
      <p className="mt-3 h-5 text-center text-[12.5px] text-destructive">
        {error ?? (tooSoon ? "That minute is already here — pick a later time, or use Post now." : "")}
      </p>

      <button
        type="button"
        onClick={() => when && onCommit(when)}
        disabled={!canCommit}
        className="mt-4 w-full whitespace-nowrap rounded-full bg-shprimary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground transition-[transform,opacity] active:scale-[0.98] disabled:bg-shmuted-foreground/40 disabled:text-white disabled:opacity-90"
      >
        {busy ? "Scheduling…" : "Publish your post"}
      </button>
    </div>
  )
}

/**
 * What actually happened, per clip — "Scheduled" with the promised minute,
 * or the submission truth for Post now, or the refusal for what failed.
 */
export function PublishDone({
  mode,
  when,
  outcomes,
  onRetryFailed,
  onHome,
  busy,
}: {
  mode: "now" | "scheduled"
  /** The promised local time, for mode 'scheduled'. */
  when: Date | null
  outcomes: PublishOutcome[]
  onRetryFailed: (() => void) | null
  onHome: () => void
  busy: boolean
}) {
  const failures = outcomes.filter((outcome) => !outcome.ok)
  const successes = outcomes.filter((outcome) => outcome.ok)
  const rendering = successes.filter((outcome) => outcome.detail === "rendering").length
  const allFailed = successes.length === 0

  const title = allFailed ? "That didn't work" : mode === "scheduled" ? "Scheduled" : "On their way"
  const line = allFailed
    ? "Nothing was posted — the reasons are below."
    : mode === "scheduled" && when
      ? `${successes.length === 1 ? "Your post goes" : `${successes.length} posts go`} out ${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${speakTime(`${pad2(when.getHours())}:${pad2(when.getMinutes())}`)}`
      : rendering > 0
        ? `${successes.length} submitted — ${rendering} being cut to shape first, posting when ready`
        : `${successes.length} ${successes.length === 1 ? "clip" : "clips"} submitted to your accounts`

  return (
    <div className="flex flex-col items-center px-2 py-8 text-center" data-testid="publish-done">
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full ${allFailed ? "bg-destructive/10 text-destructive" : "bg-shprimary text-primary-foreground"}`}
      >
        {allFailed ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M12 6v7M12 17.5v.5" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        )}
      </span>
      <p className="mt-4 text-xl font-semibold tracking-tight">{title}</p>
      <p className="mt-1 max-w-[19rem] text-[13.5px] leading-snug text-muted-foreground">{line}</p>

      {failures.length > 0 && (
        <div className="mt-4 w-full max-w-[21rem] rounded-2xl bg-destructive/5 p-3 text-left ring-1 ring-destructive/20">
          {failures.map((failure) => (
            <p key={failure.clipId} className="py-0.5 text-[12.5px] leading-snug text-destructive">
              <span className="font-medium">{failure.title}:</span> {failure.detail}
            </p>
          ))}
          {onRetryFailed && (
            <button
              type="button"
              onClick={onRetryFailed}
              disabled={busy}
              className="mt-2 flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium text-destructive ring-1 ring-destructive/30 transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              <ReclipIcon spinning={busy} />
              Try the failed {failures.length === 1 ? "one" : "ones"} again
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onHome}
        className="mt-7 w-full max-w-[19rem] whitespace-nowrap rounded-full px-4 py-3 text-[13.5px] font-medium text-foreground ring-1 ring-shborder transition-colors hover:bg-shaccent"
      >
        Back to home
      </button>
    </div>
  )
}

/**
 * Runs one publish per ready clip, sequentially — the backend's duplicate
 * guard is per clip, and a burst of parallel posts is exactly the shape a
 * rate limit refuses. Returns the truth for every clip, never a summary
 * that hides a failure.
 */
export async function publishEach(
  clips: PublishableClip[],
  input: { caption: string; accountIds: string[]; scheduledAt?: string },
): Promise<PublishOutcome[]> {
  const outcomes: PublishOutcome[] = []
  for (const clip of clips) {
    try {
      const result = await api.publishClip(clip.id, {
        caption: input.caption,
        accountIds: input.accountIds.length > 0 ? input.accountIds : undefined,
        ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
      })
      const detail = result.scheduled
        ? "scheduled"
        : (result.posts ?? []).some((post) => post.status === "rendering")
          ? "rendering"
          : "submitted"
      outcomes.push({ clipId: clip.id, title: clip.title, ok: true, detail })
    } catch (cause) {
      outcomes.push({
        clipId: clip.id,
        title: clip.title,
        ok: false,
        detail: cause instanceof ApiError ? cause.message : "Something went wrong submitting this clip.",
      })
    }
  }
  return outcomes
}
