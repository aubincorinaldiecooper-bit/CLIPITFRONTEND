"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject, type WheelEvent as ReactWheelEvent } from "react"
import { motion, type PanInfo } from "motion/react"
import { Check, ChevronDown, Pause, Play, Volume2, VolumeX, X } from "lucide-react"
import { DownloadGlyph, PublishGlyph } from "@/components/clip-action-icons"
import { ClipComposition, centredComposition } from "@/components/media/clip-composition"
import { VerticalFrame } from "@/components/media/vertical-frame"
import type { Clip, ClipComposition as Composition, ClipMatch, ClipRequest, Video } from "@/lib/types"
import { cn } from "@/lib/utils"
import { clipRowFor, downloadUrlOf, productionOf, type Production } from "./production"
import type { Exchange } from "./types"

/**
 * The moment feed — the owner's screen and stack component of 2026-09-02,
 * with the rules of 2026-09-05.
 *
 * A fan of 9:16 cards, one in front: the moment before leans away above it,
 * the one after leans away below, each a step smaller and fainter. The
 * person scrolls, drags the front card, or presses a key to move through
 * them. Moving DOWN past an undecided moment skips it; moving back UP onto
 * a skipped moment un-skips it. ✓ KEEPS the moment, and keeping is
 * production: the cut, the framing and the 9:16 file are made from that
 * press, and the card stays where it is, saying so, until the person moves
 * on — a kept moment remains in the feed to be watched, downloaded and
 * published. The controls on the card's corner: Publish (keep, make the
 * file, and open the owner's "Where do they go?" screens for it) and, once
 * the file exists, Download.
 *
 * A moment is the evidence — a stretch of the source video — and the front
 * card plays exactly that stretch from the source, through the 9:16 frame,
 * with a play/pause control in the middle and the time within the moment
 * beside it. When the file has been made the card plays the file instead.
 * The counter at the left is the position in the feed; the dots at the
 * right are the feed itself, and each one goes to its moment.
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
  /** True for the finished file; false when the source stands in for it. */
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
  /** Where the kept moment's file is; null when none was asked for. */
  production: Production | null
  /** The finished file, signed to be saved; null until it exists. */
  downloadUrl: string | null
  /** The system is reworking this moment; its decision is still open. */
  reworking: boolean
}

/**
 * The clip row recorded for a moment, in whatever state it is in. By the
 * id the match names; failing that, by the match the row names — a clip
 * just made on Keep is in the conversation before the match has been
 * re-read with its id, and an already-finished one never prompts a
 * re-read at all (Devin's finding on #87).
 */
function clipForMatch(match: ClipMatch, clips: Clip[]): Clip | null {
  return clipRowFor(match, clips)
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
  // Before it has decided, 9:16 at the centre, for every request.
  //
  // This used to guess the SOURCE shape when the request named no platform,
  // which is how a wide clip ended up in a tall card looking broken: the card
  // is fixed at 9:16, so a 16:9 guess drew a narrow band floating in black.
  // Every clip is vertical now (owner's rule, 2026-09-03), so the guess before
  // the server answers is the same shape as the answer.
  const composition = clip?.media?.composition ?? centredComposition("9:16")
  const produced = productionOf(clip, match.clip) === "produced"
  const finished = produced ? (clip?.media ? clip.media.url : (clip?.url ?? null)) : null
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
          production: productionOf(clip, match.clip),
          downloadUrl: downloadUrlOf(clip),
          reworking: match.reclipStatus === "pending",
        }
      }),
  )
}

/** Where the feed opens: the first moment nobody has decided on. Past the end once every one is decided. */
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

/** m:ss, for a position or a length within a moment. */
export const asClock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
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
/** How long the play/pause control stays after a touch while the moment plays. */
const CONTROL_LINGER_MS = 1600
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

