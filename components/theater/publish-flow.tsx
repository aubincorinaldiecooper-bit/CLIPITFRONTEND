"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Spinner } from "@astryxdesign/core/Spinner"
import { api, ApiError } from "@/lib/api"
import type { SocialAccount, SocialAccountsPage } from "@/lib/types"
import { ChannelToggle, ReclipIcon } from "./review-deck"
import { PlatformLogo } from "@/components/platform-logos"
import { useConnectPlatform } from "./connect-platform"
import { retryPlans, usePublishProgress, type PostProgress, type PublishOutcome, type PublishPhase } from "./publish-progress"

export type { MadePost, PublishOutcome } from "./publish-progress"

/**
 * Publishing, from the deck and from the feed's dialog: Where do they go? →
 * now or later → the truth about what happened. The owner's screens of
 * 2026-08-30, adapted onto the real Zernio surface this app already has,
 * and the owner's call of 2026-09-02: every channel CLIPIT can post to is
 * on the list with its own Connect, connecting plays out without leaving
 * the screen, and Publish is one control that tells the truth in place —
 * Uploading…, then Published (inactive) on the platforms' own word, Sent
 * (inactive) when that word is slow in coming, Try again when refused.
 *
 * The honest edges, kept visible rather than smoothed over:
 * - A platform with no connected account shows "Not connected" and its
 *   own Connect — it is never a silently disabled row.
 * - "Published" is said only on the platform's word, read back from the
 *   posts (see publish-progress); a post the server merely accepted reads
 *   Uploading…, and then Sent.
 * - "N clips ready" counts clips whose files exist; a keep still cutting is
 *   named, not hidden, and publishing posts only what is ready.
 * - Post now reports per clip. A submission the platform must reshape first
 *   says "being cut for TikTok" instead of pretending it's live.
 * - Schedule writes a real promise (a scheduled_posts row and a worker
 *   alarm); the confirmation repeats the minute the backend accepted, and a
 *   failure at fire time lands on the Publishing page's scheduled list.
 */

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  x: "X",
}
/** The order the owner's screen lists them in (2026-09-02). */
const PLATFORM_ORDER = ["youtube", "tiktok", "instagram", "x"] as const
const labelOf = (platform: string) => PLATFORM_LABELS[platform] ?? platform
/** "TikTok and X" · "TikTok, YouTube Shorts and X" */
export function speakList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ""
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`
}
/** How long a freshly connected row wears its mark. */
export const CONNECTED_MARK_MS = 1_800

export interface PublishableClip {
  id: string
  title: string
  ready: boolean
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
 * The mark a row wears the moment its channel is connected: a disc that
 * springs in on the platform's logo and draws its check. Gone again after
 * CONNECTED_MARK_MS; instant under reduced motion.
 */
function ConnectedMark() {
  const reduce = useReducedMotion()
  return (
    <motion.span
      aria-hidden
      data-testid="connected-mark"
      initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: "spring", stiffness: 480, damping: 24 }}
      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-shprimary text-primary-foreground ring-2 ring-background"
    >
      <motion.svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M4 12.5l5 5L20 6.5"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.32, delay: 0.12, ease: "easeOut" }}
        />
      </motion.svg>
    </motion.span>
  )
}

function CheckGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  )
}

/**
 * Where a row's switch was, once Publish is pressed: what that channel is
 * doing. The same 60px the switch took, so nothing moves.
 */
function PostMark({ outcome, settled }: { outcome: "posting" | "posted" | "failed" | "none"; settled: boolean }) {
  return (
    <span className="flex h-[34px] w-[60px] shrink-0 items-center justify-center" aria-hidden>
      {outcome === "posting" && !settled ? (
        <Spinner size="md" shade="subtle" aria-label="Uploading" />
      ) : outcome === "posted" ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-shprimary text-primary-foreground">
          <CheckGlyph size={14} />
        </span>
      ) : outcome === "failed" ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M12 6v7M12 17.5v.5" />
          </svg>
        </span>
      ) : outcome === "posting" ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground ring-1 ring-shborder">
          <CheckGlyph size={13} />
        </span>
      ) : null}
    </span>
  )
}

/**
 * Publish, as one control: a full-width pill that draws in to a circle
 * holding the loading ring while the platforms have the clip, opens back
 * out saying Published (and stays, inactive) on their word, or Sent
 * (inactive) when that word is slow in coming, or Try again when something
 * was refused. The height never changes; only the width, and only for the
 * ring.
 */
function PublishButton({ phase, disabled, onClick }: { phase: PublishPhase; disabled: boolean; onClick: () => void }) {
  const ring = phase === "publishing"
  const inactive = phase === "publishing" || phase === "published" || phase === "sent"
  const words =
    phase === "publishing" ? "Uploading…" : phase === "published" ? "Published" : phase === "sent" ? "Sent" : phase === "failed" ? "Try again" : "Publish"
  const tone =
    phase === "sent"
      ? "bg-shmuted text-foreground ring-1 ring-shborder"
      : phase === "published"
        ? "bg-shprimary/80 text-primary-foreground"
        : "bg-shprimary text-primary-foreground"
  return (
    <motion.button
      layout
      type="button"
      onClick={onClick}
      disabled={disabled || inactive}
      aria-label={words}
      aria-live="polite"
      data-phase={phase}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={`flex h-[52px] items-center justify-center overflow-hidden whitespace-nowrap rounded-full text-[15px] font-semibold ${
        ring ? "w-[52px]" : "w-full"
      } ${tone} ${inactive ? "cursor-default" : "transition-transform active:scale-[0.98] disabled:opacity-50"}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="flex items-center gap-2.5"
        >
          {ring ? <Spinner size="lg" shade="onMedia" aria-label="Uploading" /> : phase === "published" ? <CheckGlyph /> : null}
          {ring ? null : words}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

