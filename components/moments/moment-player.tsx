"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { Check, ExternalLink, Maximize2, Minimize2, Pause, Play, Volume2, VolumeX, X } from "lucide-react"
import { ClipComposition, centredComposition } from "@/components/media/clip-composition"
import { AspectRatio } from "@/components/space/aspect-ratio"
import { Badge } from "@/components/space/badge"
import { Button } from "@/components/space/button"
import { Slider } from "@/components/space/slider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/space/tooltip"
import { asClock, mediaIdentity, momentTitle, videoLabel, type FeedMoment, type PreviewSource } from "@/components/start/moments"
import type { Video } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * The moment, playing — the owner's prototype's player (2026-09-14) around
 * the playback the feed already had.
 *
 * A moment is the evidence: a stretch of the source video. The player
 * plays exactly that stretch, from the source, through the 9:16 frame the
 * export will use, and loops inside it; when the finished file exists it
 * plays the file instead. Time is within the MOMENT (0:03 / 0:12), never
 * the position in the whole video — that lives in the answer's metadata.
 *
 * Hand-rolled, like the theater before it, by the owner's decision
 * (2026-08-22): the controls are Shadcn Space's (Base UI), the picture and
 * its rules are ours. The chrome leaves once the moment is playing and the
 * pointer is still, and comes back on a move or a tap.
 *
 * What it reports — playing or not, how far in, how long — comes from the
 * media element's own events, never from a clock of ours: a stall, a seek
 * and a slow network all show as what they are.
 */

const IDLE_MS = 1400

/** What the media element reports, relative to the moment. */
interface Playback {
  playing: boolean
  /** Seconds into the moment. */
  current: number
  /** The moment's length. */
  total: number
}

/**
 * The <video>, with its URL pinned at the value it started with.
 *
 * The page polls while a video is still being read and while a cut is on
 * its way, and every poll re-signs the playback URLs — bound straight to
 * the element, the newest one reloaded the player every two seconds and
 * threw the moment back to its start. The newest value is taken only when
 * the pinned one fails (an expired link). The caller keys this by moment
 * and by the FILE's identity (its path — see mediaIdentity), so a re-cut's
 * new file, or the finished file arriving in place of the source, starts
 * afresh, while a re-signed link to the same file does not.
 */
