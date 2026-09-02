"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type WheelEvent as ReactWheelEvent } from "react"
import { motion, type PanInfo } from "motion/react"
import { Check, Volume2, VolumeX, X } from "lucide-react"
import { PublishGlyph } from "@/components/clip-action-icons"
import { ClipComposition, centredComposition } from "@/components/media/clip-composition"
import { VerticalFrame } from "@/components/media/vertical-frame"
import type { Clip, ClipComposition as Composition, ClipMatch, ClipRequest, Video } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { Exchange } from "./types"

/**
 * The moment feed — the owner's screen and stack component of 2026-09-02.
 *
 * A fan of 9:16 cards, one in front: the moment before leans away above it,
 * the one after leans away below, each a step smaller and fainter. The
 * person scrolls, drags the front card, or presses a key to move through
 * them. Moving DOWN past a moment skips it; moving back UP onto a skipped
 * moment un-skips it. ✓ keeps the moment — it goes to the library, and
 * that is final here, so a kept moment cannot be scrolled back onto. The
 * button on the card's corner PUBLISHES the moment: it is kept, and the
 * owner's "Where do they go?" screens open for it (the owner's call,
 * 2026-09-02, replacing the re-cut control that sat there; a re-cut is
 * asked for in the dialogue — "re-cut this one").
 *
 * Every moment in the feed is one the server already cut; the front card
 * plays the finished file, or the source seeked to the moment while a cut
 * is on its way. The counter at the left is the position in the feed; the
 * dots at the right are the feed itself, and a dot for a skipped moment
 * brings it back.
 *
 * Hand-rolled on purpose, like the theater before it: a feed of footage is
 * not interface furniture, and no Astryx surface is a card fan. The ratio
 * box is Astryx's, the physics are motion's (the app's own animation
 * library), and the buttons beneath are plain circles in the workspace's
 * tokens.
 */

/** What the card plays. */
export interface PreviewSource {
  url: string
  start: number
  end: number | null
  /** The same framing the still used and the export will use. */
  composition: Composition
  sourceAspectRatio: string | null
  /** True for the rendered file; false when the source stands in for it. */
  finished: boolean
}

export interface FeedMoment {
  requestId: string
  match: ClipMatch
  clip: Clip | null
  /** The picture shown while the card is not the one in front. */
  still: string | null
  preview: PreviewSource | null
  decision: "kept" | "skipped" | null
  /** The system is reworking this moment; its decision is still open. */
  reworking: boolean
}

function clipForMatch(match: ClipMatch, clips: Clip[]): Clip | null {
  const clipId = match.clip?.id
  if (!clipId) return null
  return clips.find((clip) => clip.id === clipId && clip.status === "ready" && clip.url) ?? null
}

/**
 * What the card plays for a moment.
 *
 * The finished, framed file when it exists. For a vertical moment only the
 * 9:16 derivative counts; the landscape cut is never shown in its place.
 * Otherwise the source — the watchable proxy when there is one — seeked to
 * the moment and shown THROUGH the same framing. Deciding whether to keep a
 * clip you cannot watch is not a decision.
 */
export function previewFor(
  match: ClipMatch,
  clips: Clip[],
  video: Video | null,
  request: ClipRequest | null | undefined,
): PreviewSource | null {
  const clip = clipForMatch(match, clips)
  const sourceAspectRatio =
    clip?.media?.sourceAspectRatio ?? (video?.width && video?.height ? `${video.width}:${video.height}` : null)
  // Framed as the server decided — the export is cut from the same numbers.
  // Before it has decided, a platform request is 9:16 at the centre.
  const composition =
    clip?.media?.composition ?? centredComposition(request?.deck != null ? "9:16" : (sourceAspectRatio ?? "16:9"))
  const finished = clip?.media ? clip.media.url : (clip?.url ?? null)
  if (finished) return { url: finished, start: 0, end: null, composition, sourceAspectRatio, finished: true }
  const source = video?.playback?.proxyUrl ?? video?.playback?.url
  if (!source) return null
  return { url: source, start: match.startSeconds, end: match.endSeconds, composition, sourceAspectRatio, finished: false }
}

/**
 * The feed: every moment of every question, in the order they were asked,
 * strongest first within a question. Decided moments stay — they are what
 * the person scrolls back over — so the feed is a record, not a queue.
 */