/** What one channel's row says under its name once Publish is pressed. */
function rowWords(post: PostProgress | undefined, label: string, phase: PublishPhase): string | null {
  if (!post) return phase === "idle" ? null : "Not sent"
  if (post.outcome === "posted") return "Published"
  if (post.outcome === "failed") return "Didn't go through"
  if (phase === "sent") return `Sent — waiting for ${label} to confirm`
  return post.status === "rendering" ? `Being cut for ${label}…` : "Uploading…"
}

/**
 * "Where do they go?" — the channels, the caption, and the way out. Every
 * channel CLIPIT can post to is a row: one with an account carries its
 * switch; one without carries Connect, and connecting plays out here (the
 * sign-in in a small window, the row's mark when it is done, the switch
 * on). Publish is one control that tells the truth in place. Multi-select:
 * the same clips go to every switched-on account at once.
 */
export function WhereTo({
  clips,
  onBack,
  onPublish,
  onSchedule,
  busy,
}: {
  clips: PublishableClip[]
  onBack: () => void
  /** Post now: publish the ready clips (or the named ones) to these accounts, and answer the truth per clip. */
  onPublish: (accountIds: string[], caption: string, clipIds?: string[]) => Promise<PublishOutcome[]>
  onSchedule: (accountIds: string[], caption: string) => void
  busy: boolean
}) {
  const [page, setPage] = useState<SocialAccountsPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [caption, setCaption] = useState("")
  const [outcomes, setOutcomes] = useState<PublishOutcome[] | null>(null)
  /** The platform whose row is wearing its "connected" mark. */
  const [marked, setMarked] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .listSocialAccounts()
      .then((result) => {
        if (cancelled) return
        setPage(result)
        // Every connected account starts switched on — the common case is
        // "post it everywhere I post", and switching one off is one tap.
        setChosen(new Set(result.accounts.filter((a) => a.status === "connected").map((a) => a.id)))
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  const connecting = useConnectPlatform({
    onConnected: (account, fresh) => {
      setPage(fresh)
      setChosen((current) => new Set([...current, account.id]))
      setMarked(account.platform)
    },
  })
  useEffect(() => {
    if (!marked) return
    const timer = setTimeout(() => setMarked(null), CONNECTED_MARK_MS)
    return () => clearTimeout(timer)
  }, [marked])

  const progress = usePublishProgress(outcomes)
  const phase = progress.phase
  const idle = phase === "idle"

  const ready = clips.filter((clip) => clip.ready)
  const cutting = clips.length - ready.length
  const connected = page?.accounts.filter((a) => a.status === "connected") ?? []
  const byPlatform = new Map<string, SocialAccount[]>()
  for (const account of connected) {
    byPlatform.set(account.platform, [...(byPlatform.get(account.platform) ?? []), account])
  }
  const canGo = !busy && idle && ready.length > 0 && chosen.size > 0

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const publish = async () => {
    if (!canGo) return
    setOutcomes(await onPublish(Array.from(chosen), caption.trim()))
  }

  const retry = async () => {
    if (!outcomes || busy) return
    const plans = retryPlans(outcomes, progress.posts, connected.filter((a) => chosen.has(a.id)))
    if (plans.length === 0) return
    const again: PublishOutcome[] = []
    for (const plan of plans) again.push(...(await onPublish(plan.accountIds, caption.trim(), [plan.clipId])))
    const byClip = new Map(again.map((outcome) => [outcome.clipId, outcome]))
    setOutcomes(outcomes.map((outcome) => byClip.get(outcome.clipId) ?? outcome))
  }

  /** The post that carries this account's channel, once a publish is running. */
  const postFor = (account: SocialAccount): PostProgress | undefined =>
    progress.posts.find((post) => post.accountIds.includes(account.id)) ??
    progress.posts.find((post) => post.accountIds.length === 0 && post.platforms.includes(account.platform))

  const chosenLabels = speakList(
    PLATFORM_ORDER.filter((platform) => connected.some((a) => a.platform === platform && chosen.has(a.id))).map(labelOf),
  )
  const refusals = outcomes?.filter((outcome) => !outcome.ok) ?? []
  const words = idle
    ? `${ready.length} ${ready.length === 1 ? "clip" : "clips"} ready${
        cutting > 0 ? ` · ${cutting} still cutting (${cutting === 1 ? "it won't" : "they won't"} be posted)` : ""
      }`
    : phase === "publishing"
      ? `Uploading to ${chosenLabels}…`
      : phase === "published"
        ? `Published to ${chosenLabels}.`
        : phase === "sent"
          ? `Sent to ${chosenLabels} — waiting for ${chosenLabels.includes(" and ") ? "them" : chosenLabels} to confirm it's up. You can leave; it keeps going.`
          : "Try again sends the ones that didn't go."

  const rowClass = (index: number) => `flex items-center gap-3.5 py-4 ${index > 0 ? "border-t border-shborder" : ""}`
  let rowIndex = 0

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
          {[0, 1, 2, 3].map((i) => (
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
          {/* The channels, as the owner draws them: each platform's own
              mark, the account it posts as, and a switch — or, with no
              account yet, Connect. Off and unavailable are different states. */}
          <div>
            {PLATFORM_ORDER.map((platform) => {
              const label = labelOf(platform)
              const accounts = byPlatform.get(platform) ?? []
              if (accounts.length === 0) {
                const attempt = connecting.state.platform === platform ? connecting.state : null
                const waiting = attempt?.phase === "opening" || attempt?.phase === "waiting"
                const index = rowIndex++
                return (
                  <div key={platform} className={rowClass(index)} data-testid={`channel-${platform}`}>
                    <span className="opacity-40 grayscale">
                      <PlatformLogo platform={platform} size="sm" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-muted-foreground">{label}</span>
                      <span className={`block text-[14px] ${attempt?.phase === "failed" ? "text-destructive" : "text-muted-foreground/75"}`}>
                        {waiting ? "Finish signing in in the window that opened…" : attempt?.phase === "failed" ? attempt.error : "Not connected"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void connecting.connect(platform, connected)}
                      disabled={waiting || !idle}
                      aria-label={`Connect ${label}`}
                      className="flex h-[34px] min-w-[96px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold text-foreground ring-1 ring-shborder transition-colors hover:bg-shaccent disabled:opacity-60"
                    >
                      {waiting ? <Spinner size="sm" shade="inherit" aria-label="Connecting" /> : null}
                      {waiting ? "Connecting" : attempt?.phase === "failed" ? "Try again" : "Connect"}
                    </button>
                  </div>
                )
              }
              return accounts.map((account, accountIndex) => {
                const on = chosen.has(account.id)
                const wearsMark = marked === platform && accountIndex === 0
                const post = outcomes === null ? undefined : postFor(account)
                const line = rowWords(post, label, phase)
                const index = rowIndex++
                return (
                  <div key={account.id} className={rowClass(index)} data-testid={`channel-${platform}`}>
                    <span className="relative">
                      <PlatformLogo platform={account.platform} size="sm" />
                      <AnimatePresence>{wearsMark && <ConnectedMark key="mark" />}</AnimatePresence>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-foreground">{label}</span>
                      <span className={`block truncate text-[14px] ${post?.outcome === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                        {wearsMark ? (
                          <span className="font-medium text-shprimary">Connected</span>
                        ) : (
                          (line ?? (account.displayName ? `@${account.displayName.replace(/^@/, "")}` : "Connected"))
                        )}
                      </span>
                    </span>
                    {outcomes === null ? (
                      <ChannelToggle on={on} disabled={false} onToggle={() => toggle(account.id)} label={`Post to ${label}`} />
                    ) : (
                      <PostMark outcome={on ? (post?.outcome ?? "none") : "none"} settled={phase === "sent"} />
                    )}
                  </div>
                )
              })
            })}

            {/* What the switches add up to, in the owner's words. */}
            <p className="border-t border-shborder py-3.5 text-[14px] text-muted-foreground">
              {chosen.size === 0 ? (
                "No channels on — switch one on to post."
              ) : (
                <>
                  Every clip goes to <span className="font-semibold text-foreground">{chosen.size} {chosen.size === 1 ? "channel" : "channels"}</span>.
                </>
              )}
            </p>
          </div>

          {/* One caption for every post. Optional — an empty caption posts
              as an empty caption, it is never invented. Read-only once sent. */}
          <input
            type="text"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Add a caption (optional)"
            maxLength={2200}
            readOnly={!idle}
            className="mt-3 w-full rounded-2xl bg-shmuted px-4 py-3.5 text-sm outline-none ring-1 ring-shborder transition-shadow placeholder:text-muted-foreground focus:ring-ring read-only:text-muted-foreground"
          />

          <div className="mt-6 flex flex-col items-center gap-2.5">
            <PublishButton
              phase={phase}
              disabled={idle ? !canGo : busy}
              onClick={() => void (phase === "failed" ? retry() : publish())}
            />
            <button
              type="button"
              onClick={() => onSchedule(Array.from(chosen), caption.trim())}
              disabled={!canGo}
              className="w-full whitespace-nowrap rounded-full px-4 py-3.5 text-[15px] font-medium text-foreground ring-1 ring-shborder transition-colors hover:bg-shaccent disabled:opacity-50"
            >
              Schedule
            </button>
          </div>

          <p className="mt-3 min-h-5 text-center text-[13.5px] leading-snug text-muted-foreground" data-testid="publish-words">
            {words}
          </p>
          {refusals.length > 0 && (
            <div className="mt-3 w-full rounded-2xl bg-destructive/5 p-3 text-left ring-1 ring-destructive/20">
              {refusals.map((refusal) => (
                <p key={refusal.clipId} className="py-0.5 text-[12.5px] leading-snug text-destructive">
                  <span className="font-medium">{refusal.title}:</span> {refusal.detail}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * The half-hour slots the times panel offers. Plain and predictable: the
 * product has no audience analytics, so a "best time" here would be a
 * confident number with nothing behind it.
 */
export function postTimeSlots(): string[] {
  const slots: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    slots.push(`${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`)
  }
  return slots
}

/**
 * "When should it go out?" — the calendar beside its times, per the
 * owner's screen: pick a day on the left, a slot on the right, and the
 * line underneath says exactly what was chosen before anything commits.
 *
 * A slot already past on a day that is today is dropped from the list
 * rather than shown and refused — offering 9:00 AM at noon is an invitation
 * to a rejection.
 */
export function WhenTo({
  onBack,
  onCommit,
  busy,
  error,
  clipCount,
}: {
  onBack: () => void
  onCommit: (when: Date) => void
  busy: boolean
  /** A refusal from the last attempt, shown in place. */
  error: string | null
  /** How many clips this commitment covers, for the sentence underneath. */
  clipCount: number
}) {
  const now = useMemo(() => new Date(), [])
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [dayIso, setDayIso] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const slotsRef = useRef<HTMLDivElement | null>(null)

  const weeks = useMemo(() => monthGrid(view.year, view.month, now), [view, now])
  const atCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth()

  // Slots still in the future for the chosen day. A minute of lead time so
  // the commitment is not racing its own submission.
  const slots = useMemo(() => {
    const all = postTimeSlots()
    if (!dayIso) return all
    return all.filter((slot) => {
      const when = scheduleDate(dayIso, slot)
      return when !== null && when.getTime() - Date.now() >= 60 * 1000
    })
  }, [dayIso])

  // A day change can strip the slot that was chosen; never carry a stale one.
  useEffect(() => {
    if (time && !slots.includes(time)) setTime(null)
  }, [slots, time])

  /**
   * Open the list at 9am rather than midnight. Every slot is still there —
   * scrolling up reaches 12:00 AM — but the first thing seen should be an
   * hour someone would actually post at.
   */
  useEffect(() => {
    const panel = slotsRef.current
    if (!panel || time !== null) return
    const index = slots.indexOf("09:00")
    const row = index >= 0 ? (panel.children[index] as HTMLElement | undefined) : undefined
    if (row) panel.scrollTop = row.offsetTop - panel.offsetTop
  }, [slots, time])

  const when = time ? scheduleDate(dayIso, time) : null
  const canCommit = !busy && when !== null

  const step = (offset: number) =>
    setView((current) => {
      const next = new Date(current.year, current.month + offset, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })

  const chosenDay = dayIso ? scheduleDate(dayIso, "12:00") : null

  return (
    <div data-testid="publish-when">
      <div className="flex items-center gap-3 pb-5">
        <BackDisc onBack={onBack} label="Back to channels" />
        <h2 className="text-xl font-semibold tracking-tight">When should it go out?</h2>
      </div>

      <div className="overflow-hidden rounded-2xl ring-1 ring-shborder">
        <div className="flex flex-col sm:flex-row">
          {/* The month */}
          <div className="min-w-0 flex-1 p-4">
            <div className="flex items-center justify-between pb-3">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => step(-1)}
                disabled={atCurrentMonth}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-shaccent disabled:opacity-25"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <p className="text-[17px] font-semibold">{MONTH_NAMES[view.month]} {view.year}</p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => step(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-shaccent"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 pb-1 text-center">
              {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((label) => (
                <span key={label} className="py-1 text-[13px] font-medium text-muted-foreground">{label}</span>
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
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-[15px] tabular-nums transition-colors ${
                      dayIso === cell.iso
                        ? "bg-shprimary font-semibold text-primary-foreground"
                        : cell.disabled
                          ? "text-muted-foreground/35"
                          : "text-foreground hover:bg-shaccent"
                    } disabled:cursor-default`}
                  >
                    {cell.day}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* The times */}
          <div className="flex w-full shrink-0 flex-col border-t border-shborder p-4 sm:w-[190px] sm:border-l sm:border-t-0">
            <p className="pb-3 text-[16px] font-semibold">Post times</p>
            {/* Scrolls inside itself: a day's worth of slots must not make
                the panel grow past the commitment button. */}
            <div ref={slotsRef} className="flex max-h-[236px] flex-col gap-2 overflow-y-auto pr-0.5">
              {slots.length === 0 ? (
                <p className="text-[13px] leading-snug text-muted-foreground">
                  No slots left today — pick another day.
                </p>
              ) : (
                slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={time === slot}
                    disabled={dayIso === null}
                    onClick={() => setTime(slot)}
                    className={`w-full shrink-0 whitespace-nowrap rounded-xl px-3 py-2.5 text-center text-[15px] tabular-nums transition-colors ${
                      time === slot
                        ? "bg-shprimary font-semibold text-primary-foreground"
                        : "text-foreground ring-1 ring-shborder hover:bg-shaccent"
                    } disabled:opacity-40`}
                  >
                    {speakTime(slot)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* What was chosen, said back before it commits. Two reserved lines,
          so a refusal appearing cannot shove the button under the cursor. */}
      <div className="mt-4 min-h-[2.75rem]">
        <p className="text-[14.5px] leading-snug text-muted-foreground">
          {chosenDay ? (
            <>
              {clipCount === 1 ? "Your clip posts" : `All ${clipCount} clips post`} on{" "}
              <span className="font-semibold text-foreground">
                {chosenDay.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              {time ? (
                <>
                  {" at "}
                  <span className="font-semibold text-foreground">{speakTime(time)}</span>.
                </>
              ) : (
                ". Pick a time."
              )}
            </>
          ) : (
            "Pick a day, then a time."
          )}
        </p>
        {error && <p className="pt-1 text-[13px] text-destructive">{error}</p>}
      </div>

      <button
        type="button"
        onClick={() => when && onCommit(when)}
        disabled={!canCommit}
        className="mt-3 w-full whitespace-nowrap rounded-full bg-shprimary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground transition-[transform,opacity] active:scale-[0.98] disabled:bg-shmuted-foreground/40 disabled:text-white disabled:opacity-90"
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
  homeLabel = "Back to home",
}: {
  mode: "now" | "scheduled"
  /** The promised local time, for mode 'scheduled'. */
  when: Date | null
  outcomes: PublishOutcome[]
  onRetryFailed: (() => void) | null
  onHome: () => void
  busy: boolean
  /** What leaving says: "home" from the theater, "your moments" from the feed's dialog. */
  homeLabel?: string
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
        {homeLabel}
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
      // The posts the server named: what the Publish control reads its
      // truth from afterwards. A schedule makes none yet.
      const posts = result.scheduled
        ? []
        : (result.posts ?? []).map((post) => ({ id: post.id, status: post.status, platforms: (post.targets ?? []).map((target) => target.platform) }))
      outcomes.push({ clipId: clip.id, title: clip.title, ok: true, detail, posts })
    } catch (cause) {
      outcomes.push({
        clipId: clip.id,
        title: clip.title,
        ok: false,
        detail: cause instanceof ApiError ? cause.message : "Something went wrong submitting this clip.",
        posts: [],
      })
    }
  }
  return outcomes
}