/** What the media element reports, relative to the moment. */
interface Playback {
  playing: boolean
  /** Seconds into the moment. */
  current: number
  /** The moment's length. */
  total: number
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
 *
 * What it reports — playing or not, how far into the moment, how long the
 * moment is — comes from the element's own events, never from a clock of
 * ours: a stall, a seek and a slow network all show as what they are.
 */
function FeedVideo({
  source,
  still,
  muted,
  style,
  label,
  videoRef,
  onPlayback,
}: {
  source: PreviewSource
  still: string | null
  muted: boolean
  style: CSSProperties
  label: string
  videoRef: RefObject<HTMLVideoElement | null>
  onPlayback: (playback: Playback) => void
}) {
  const [pinnedUrl, setPinnedUrl] = useState(source.url)
  const latestUrl = useRef(source.url)
  latestUrl.current = source.url

  useEffect(() => {
    const element = videoRef.current
    if (element) element.currentTime = source.start
  }, [pinnedUrl, source.start, videoRef])

  const report = (element: HTMLVideoElement) => {
    const offset = source.finished ? 0 : source.start
    const length = source.finished
      ? Number.isFinite(element.duration) ? element.duration : 0
      : Math.max(0, (source.end ?? source.start) - source.start)
    onPlayback({
      playing: !element.paused && !element.ended,
      current: Math.min(Math.max(0, element.currentTime - offset), length || Number.POSITIVE_INFINITY),
      total: length,
    })
  }

  return (
    <video
      ref={videoRef}
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
      // The source stands in for the file inside a frame it does not fill;
      // what shows around it is the card's own fill, not black bars.
      className={cn("h-full w-full", source.finished ? "bg-black" : "bg-transparent")}
      style={style}
      onLoadedMetadata={(event) => report(event.currentTarget)}
      onPlay={(event) => report(event.currentTarget)}
      onPause={(event) => report(event.currentTarget)}
      onEnded={(event) => report(event.currentTarget)}
      onSeeked={(event) => report(event.currentTarget)}
      onTimeUpdate={(event) => {
        // The source stands in for an unfinished cut: play the moment, then
        // the moment again — never the rest of the video.
        const element = event.currentTarget
        if (source.end !== null && element.currentTime >= source.end) element.currentTime = source.start
        report(element)
      }}
    />
  )
}

/**
 * The front card's media and the controls that belong to it: the moment
 * playing through its frame, play/pause in the middle, the time within the
 * moment at the bottom right, sound at the bottom left. Keyed by the caller
 * on the file's identity, so a new file starts from nothing.
 */
function FrontMedia({
  moment,
  source,
  muted,
  onToggleMute,
  label,
}: {
  moment: FeedMoment
  source: PreviewSource
  muted: boolean
  onToggleMute: () => void
  label: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playback, setPlayback] = useState<Playback>({
    playing: false,
    current: 0,
    total: source.finished ? 0 : Math.max(0, (source.end ?? source.start) - source.start),
  })
  // The control shows while the moment is paused, and after a touch while
  // it plays; then it leaves, so the footage is the picture.
  const [lingering, setLingering] = useState(true)
  const lingerTimer = useRef<number | undefined>(undefined)
  const linger = useCallback(() => {
    setLingering(true)
    window.clearTimeout(lingerTimer.current)
    lingerTimer.current = window.setTimeout(() => setLingering(false), CONTROL_LINGER_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(lingerTimer.current), [])
  useEffect(() => {
    if (playback.playing) linger()
  }, [playback.playing, linger])

  const toggle = () => {
    const element = videoRef.current
    if (!element) return
    linger()
    if (element.paused || element.ended) {
      // A play the browser refuses (no gesture yet, a stalled load) is
      // reported by the element's own events, not thrown at the page.
      void element.play()?.catch(() => undefined)
    } else {
      element.pause()
    }
  }

  return (
    <>
      {!source.finished && moment.still && (
        // The source stands in for the file inside the 9:16 frame. Behind
        // its letterboxed picture, the moment's own still spread and blurred
        // — the way the finished file fills that frame — instead of black.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={moment.still} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl" />
      )}
      {/* A tap on the picture is play/pause, like every vertical player. */}
      <div className="relative flex h-full w-full cursor-pointer items-center" onClick={toggle} onPointerMove={linger}>
        <ClipComposition composition={source.composition} sourceAspectRatio={source.sourceAspectRatio} finished={source.finished} className="w-full">
          {(mediaStyle) => (
            <FeedVideo videoRef={videoRef} source={source} still={moment.still} muted={muted} style={mediaStyle} label={label} onPlayback={setPlayback} />
          )}
        </ClipComposition>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-label={playback.playing ? "Pause" : "Play"}
        title={playback.playing ? "Pause" : "Play"}
        data-testid="feed-playpause"
        className={cn(
          "absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity duration-300 hover:bg-black/70 focus-visible:opacity-100",
          playback.playing && !lingering && "opacity-0",
        )}
      >
        {playback.playing ? <Pause aria-hidden size={22} fill="currentColor" /> : <Play aria-hidden size={22} fill="currentColor" className="ml-0.5" />}
      </button>
      <p className="pointer-events-none absolute bottom-3 right-3 z-10 text-sm font-medium tabular-nums text-white" data-testid="feed-time">
        {asClock(playback.current)} / {asClock(playback.total)}
      </p>
      <button
        type="button"
        onClick={onToggleMute}
        aria-pressed={!muted}
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
        className="absolute bottom-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
      >
        {muted ? <VolumeX aria-hidden size={16} /> : <Volume2 aria-hidden size={16} />}
      </button>
    </>
  )
}

/** The badge on a decided card: what was decided, and for a kept one, where its file is. */
function decisionWords(moment: FeedMoment): string {
  if (moment.decision === "skipped") return "Skipped"
  if (moment.production === "producing") return "Kept · cutting…"
  if (moment.production === "failed") return "Kept · cut failed"
  return "Kept"
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
  onToggleMute,
  children,
}: {
  moment: FeedMoment
  front: boolean
  muted: boolean
  onToggleMute: () => void
  children?: React.ReactNode
}) {
  const label = moment.match.description || "A moment from your video"
  const composition = moment.preview?.composition ?? moment.clip?.media?.composition ?? centredComposition("9:16")
  const sourceAspectRatio = moment.preview?.sourceAspectRatio ?? moment.clip?.media?.sourceAspectRatio ?? null
  const finished = moment.preview?.finished ?? true
  return (
    <VerticalFrame isVertical className="rounded-3xl bg-black shadow-2xl ring-1 ring-foreground/10">
      <div role="group" aria-label={label} data-testid={front ? "feed-card" : undefined} className="relative h-full w-full overflow-hidden rounded-3xl">
        {front && moment.preview ? (
          <FrontMedia
            key={`${moment.match.id}:${moment.preview.finished ? "file" : "source"}:${mediaIdentity(moment.preview.url)}`}
            moment={moment}
            source={moment.preview}
            muted={muted}
            onToggleMute={onToggleMute}
            label={label}
          />
        ) : (
          <div className="flex h-full w-full items-center">
            <ClipComposition composition={composition} sourceAspectRatio={sourceAspectRatio} finished={finished} className="w-full">
              {(mediaStyle) =>
                moment.still ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={moment.still} alt="" draggable={false} className="h-full w-full select-none bg-black" style={mediaStyle} />
                ) : (
                  <p className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/70">{label}</p>
                )
              }
            </ClipComposition>
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />
        {!(front && moment.preview) && (
          <p className="pointer-events-none absolute bottom-3 right-3 z-10 text-sm font-medium tabular-nums text-white">
            {asClock(moment.match.durationSeconds)}
          </p>
        )}
        {moment.decision && (
          // On the front card, in the corner the actions leave free. On a
          // card leaning away above it, low enough to clear the strip the
          // stage clips off: that band is all of it that shows.
          <span
            data-testid={front ? "feed-decision" : undefined}
            className={cn(
              "absolute left-3 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white",
              front ? "top-3" : "top-16",
            )}
          >
            {moment.decision === "kept" ? <Check aria-hidden size={12} strokeWidth={3} /> : <X aria-hidden size={12} strokeWidth={3} />}
            {decisionWords(moment)}
          </span>
        )}
        {children}
      </div>
    </VerticalFrame>
  )
}

/**
 * The card after the last moment. The moments are still there — a tester
 * on 2026-09-04 came back from publishing to this card and read it as her
 * moments being gone — so it says so, and offers the way back to them.
 */
function EndCard({ canGoBack, onBack, onUploadMore }: { canGoBack: boolean; onBack: () => void; onUploadMore: () => void }) {
  return (
    <VerticalFrame isVertical className="rounded-3xl border border-border bg-card shadow-2xl">
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center" data-testid="feed-end">
        <p className="text-lg font-semibold text-foreground">That&apos;s every moment</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {canGoBack
            ? "They're all still here to watch, download or publish. Ask for another, or keep going."
            : "Ask for another, or keep going with what you kept."}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full whitespace-nowrap rounded-full border border-border py-3 text-sm font-semibold text-foreground transition hover:border-foreground"
            >
              Look back over them
            </button>
          )}
          {/* Only the way on: the library is hidden for now (owner,
              2026-09-02), so nothing here leads to it. */}
          <button
            type="button"
            onClick={onUploadMore}
            className="w-full whitespace-nowrap rounded-full bg-foreground py-3 text-sm font-semibold text-background transition hover:bg-foreground/90"
          >
            Upload more video
          </button>
        </div>
      </div>
    </VerticalFrame>
  )
}

/** The card that stands where the first moment will: a search is running and nothing has been found yet. */
function SearchingCard() {
  return (
    <VerticalFrame isVertical className="rounded-3xl border border-border bg-card shadow-2xl">
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center" data-testid="feed-searching">
        <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-foreground/60" />
        <p className="text-sm leading-relaxed text-muted-foreground">Moments land here once they&apos;re found.</p>
      </div>
    </VerticalFrame>
  )
}

export interface MomentFeedProps {
  moments: FeedMoment[]
  /** Another decision is being written; the controls wait for it. */
  busy?: boolean
  /** A search is running: with nothing found yet, the feed says where its moments will land. */
  searching?: boolean
  /** Keep the moment and make its file. */
  onKeep: (moment: FeedMoment) => void
  onSkip: (moment: FeedMoment) => void
  /** Scrolling back onto a skipped moment, or pressing its dot, brings it back. */
  onUndoSkip: (moment: FeedMoment) => void
  /** Keep the moment, make its file, and send it to socials once the file exists. */
  onPublish: (moment: FeedMoment) => void
  onUploadMore: () => void
  /** Something else has the screen — the publish dialog — and no key, wheel or drag decides a moment behind it. */
  paused?: boolean
  /** Which moment is in front, as the person moves through the feed. */
  onFrontChange?: (index: number) => void
  /** Moments whose Keep is being written; their Keep waits for it. */
  keeping?: ReadonlySet<string>
}

export function MomentFeed({
  moments,
  busy = false,
  searching = false,
  paused = false,
  onKeep,
  onSkip,
  onUndoSkip,
  onPublish,
  onUploadMore,
  onFrontChange,
  keeping,
}: MomentFeedProps) {
  const total = moments.length
  // Where the person is in the feed, held as the MOMENT in front rather
  // than a number: the feed is rebuilt on every poll, strongest first
  // within each question, and a number would point at whatever landed in
  // that place (Devin's and Codex's finding on #87). Opens on the first
  // open decision; from there it moves only when they move it. Keeping
  // does not move it — the kept moment stays on screen, saying what is
  // being made of it. Null is the end card.
  const [frontId, setFrontId] = useState<string | null>(() => moments[feedCursor(moments)]?.match.id ?? null)
  const lastCursor = useRef(feedCursor(moments))
  const found = frontId === null ? -1 : moments.findIndex((moment) => moment.match.id === frontId)
  // A moment that has gone from the feed (a conversation rebuilt) leaves
  // the person at the same place in it rather than at the end.
  const cursor = frontId === null ? total : found >= 0 ? found : Math.min(lastCursor.current, total)
  useEffect(() => {
    lastCursor.current = cursor
  }, [cursor])
  // Moments that land while the person sits on the end card — or before
  // anything had landed — bring the first new one to the front. Ones that
  // land while they are mid-feed wait their turn. New means an id not seen
  // before, wherever it sorted.
  const seen = useRef<Set<string>>(new Set(moments.map((moment) => moment.match.id)))
  useEffect(() => {
    const fresh = moments.filter((moment) => !seen.current.has(moment.match.id))
    for (const moment of fresh) seen.current.add(moment.match.id)
    if (fresh.length > 0 && frontId === null) setFrontId(fresh[0]!.match.id)
  }, [moments, frontId])
  useEffect(() => {
    onFrontChange?.(cursor)
  }, [cursor, onFrontChange])

  const top = moments[cursor]
  const prev = cursor > 0 ? moments[cursor - 1] : undefined
  const reworking = top?.reworking ?? false
  const free = !busy && !paused
  const writing = top !== undefined && (keeping?.has(top.match.id) ?? false)
  const canDecide = top !== undefined && top.decision === null && !reworking && free && !writing
  // A kept moment whose cut failed, or that has nothing made at all, is
  // kept again — the server makes it (again). Not while a keep is being
  // written: the card's Keep waits for it.
  const canRetry = top !== undefined && top.decision === "kept" && (top.production === "failed" || top.production === null) && free && !writing
  const canGoBack = cursor > 0 && free
  const canGoForward = top !== undefined && (top.decision !== null || !reworking) && free

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
    if ((canDecide || canRetry) && top) onKeep(top)
  }, [canDecide, canRetry, top, onKeep])
  /** Down: past a decided moment, or skipping an undecided one. */
  const forward = useCallback(() => {
    if (!canGoForward || !top) return
    if (top.decision === null) onSkip(top)
    setFrontId(moments[cursor + 1]?.match.id ?? null)
  }, [canGoForward, top, cursor, onSkip, moments])
  /** Up: back onto the moment before; a skipped one is brought back as it comes into view. */
  const back = useCallback(() => {
    if (!canGoBack || !prev) return
    if (prev.decision === "skipped") onUndoSkip(prev)
    setFrontId(prev.match.id)
  }, [canGoBack, prev, onUndoSkip])
  /** A dot: straight to that moment; a skipped one comes back. */
  const goTo = useCallback(
    (index: number) => {
      if (!free) return
      const target = moments[index]
      if (target?.decision === "skipped") onUndoSkip(target)
      setFrontId(target?.match.id ?? null)
    },
    [free, moments, onUndoSkip],
  )

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

  const navigate = useCallback(
    (direction: 1 | -1) => oncePerBeat(direction > 0 ? forward : back),
    [oncePerBeat, forward, back],
  )
  const keepOnce = useCallback(() => oncePerBeat(keep), [oncePerBeat, keep])

  // The keyboard: → keep, ← or ↓ onward, ↑ (or Backspace, or u) back —
  // unless the person is typing somewhere, or a dialog has the screen: a
  // key pressed on a dialog's button is that dialog's, never a decision
  // about the moment hidden behind it. A held key is one press.
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

  // Publish is keep-and-send: it can be pressed before the file exists, and
  // the publish screens wait for the file. A moment whose cut failed can be
  // kept again the same way — the server makes it again.
  const canPublish = top !== undefined && !reworking && free
  const publishTitle = reworking
    ? "Reworking this edit…"
    : top?.production === "failed"
      ? "The cut failed — publishing makes it again, then sends it"
      : top?.production === "producing"
        ? "Publish — it goes out once the cut is ready"
        : top?.production === "produced"
          ? "Publish — send this moment to your socials"
          : "Publish — keep this moment, make its clip, and send it to your socials"

  if (total === 0) {
    if (searching) {
      return (
        <div className="flex w-full max-w-110 shrink-0 flex-col items-center sm:w-110" data-testid="moment-feed">
          <div className="relative flex h-140 w-full items-center justify-center">
            <div className="w-52 sm:w-64">
              <SearchingCard />
            </div>
          </div>
        </div>
      )
    }
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
  const decided = top !== undefined && top.decision !== null

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

        {/* The feed itself, in the right gutter: one dot per moment, the front one stretched. Each dot goes to its moment; a skipped moment's brings it back. */}
        <div className="absolute right-0 top-1/2 flex w-14 -translate-y-1/2 flex-col items-center gap-2 sm:w-20" data-testid="feed-dots">
          {moments.map((moment, index) => {
            const front = index === cursor
            const title = moment.match.description || "a moment"
            return (
              <button
                key={moment.match.id}
                type="button"
                disabled={!free || front}
                onClick={() => goTo(index)}
                aria-current={front ? "true" : undefined}
                aria-label={moment.decision === "skipped" ? `Bring back: ${title}` : `Go to: ${title}`}
                className={cn(
                  "w-2 rounded-full transition-all duration-300",
                  front ? "h-6 bg-foreground" : "h-2 bg-foreground/30 hover:bg-foreground/50 disabled:hover:bg-foreground/30",
                )}
              />
            )
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
              className={cn("absolute w-52 sm:w-64", front && (canGoForward || canGoBack) && "cursor-grab active:cursor-grabbing")}
              initial={false}
              animate={style}
              transition={SPRING}
              drag={front && (canGoForward || canGoBack) ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={onDragEnd}
              style={{ transformStyle: "preserve-3d", zIndex: style.zIndex }}
              aria-hidden={!front}
            >
              {moment ? (
                <CardFace moment={moment} front={front} muted={muted} onToggleMute={() => setMuted((value) => !value)}>
                  {front && (
                    <>
                      {/* The corner: Download once the file exists, and Publish. Two buttons stacked, so neither moves when the other appears. */}
                      {moment.production === "produced" && moment.downloadUrl && (
                        <a
                          href={moment.downloadUrl}
                          download
                          aria-label="Download — save this clip"
                          title="Download this clip"
                          data-testid="feed-download"
                          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
                        >
                          <DownloadGlyph />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onPublish(moment)}
                        disabled={!canPublish}
                        aria-label="Publish — send this moment to your socials"
                        title={publishTitle}
                        className={cn(
                          "absolute right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:cursor-default disabled:opacity-60",
                          moment.production === "produced" && moment.downloadUrl ? "top-14" : "top-3",
                        )}
                      >
                        <PublishGlyph />
                      </button>
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
                <EndCard canGoBack={cursor > 0} onBack={() => goTo(total - 1)} onUploadMore={onUploadMore} />
              )}
            </motion.div>
          )
        })}
      </div>

      {top && (
        // Two slots that never move. For an open decision: Skip and Keep.
        // For a kept moment: onward, and the keep it already has.
        <div className="mt-6 flex items-center justify-center gap-8" data-testid="feed-controls">
          {decided ? (
            <button
              type="button"
              onClick={forward}
              disabled={!canGoForward}
              aria-label="Next moment"
              title="Next"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-border text-foreground transition hover:border-foreground disabled:opacity-40"
            >
              <ChevronDown aria-hidden size={22} />
            </button>
          ) : (
            <button
              type="button"
              onClick={forward}
              disabled={!canDecide}
              aria-label="Skip — not useful, move on"
              title="Skip"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-border text-foreground transition hover:border-foreground disabled:opacity-40"
            >
              <X aria-hidden size={22} />
            </button>
          )}
          <button
            type="button"
            onClick={keep}
            disabled={!(canDecide || canRetry)}
            aria-label={decided ? (canRetry ? "Keep again — make the clip again" : "Kept") : "Keep — make this clip and save it to your library"}
            title={decided ? (canRetry ? "Keep again" : "Kept") : "Keep"}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-background transition hover:bg-foreground/90 disabled:opacity-40"
          >
            <Check aria-hidden size={26} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}