export function feedMoments(exchanges: Exchange[], video: Video | null): FeedMoment[] {
  return exchanges.flatMap(({ request, clips }) =>
    [...(request.matches ?? [])]
      .sort((a, b) => b.confidence - a.confidence)
      .map((match): FeedMoment => {
        const clip = clipForMatch(match, clips)
        return {
          requestId: request.id,
          match,
          clip,
          still: clip?.media?.posterUrl ?? match.thumbnailUrl ?? null,
          preview: previewFor(match, clips, video, request),
          decision: match.feedback === "approved" ? "kept" : match.feedback === "rejected" ? "skipped" : null,
          reworking: match.reclipStatus === "pending",
        }
      }),
  )
}

/** The card in front: the first moment nobody has decided on. Past the end once every one is decided. */
export function feedCursor(moments: FeedMoment[]): number {
  const index = moments.findIndex((moment) => moment.decision === null)
  return index === -1 ? moments.length : index
}

/**
 * What identifies a file behind a signed URL: its path. A re-signed link
 * changes only the query (signature, expiry); a re-cut writes a NEW file at
 * a new path. So the path is what the front card keys its player by —
 * ignore the one, restart on the other.
 */
export function mediaIdentity(url: string): string {
  try {
    return new URL(url, "http://clipit.invalid").pathname
  } catch {
    return url
  }
}

const asClock = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

const twoDigits = (n: number) => String(n).padStart(2, "0")

/**
 * The card's width in Astryx's 4px units (w-64 = 256px, w-52 = 208px on a
 * phone, where the shell's padding leaves 318px for the card and the
 * counter beside it); its height follows from 9:16. Sized so the fan and
 * the two decisions fit a 900px-tall window with the header above them — a control below the fold is a control nobody presses. The
 * fan's offsets come from the card's MEASURED height, so the phone's
 * smaller card fans the same way; this constant only stands in before the
 * first measurement.
 */
const CARD_UNITS = 64
const CARD_HEIGHT_PX = (CARD_UNITS * 4 * 16) / 9
/** One navigation at a time: a flick of the wheel is many events. */
const NAVIGATION_COOLDOWN_MS = 400
const DRAG_THRESHOLD_PX = 50
const WHEEL_THRESHOLD_PX = 30
const SPRING = { type: "spring", stiffness: 300, damping: 30, mass: 1 } as const

/**
 * Where a card sits in the fan, by its distance from the front. The owner's
 * stack: a step back is smaller, fainter and tilted away; two steps is
 * further still; beyond that a card is not drawn. Offsets are fractions of
 * the card's height — geometry, not design values.
 */
function fanStyle(diff: number, cardHeight: number) {
  const step = Math.sign(diff)
  if (diff === 0) return { y: 0, scale: 1, opacity: 1, rotateX: 0, zIndex: 5 }
  if (Math.abs(diff) === 1) return { y: step * 0.34 * cardHeight, scale: 0.82, opacity: 0.6, rotateX: -step * 8, zIndex: 4 }
  return { y: step * 0.58 * cardHeight, scale: 0.7, opacity: 0.3, rotateX: -step * 15, zIndex: 3 }
}

/**
 * The front card's picture, playing.
 *
 * The URL is pinned at the value it started with. The page polls while a
 * video is still being read and while a cut is on its way, and every poll
 * re-signs the playback URLs — bound straight to the element, the newest
 * one reloaded the player every two seconds and threw the moment back to
 * its start. The newest value is taken only when the pinned one fails
 * (an expired link), which is what the theater's VideoStage did too. The
 * caller keys this component by moment and by the FILE's identity (its
 * path — see mediaIdentity), so a re-cut's new file, or the finished file
 * arriving in place of the source, starts afresh, while a re-signed link
 * to the same file does not.
 */
