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
 * them. Moving through them decides nothing.
 *
 * NOTHING HERE DECIDES ANYTHING. Keep, Skip and the → shortcut went on
 * 9 September, and skipping-by-scrolling with them: this MVP has no
 * keeping, no skipping and no liking. It finds moments and shows them. Publish went with them; it is coming back, so its prop
 * and the page's wiring were left in place. A moment kept in an earlier
 * session still shows what it is and still offers Download once its file
 * exists, because that state arrives from the server and is not made here.
 *
 * A moment is the evidence — a stretch of the source video — and the front
 * card plays exactly that stretch from the source, through the 9:16 frame,
 * with a play/pause control in the middle and the time within the moment
 * beside it. When the file has been made the card plays the file instead.
 * The dots at the LEFT are the feed itself, and each one goes to its
 * moment. They took the place of the position counter, which was removed
 * with the rest of the chrome.
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
      {/*
        * One number, not two (the owner's call). It is the time LEFT: before
        * anything plays it reads the same as the moment's length, so it
        * agrees with the length printed on the cards behind this one, and
        * then it counts down — which an elapsed figure could not do without
        * the total beside it.
        *
        * `asClock` floors here as it does everywhere, so the last fraction of
        * a second reads 0:00. One clock for the whole feed is worth more than
        * a second rounding rule that disagrees with the cards behind.
        */}
      <p className="pointer-events-none absolute bottom-3 right-3 z-10 text-sm font-medium tabular-nums text-white" data-testid="feed-time">
        {asClock(playback.total - playback.current)}
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
  /**
   * Kept for the caller's sake, and unused here since skipping was removed:
   * moving past a moment used to discard it. ReviewStep and the page still
   * wire it, ready for its return.
   */
  onSkip: (moment: FeedMoment) => void
  /** As onSkip — unused here now that nothing is skipped to bring back. */
  onUndoSkip: (moment: FeedMoment) => void
  /** Keep the moment, make its file, and send it to socials once the file exists. */
  /**
   * Kept for the caller's sake, and unused here since the card's Publish
   * corner was removed. ReviewStep and the page still wire it, and publishing
   * still happens from the kept clips and the publishing screens — so this is
   * a prop waiting for a button, not a dead path through the app. Say the
   * word and the whole chain comes out.
   */
  onPublish: (moment: FeedMoment) => void
  onUploadMore: () => void
  /** Something else has the screen — the publish dialog — and no key, wheel or drag decides a moment behind it. */
  paused?: boolean
  /** Which moment is in front, as the person moves through the feed. */
  onFrontChange?: (index: number) => void
  /** Moments whose Keep is being written; their Keep waits for it. */
  /**
   * Kept for the caller's sake, and unused here since Keep was removed: it
   * marked the moment whose keep was still being written so the card's Keep
   * could wait for it. ReviewStep and the page still track it, ready for
   * the button's return.
   */
  keeping?: ReadonlySet<string>
}