function MomentVideo({
  source,
  still,
  muted,
  autoPlay,
  style,
  label,
  videoRef,
  onPlayback,
}: {
  source: PreviewSource
  still: string | null
  muted: boolean
  autoPlay: boolean
  style: CSSProperties
  label: string
  videoRef: React.RefObject<HTMLVideoElement | null>
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
      ? Number.isFinite(element.duration)
        ? element.duration
        : 0
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
      data-testid="moment-video"
      onError={() => {
        // The pinned link no longer works; the freshest one gets its turn.
        if (latestUrl.current !== pinnedUrl) setPinnedUrl(latestUrl.current)
      }}
      poster={still ?? undefined}
      aria-label={label}
      muted={muted}
      autoPlay={autoPlay}
      loop={source.finished}
      playsInline
      // The source stands in for the file inside a frame it does not fill;
      // what shows around it is the player's own fill, not black bars.
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

/** The badge on a decided moment: what was decided, and for a kept one, where its file is. */
function decisionWords(moment: FeedMoment): string {
  if (moment.decision === "skipped") return "Skipped"
  if (moment.production === "producing") return "Kept · cutting…"
  if (moment.production === "failed") return "Kept · cut failed"
  return "Kept"
}

export interface MomentPlayerProps {
  moment: FeedMoment
  /** The video the moment is from, for the badge that says where. */
  video: Video | null
  /** The results stage's card: no scrubber, no fullscreen — lighter chrome. */
  compact?: boolean
  /** Sound is one setting for the whole screen: unmute once, stay unmuted from card to card. */
  muted: boolean
  onMutedChange: (muted: boolean) => void
  /** Start playing as soon as it can (muted — the browser allows nothing else unasked). */
  autoPlay?: boolean
  /**
   * The badges, expand, sound and seek. False draws only the picture and
   * its play button: for a card that shows the frame's middle, which would
   * crop those out of sight while leaving them in the tab order (Codex's
   * finding on #98). Whoever asks for that draws the sound control itself.
   */
  controls?: boolean
  className?: string
}

export function MomentPlayer({ moment, video, compact = false, muted, onMutedChange, autoPlay = true, controls = true, className }: MomentPlayerProps) {
  const label = momentTitle(moment.match)
  const source = moment.preview
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const idleTimer = useRef<number | undefined>(undefined)

  const [playback, setPlayback] = useState<Playback>({
    playing: false,
    current: 0,
    total: source && !source.finished ? Math.max(0, (source.end ?? source.start) - source.start) : 0,
  })
  const [idle, setIdle] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  // The chrome shows while the moment is paused, and after a touch while it
  // plays; then it leaves, so the footage is the picture.
  const wake = useCallback(() => {
    setIdle(false)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(idleTimer.current), [])
  useEffect(() => {
    if (playback.playing) wake()
    else {
      window.clearTimeout(idleTimer.current)
      setIdle(false)
    }
  }, [playback.playing, wake])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggle = () => {
    const element = videoRef.current
    if (!element) return
    wake()
    if (element.paused || element.ended) {
      // A play the browser refuses (no gesture yet, a stalled load) is
      // reported by the element's own events, not thrown at the page.
      void element.play()?.catch(() => undefined)
    } else {
      element.pause()
    }
  }

  const seek = (within: number) => {
    const element = videoRef.current
    if (!element || !source) return
    const offset = source.finished ? 0 : source.start
    element.currentTime = offset + Math.max(0, Math.min(within, playback.total || within))
    setPlayback((current) => ({ ...current, current: within }))
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void containerRef.current?.requestFullscreen?.()
  }

  const chrome = cn("transition-opacity duration-300", playback.playing && idle && "pointer-events-none opacity-0")
  const composition = source?.composition ?? moment.clip?.media?.composition ?? centredComposition("9:16")
  const sourceAspectRatio = source?.sourceAspectRatio ?? moment.clip?.media?.sourceAspectRatio ?? null
  const where = videoLabel(video)
  const sourceHref = video?.sourceType === "youtube" ? video.sourceUrl : null

  return (
    <TooltipProvider delay={400}>
      <AspectRatio
        ref={containerRef}
        ratio={9 / 16}
        data-slot="moment-player"
        data-testid={compact ? "moment-card" : "moment-player"}
        data-playing={playback.playing ? "true" : undefined}
        role="group"
        aria-label={label}
        onPointerMove={wake}
        onPointerLeave={() => playback.playing && setIdle(true)}
        className={cn(
          "overflow-hidden bg-neutral-950 select-none fullscreen:aspect-auto fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none",
          compact
            ? "size-full rounded-[14px]"
            : "h-[min(54vh,520px)] animate-rise-in rounded-[18px] shadow-[0_14px_40px_rgba(0,0,0,0.18)] max-[860px]:size-full max-[860px]:rounded-[inherit] max-[860px]:shadow-none",
          className,
        )}
      >
        {source && !source.finished && moment.still && (
          // The source stands in for the file inside the 9:16 frame. Behind
          // its letterboxed picture, the moment's own still spread and blurred
          // — the way the finished file fills that frame — instead of black.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={moment.still} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl" />
        )}

        {/* A tap on the picture is play/pause, like every vertical player. */}
        <div className="flex h-full w-full cursor-pointer items-center justify-center" onClick={source ? toggle : undefined}>
          <div className="w-full in-[:fullscreen]:aspect-[9/16] in-[:fullscreen]:h-full in-[:fullscreen]:w-auto">
            <ClipComposition composition={composition} sourceAspectRatio={sourceAspectRatio} finished={source?.finished ?? true} className="w-full">
              {(mediaStyle) =>
                source ? (
                  <MomentVideo
                    key={`${moment.match.id}:${source.finished ? "file" : "source"}:${mediaIdentity(source.url)}`}
                    videoRef={videoRef}
                    source={source}
                    still={moment.still}
                    muted={muted}
                    autoPlay={autoPlay}
                    style={mediaStyle}
                    label={label}
                    onPlayback={setPlayback}
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
        </div>

        {/* Where the footage is from — with the picture, not below it. */}
        {controls && (
        <span className={cn("absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5", chrome)}>
          {sourceHref ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge
                    variant="ghost"
                    render={<a href={sourceHref} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} />}
                    className="h-auto gap-1.5 bg-black/32 px-2.5 py-1.5 text-[11.5px] font-normal text-white/85 backdrop-blur-md hover:bg-black/50 hover:text-white"
                  />
                }
              >
                {where}
                <ExternalLink className="size-[11px] opacity-65" />
              </TooltipTrigger>
              <TooltipContent>Open the source</TooltipContent>
            </Tooltip>
          ) : (
            <Badge variant="ghost" className="h-auto bg-black/32 px-2.5 py-1.5 text-[11.5px] font-normal text-white/85 backdrop-blur-md hover:bg-black/32 hover:text-white/85">
              {where}
            </Badge>
          )}
          {moment.decision && (
            <span
              data-testid="moment-decision"
              className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white"
            >
              {moment.decision === "kept" ? <Check aria-hidden size={12} strokeWidth={3} /> : <X aria-hidden size={12} strokeWidth={3} />}
              {decisionWords(moment)}
            </span>
          )}
        </span>
        )}

        {controls && !compact && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={fullscreen ? "Exit fullscreen" : "Expand"}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleFullscreen()
                  }}
                  className={cn(
                    "absolute top-3 right-3 z-10 size-[30px] rounded-full bg-black/32 text-white backdrop-blur-md hover:bg-black/50 hover:text-white",
                    chrome,
                  )}
                />
              }
            >
              {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </TooltipTrigger>
            <TooltipContent>{fullscreen ? "Exit fullscreen" : "Expand"}</TooltipContent>
          </Tooltip>
        )}

        {source && (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={playback.playing ? "Pause" : "Play"}
            data-testid="moment-playpause"
            onClick={(event) => {
              event.stopPropagation()
              toggle()
            }}
            className={cn(
              "absolute top-1/2 left-1/2 z-10 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/[0.18] hover:text-white focus-visible:opacity-100",
              chrome,
            )}
          >
            {playback.playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-1 size-5 fill-current" />}
          </Button>
        )}

        {moment.reworking && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-black/60 text-white backdrop-blur-sm"
            data-testid="reworking-overlay"
          >
            <p className="text-sm font-medium">Reworking this edit…</p>
            <p className="text-xs text-white/70">Same moment, new direction</p>
          </div>
        )}

        {controls && !compact && moment.match.reclipStatus === "failed" && moment.match.reclipError && (
          <p className="absolute inset-x-3 bottom-14 z-10 rounded-xl bg-black/70 px-3 py-2 text-xs leading-snug text-white">{moment.match.reclipError}</p>
        )}

        {controls && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-10 flex items-center gap-3.5 bg-gradient-to-t from-black/40 to-transparent px-3.5 pt-8 pb-3.5",
            chrome,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={muted ? "Unmute" : "Mute"}
                  aria-pressed={!muted}
                  onClick={() => onMutedChange(!muted)}
                  className="size-[30px] shrink-0 rounded-full bg-black/32 text-white hover:bg-black/50 hover:text-white"
                />
              }
            >
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </TooltipTrigger>
            <TooltipContent>{muted ? "Unmute" : "Mute"}</TooltipContent>
          </Tooltip>

          {/* A real seek — Base UI's slider: click, drag, touch, arrow keys. */}
          {compact || !source ? (
            <span className="flex-1" />
          ) : (
            <Slider
              aria-label="Seek within the moment"
              min={0}
              max={Math.max(playback.total, 0.01)}
              step={0.01}
              value={Math.min(playback.current, Math.max(playback.total, 0.01))}
              onValueChange={(next) => seek(Array.isArray(next) ? (next[0] ?? 0) : next)}
              className={cn(
                "mx-0.5 flex-1",
                "[&_[data-slot=slider-track]]:h-[2.5px] [&_[data-slot=slider-track]]:bg-white/25",
                "[&_[data-slot=slider-range]]:bg-white/90",
                "[&_[data-slot=slider-thumb]]:size-2.5 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:opacity-0 [&_[data-slot=slider-thumb]]:shadow-[0_1px_5px_rgba(0,0,0,0.35)] [&_[data-slot=slider-thumb]]:transition-opacity",
                "hover:[&_[data-slot=slider-thumb]]:opacity-100 focus-within:[&_[data-slot=slider-thumb]]:opacity-100",
              )}
            />
          )}

          <span className="shrink-0 text-[11.5px] tabular-nums text-white/85" data-testid="moment-time">
            {source ? `${asClock(playback.current)} / ${asClock(playback.total)}` : asClock(moment.match.durationSeconds)}
          </span>
        </div>
        )}
      </AspectRatio>
    </TooltipProvider>
  )
}