function FeedVideo({
  source,
  still,
  muted,
  style,
  label,
}: {
  source: PreviewSource
  still: string | null
  muted: boolean
  style: CSSProperties
  label: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [pinnedUrl, setPinnedUrl] = useState(source.url)
  const latestUrl = useRef(source.url)
  latestUrl.current = source.url

  useEffect(() => {
    const element = ref.current
    if (element) element.currentTime = source.start
  }, [pinnedUrl, source.start])

  return (
    <video
      ref={ref}
      src={source.finished ? pinnedUrl : `${pinnedUrl}#t=${source.start}`}
      data-testid="feed-video"
      onError={() => {
        // The pinned link no longer works; the freshest one gets its turn.
        if (latestUrl.current !== pinnedUrl) setPinnedUrl(latestUrl.current)
      }}
      poster={still ?? undefined}
      aria-label={label}
      muted={muted}
      autoPlay
      loop={source.finished}
      playsInline
      className="h-full w-full bg-black"
      style={style}
      onTimeUpdate={(event) => {
        // The source stands in for an unfinished cut: play the moment, then
        // the moment again — never the rest of the video.
        const element = event.currentTarget
        if (source.end !== null && element.currentTime >= source.end) element.currentTime = source.start
      }}
    />
  )
}

/**
 * One card's face. A 9:16 stage; on it, the moment in its OWN shape — a
 * vertical moment fills the stage, a landscape one sits across its middle.
 * The shape comes from the server's composition, the same numbers the
 * export is cut from; nothing here crops or letterboxes on its own.
 */
function CardFace({
  moment,
  front,
  muted,
  children,
}: {
  moment: FeedMoment
  front: boolean
  muted: boolean
  children?: React.ReactNode
}) {
  const label = moment.match.description || "A moment from your video"
  const composition = moment.preview?.composition ?? moment.clip?.media?.composition ?? centredComposition("9:16")
  const sourceAspectRatio = moment.preview?.sourceAspectRatio ?? moment.clip?.media?.sourceAspectRatio ?? null
  const finished = moment.preview?.finished ?? true
  return (
    <VerticalFrame isVertical className="rounded-3xl bg-black shadow-2xl ring-1 ring-foreground/10">
      <div role="group" aria-label={label} data-testid={front ? "feed-card" : undefined} className="relative h-full w-full">
        <div className="flex h-full w-full items-center">
          <ClipComposition composition={composition} sourceAspectRatio={sourceAspectRatio} finished={finished} className="w-full">
            {(mediaStyle) =>
              front && moment.preview ? (
                <FeedVideo
                  key={`${moment.match.id}:${moment.preview.finished ? "file" : "source"}:${mediaIdentity(moment.preview.url)}`}
                  source={moment.preview}
                  still={moment.still}
                  muted={muted}
                  style={mediaStyle}
                  label={label}
                />
              ) : moment.still ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={moment.still} alt="" draggable={false} className="h-full w-full select-none bg-black" style={mediaStyle} />
              ) : (
                <p className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/70">{label}</p>
              )
            }
          </ClipComposition>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />
        <p className="pointer-events-none absolute bottom-3 right-3 z-10 text-sm font-medium text-white">
          {asClock(moment.match.durationSeconds)}
        </p>
        {moment.decision && !front && (
          // Low enough to clear the strip the stage clips off a card leaning
          // away above the front one: that band is all of it that shows.
          <span className="absolute left-3 top-16 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            {moment.decision === "kept" ? (
              <>
                <Check aria-hidden size={12} strokeWidth={3} /> Kept
              </>
            ) : (
              <>
                <X aria-hidden size={12} strokeWidth={3} /> Skipped
              </>
            )}
          </span>
        )}
        {children}
      </div>
    </VerticalFrame>
  )
}

function EndCard({ canGoBack, onUploadMore }: { canGoBack: boolean; onUploadMore: () => void }) {
  return (
    <VerticalFrame isVertical className="rounded-3xl border border-border bg-card shadow-2xl">
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center" data-testid="feed-end">
        <p className="text-lg font-semibold text-foreground">That&apos;s every moment</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {canGoBack
            ? "Scroll up to revisit the last one you skipped, ask for another, or keep going."
            : "Ask for another, or keep going with what you kept."}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={onUploadMore}
            className="w-full whitespace-nowrap rounded-full bg-foreground py-3 text-sm font-semibold text-background transition hover:bg-foreground/90"
          >
            Upload more video
          </button>
          <a
            href="/clips"
            className="w-full whitespace-nowrap rounded-full border border-border py-3 text-center text-sm font-medium text-foreground transition hover:border-foreground"
          >
            Go to your library
          </a>
        </div>
      </div>
    </VerticalFrame>
  )
}

export interface MomentFeedProps {
  moments: FeedMoment[]
  /** Another decision is being written; the controls wait for it. */
  busy?: boolean
  onKeep: (moment: FeedMoment) => void
  onSkip: (moment: FeedMoment) => void
  /** Scrolling back onto a skipped moment, or pressing its dot, brings it back. */
  onUndoSkip: (moment: FeedMoment) => void
  /** Keep the moment and send it to socials. Only a moment whose cut is finished can go. */
  onPublish: (moment: FeedMoment) => void
  onUploadMore: () => void
  /** Something else has the screen — the publish dialog — and no key, wheel or drag decides a moment behind it. */
  paused?: boolean
}