export function MomentFeed({
  moments,
  busy = false,
  searching = false,
  paused = false,
  onKeep,
  onUploadMore,
  onFrontChange,
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

  /**
   * Moving through the feed decides nothing.
   *
   * Down used to skip the moment you passed, and up used to bring a skipped
   * one back. Both went with Keep on 9 September: this MVP has no keeping,
   * no skipping and no liking, so scrolling is only scrolling — a person
   * looking through their moments is not voting on them.
   */
  const forward = useCallback(() => {
    if (!canGoForward || !top) return
    setFrontId(moments[cursor + 1]?.match.id ?? null)
  }, [canGoForward, top, cursor, moments])
  const back = useCallback(() => {
    if (!canGoBack || !prev) return
    setFrontId(prev.match.id)
  }, [canGoBack, prev])
  /** A dot: straight to that moment. */
  const goTo = useCallback(
    (index: number) => {
      if (!free) return
      setFrontId(moments[index]?.match.id ?? null)
    },
    [free, moments],
  )

  /**
   * One decision per beat, for the inputs that repeat on their own: a flick
   * of the wheel is many events and a held key repeats, and either could
   * skip several moments before the person let go, and a skip is a decision
   * about a moment. Keep and its button are gone (9 September), so this now
   * guards moving through the feed alone — which is still enough to discard
   * a run of moments nobody looked at.
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

  /**
   * The keyboard: ← or ↓ onward, ↑ (or Backspace, or u) back — unless the
   * person is typing somewhere, or a dialog has the screen: a key pressed on
   * a dialog's button is that dialog's, never a decision about the moment
   * hidden behind it. A held key is one press.
   *
   * → used to keep the moment. It went with the Keep button on 9 September:
   * this MVP makes no clips, and a shortcut that still made one would have
   * meant the removal was only skin deep.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (paused) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      if (target?.closest?.('[role="dialog"]')) return
      if (event.repeat) return
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") navigate(1)
      else if (event.key === "ArrowUp" || event.key === "Backspace" || event.key === "u") navigate(-1)
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate, paused])

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < -DRAG_THRESHOLD_PX) navigate(1)
    else if (info.offset.y > DRAG_THRESHOLD_PX) navigate(-1)
  }
  // On the stage, not the window: a wheel over the dialogue beside the feed
  // scrolls the dialogue and must not skip a moment.
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) > WHEEL_THRESHOLD_PX) navigate(event.deltaY > 0 ? 1 : -1)
  }

  /**
   * Keep the moment you are on inside the rail once the rail scrolls.
   *
   * Devin's finding on #90: one button per moment and no bound, inside a
   * 560px stage that hides its overflow. Ask enough questions and the ends of
   * the list were simply cut off — 23 fit for a mouse and only 12 for a
   * thumb, since a coarse pointer gets the 44px target the guidance asks for.
   * The rail scrolls now, so the front dot has to be brought along with it.
   *
   * `nearest` moves it the least amount that works and does nothing when it
   * is already visible, so there is no scrolling to see and nothing for the
   * reduced-motion guard to argue with.
   *
   * Declared HERE, above the empty-feed return below, and it has to stay
   * here: hooks must run in the same order on every render. These two sat
   * after that return, so the render that showed the searching card called
   * two hooks fewer than the render that showed the first moments — and
   * React threw "Rendered more hooks than during the previous render" the
   * moment a search finished, taking the whole page down with it.
   */
  const frontDot = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    frontDot.current?.scrollIntoView?.({ block: "nearest" })
  }, [cursor])

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
        {/*
          * The feed, in the left gutter: one dot per moment, the front one
          * stretched. Each dot goes to its moment.
          *
          * The button is NOT the dot. It used to be, and that made every
          * target 8x8 css px with 16px between centres — which fails WCAG 2.2
          * SC 2.5.8 (AA) on both of its routes, since that rule wants 24x24
          * or 24px of clearance and this had neither. Measured before the
          * change: 8x24, 8x8, 8x8, centres 24px then 16px apart.
          *
          * So the dot is a span inside a button sized to the standard. The
          * mark you see is unchanged; the area you can hit is not. 24px is
          * the AA floor and keeps the rhythm the design has; a coarse pointer
          * gets 44px, which is Apple's and Material's guidance and the size a
          * thumb actually needs. `gap` is gone because the targets now sit
          * edge to edge and provide the spacing themselves.
          */}
        <div
          className="absolute inset-y-0 left-0 flex w-14 overflow-y-auto overscroll-contain sm:w-20"
          data-testid="feed-dots"
        >
          {/*
            * `m-auto` rather than `justify-center`, and it is load-bearing:
            * a centred flex column that outgrows its scroll box has its first
            * items cut off above the scroll origin and they cannot be reached
            * by scrolling at all. An automatic margin centres a short list the
            * same way and simply stops centring once the list is taller.
            */}
          <div className="m-auto flex shrink-0 flex-col items-center py-2">
          {moments.map((moment, index) => {
            const front = index === cursor
            const title = moment.match.description || "a moment"
            const interactive = free && !front
            return (
              <button
                key={moment.match.id}
                ref={front ? frontDot : undefined}
                type="button"
                disabled={!free || front}
                onClick={() => goTo(index)}
                aria-current={front ? "true" : undefined}
                aria-label={`Go to: ${title}`}
                className="group flex size-6 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11"
              >
                <span
                  aria-hidden
                  className={cn(
                    "w-2 rounded-full transition-all duration-300",
                    front ? "h-6 bg-foreground" : "h-2 bg-foreground/30",
                    interactive && "group-hover:bg-foreground/50",
                  )}
                />
              </button>
            )
          })}
          </div>
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
                      {/*
                        * The corner: Download, once the file exists.
                        *
                        * Publish sat here and was removed at the owner's
                        * request. No way to publish was lost with it —
                        * KeptGrid and the publishing screens both still
                        * offer it — so unlike Keep this button had somewhere
                        * else to go.
                        */}
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

    </div>
  )
}