export function MomentFeed({ moments, busy = false, paused = false, onKeep, onSkip, onUndoSkip, onPublish, onUploadMore }: MomentFeedProps) {
  const cursor = feedCursor(moments)
  const total = moments.length
  const top = moments[cursor]
  const prev = cursor > 0 ? moments[cursor - 1] : undefined
  const reworking = top?.reworking ?? false
  // A kept moment is in the library; the feed cannot take it back. Only a
  // skip is undone by scrolling up onto it.
  const canGoBack = prev?.decision === "skipped" && !busy && !paused
  const canDecide = top !== undefined && !reworking && !busy && !paused

  const lastNavigation = useRef(0)
  const [muted, setMuted] = useState(true)

  // The card's real height, for the fan's offsets: it differs between a
  // phone and a desk, and a fan drawn for the wrong height overlaps or gaps.
  const stageRef = useRef<HTMLDivElement>(null)
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_PX)
  useEffect(() => {
    const measure = () => {
      const card = stageRef.current?.querySelector<HTMLElement>("[data-feed-card]")
      if (card && card.offsetHeight > 0) setCardHeight(card.offsetHeight)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [total])

  const keep = useCallback(() => {
    if (canDecide && top) onKeep(top)
  }, [canDecide, top, onKeep])
  const skip = useCallback(() => {
    if (canDecide && top) onSkip(top)
  }, [canDecide, top, onSkip])
  const back = useCallback(() => {
    if (canGoBack && prev) onUndoSkip(prev)
  }, [canGoBack, prev, onUndoSkip])

  /**
   * One decision per beat, for the inputs that repeat on their own: a flick
   * of the wheel is many events and a held key repeats, and either could
   * keep or skip several moments before the person let go — a keep is
   * final. A button press is a decision in itself and is never held back:
   * a quick keep and then a skip on the next card are both meant.
   */
  const oncePerBeat = useCallback((action: () => void) => {
    const now = Date.now()
    if (now - lastNavigation.current < NAVIGATION_COOLDOWN_MS) return
    lastNavigation.current = now
    action()
  }, [])

  /** Down is the next moment (skipping this one); up is the last skip, taken back. */
  const navigate = useCallback(
    (direction: 1 | -1) => oncePerBeat(direction > 0 ? skip : back),
    [oncePerBeat, skip, back],
  )
  const keepOnce = useCallback(() => oncePerBeat(keep), [oncePerBeat, keep])

  // The keyboard: → keep, ← or ↓ skip, ↑ (or Backspace, or u) back — unless
  // the person is typing somewhere, or a dialog has the screen: a key
  // pressed on a dialog's button is that dialog's, never a decision about
  // the moment hidden behind it. A held key is one press.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (paused) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      if (target?.closest?.('[role="dialog"]')) return
      if (event.repeat) return
      if (event.key === "ArrowRight") keepOnce()
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") navigate(1)
      else if (event.key === "ArrowUp" || event.key === "Backspace" || event.key === "u") navigate(-1)
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [keepOnce, navigate, paused])

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < -DRAG_THRESHOLD_PX) navigate(1)
    else if (info.offset.y > DRAG_THRESHOLD_PX) navigate(-1)
  }
  // On the stage, not the window: a wheel over the dialogue beside the feed
  // scrolls the dialogue and must not skip a moment.
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) > WHEEL_THRESHOLD_PX) navigate(event.deltaY > 0 ? 1 : -1)
  }

  // Publishing sends the FINISHED file — for a vertical moment the 9:16
  // derivative, never the landscape cut in its place — so a moment whose
  // card is still playing the source in that file's stead cannot go yet.
  const finished = top?.preview?.finished === true
  const derivativeFailed = top?.clip?.media?.derivativeStatus === "failed"
  const canPublish = top !== undefined && finished && !paused && !reworking && !busy
  const publishTitle = reworking
    ? "Reworking this edit…"
    : derivativeFailed
      ? "The vertical cut failed — ask for a re-cut, or skip it"
      : !finished
        ? "Still cutting — publish once it's ready"
        : "Publish — send this moment to your socials"

  if (total === 0) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center justify-center py-16 text-center" data-testid="feed-empty">
        <p className="text-lg font-semibold text-foreground">No moments yet</p>
        <p className="mt-1 max-w-64 text-sm text-muted-foreground">Ask for a moment, or upload more video.</p>
        <button
          type="button"
          onClick={onUploadMore}
          className="mt-6 w-full max-w-72 whitespace-nowrap rounded-full bg-foreground py-3 text-sm font-semibold text-background transition hover:bg-foreground/90"
        >
          Upload more video
        </button>
      </div>
    )
  }

  // The cards: every moment, then the end card. Only the front card and two
  // neighbours each way are drawn.
  const cards = [...moments.map((moment) => ({ key: moment.match.id, moment })), { key: "end", moment: null as FeedMoment | null }]

  return (
    <div className="flex w-full max-w-110 shrink-0 flex-col items-center sm:w-110" data-testid="moment-feed">
      <div
        ref={stageRef}
        className="relative flex h-140 w-full items-center justify-center overflow-hidden"
        style={{ perspective: "1200px" }}
        onWheel={onWheel}
      >
        {/* Position in the feed, in the left gutter. */}
        <div className="absolute left-0 top-1/2 flex w-14 -translate-y-1/2 flex-col items-center sm:w-20" aria-live="polite">
          <span className="text-3xl font-light tabular-nums text-foreground sm:text-4xl" data-testid="feed-position">
            {twoDigits(Math.min(cursor + 1, total))}
          </span>
          <span aria-hidden className="my-2 h-px w-8 bg-foreground/20" />
          <span className="text-sm tabular-nums text-muted-foreground" data-testid="feed-total">
            {twoDigits(total)}
          </span>
        </div>

        {/* The feed itself, in the right gutter: one dot per moment, the front one stretched. A skipped moment's dot brings it back. */}
        <div className="absolute right-0 top-1/2 flex w-14 -translate-y-1/2 flex-col items-center gap-2 sm:w-20" data-testid="feed-dots">
          {moments.map((moment, index) => {
            const front = index === cursor
            const className = cn(
              "w-2 rounded-full transition-all duration-300",
              front ? "h-6 bg-foreground" : "h-2 bg-foreground/30",
            )
            if (index < cursor && moment.decision === "skipped") {
              return (
                <button
                  key={moment.match.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onUndoSkip(moment)}
                  aria-label={`Bring back: ${moment.match.description || "a skipped moment"}`}
                  className={cn(className, "hover:bg-foreground/50")}
                />
              )
            }
            return <span key={moment.match.id} aria-hidden className={className} />
          })}
        </div>

        {cards.map(({ key, moment }, index) => {
          const diff = index - cursor
          if (Math.abs(diff) > 2) return null
          const front = diff === 0
          const style = fanStyle(diff, cardHeight)
          return (
            <motion.div
              key={key}
              data-feed-card
              className={cn("absolute w-52 sm:w-64", front && canDecide && "cursor-grab active:cursor-grabbing")}
              initial={false}
              animate={style}
              transition={SPRING}
              drag={front && (canDecide || canGoBack) ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={onDragEnd}
              style={{ transformStyle: "preserve-3d", zIndex: style.zIndex }}
              aria-hidden={!front}
            >
              {moment ? (
                <CardFace moment={moment} front={front} muted={muted}>
                  {front && (
                    <>
                      <button
                        type="button"
                        onClick={() => onPublish(moment)}
                        disabled={!canPublish}
                        aria-label="Publish — send this moment to your socials"
                        title={publishTitle}
                        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:cursor-default disabled:opacity-60"
                      >
                        <PublishGlyph />
                      </button>
                      {moment.preview && (
                        <button
                          type="button"
                          onClick={() => setMuted((value) => !value)}
                          aria-pressed={!muted}
                          aria-label={muted ? "Unmute" : "Mute"}
                          title={muted ? "Unmute" : "Mute"}
                          className="absolute bottom-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
                        >
                          {muted ? <VolumeX aria-hidden size={16} /> : <Volume2 aria-hidden size={16} />}
                        </button>
                      )}
                      {reworking && (
                        <div
                          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-black/60 text-white backdrop-blur-sm"
                          data-testid="reworking-overlay"
                        >
                          <p className="text-sm font-medium">Reworking this edit…</p>
                          <p className="text-xs text-white/70">Same moment, new direction</p>
                        </div>
                      )}
                      {moment.match.reclipStatus === "failed" && moment.match.reclipError && (
                        <p className="absolute inset-x-3 bottom-12 z-10 rounded-xl bg-black/70 px-3 py-2 text-xs leading-snug text-white">
                          {moment.match.reclipError}
                        </p>
                      )}
                    </>
                  )}
                </CardFace>
              ) : (
                <EndCard canGoBack={canGoBack} onUploadMore={onUploadMore} />
              )}
            </motion.div>
          )
        })}
      </div>

      {top && (
        <div className="mt-6 flex items-center justify-center gap-8" data-testid="feed-controls">
          <button
            type="button"
            onClick={skip}
            disabled={!canDecide}
            aria-label="Skip — not useful, move on"
            title="Skip"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-border text-foreground transition hover:border-foreground disabled:opacity-40"
          >
            <X aria-hidden size={22} />
          </button>
          <button
            type="button"
            onClick={keep}
            disabled={!canDecide}
            aria-label="Keep — save this clip to your library"
            title="Keep"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-background transition hover:bg-foreground/90 disabled:opacity-40"
          >
            <Check aria-hidden size={26} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}
