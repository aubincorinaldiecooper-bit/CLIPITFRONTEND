"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { ClipMatch, Video } from "@/lib/types"
import { SourceFrame } from "@/components/media/source-frame"

const EASE = [0.23, 1, 0.32, 1] as const

/** What the pipeline is doing right now, and how sure we are of the number. */
export interface StageActivity {
  label: string
  /**
   * Only ever a measured number. Bytes leaving the browser is the one thing
   * this screen can actually count; everything after it is server-side work
   * whose progress we are not told, so it reports null rather than a guess.
   */
  percent: number | null
  done: boolean
  failed: boolean
}

/**
 * Says what is happening, and shows a number only when there is one.
 *
 * This used to map each stage to a hardcoded percentage — 60 for
 * preprocessing, rescaled to 59 on screen — so the bar jumped to 59%, sat
 * there for the whole job however long the video was, then jumped to 85%.
 * Nothing about it moved because nothing about it was measured. A bar that
 * does not move is worse than no bar: it reads as stuck rather than as busy.
 */
export function stageActivity(video: Video | null, uploadFraction: number | null): StageActivity {
  if (uploadFraction !== null) {
    return { label: "Uploading", percent: Math.round(uploadFraction * 100), done: false, failed: false }
  }
  if (!video) return { label: "", percent: null, done: false, failed: false }

  if (video.status === "failed") {
    return { label: video.error ?? "Processing failed", percent: null, done: false, failed: true }
  }

  // No bytes have reached the server: either the upload has not begun, or it
  // failed and `fail()` cleared the fraction while leaving the row here.
  // Saying anything would be claiming work that is not happening — and in the
  // failure case it would contradict the error printed under the stage.
  if (video.status === "pending_upload") {
    return { label: "", percent: null, done: false, failed: false }
  }

  if (video.status === "queued" || video.status === "ingesting") {
    return { label: "Fetching the video", percent: null, done: false, failed: false }
  }

  // Making the small copy the model watches, and cutting it into segments.
  if (video.status === "preprocessing") {
    return { label: "Taking notes on the video", percent: null, done: false, failed: false }
  }

  // Named rather than caught by an else: a status this file has not been
  // taught about should say nothing, not inherit whatever the last branch
  // happened to be. That inheritance is exactly how a failed upload came to
  // announce itself as preprocessing.
  if (video.status !== "ready") {
    return { label: "", percent: null, done: false, failed: false }
  }

  const index = video.index ?? { status: "unavailable" as const, sceneCount: 0, error: null }
  if (index.status === "pending" || index.status === "queued" || index.status === "running") {
    // Say how far it has got. The number is real — the backend writes notes as
    // each part is read — so this moves, which is the difference between busy
    // and stuck. "Remembering the video" on its own sat there for two minutes
    // looking like nothing was happening.
    const read = index.readThroughTimecode
    const whole = video.durationTimecode
    return {
      label: read && whole ? `Watching — ${read} of ${whole}` : "Starting to watch the video",
      percent: null,
      done: false,
      failed: false,
    }
  }

  return { label: "", percent: null, done: true, failed: false }
}

/**
 * A spinner and a few words. Deliberately the whole vocabulary for work whose
 * progress cannot be measured — it says "busy" without implying "this far
 * along", which is the claim the old percentage was making without evidence.
 */
function Working({ label, size = 13, className = "" }: { label: string; size?: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2 text-[11.5px] text-white/70 ${className}`}>
      {/* animate-spin, not an inline animation: the reduced-motion guard in
          globals.css freezes inline animations but exempts this class — a
          working spinner that stops reads as a stuck app. */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0 animate-spin"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  )
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function Slider({
  value,
  onChange,
  markers,
  className,
}: {
  value: number
  onChange: (value: number) => void
  /** Percent positions (0–100) of matched moments, drawn as ticks. */
  markers?: number[]
  className?: string
}) {
  return (
    <div
      className={`group/slider relative h-4 w-full cursor-pointer ${className ?? ""}`}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const fraction = (event.clientX - rect.left) / rect.width
        onChange(Math.min(Math.max(fraction * 100, 0), 100))
      }}
    >
      <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/15">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full bg-white"
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
        />
        {markers?.map((position, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full bg-amber-300/90"
            style={{ left: `${position}%`, animation: "pop-in 300ms 200ms both" }}
          />
        ))}
      </div>
    </div>
  )
}

const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
  </svg>
)

const PauseIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="4" width="4" height="16" rx="1.2" />
    <rect x="14" y="4" width="4" height="16" rx="1.2" />
  </svg>
)

/**
 * The video, seated centre stage. Before playback exists the frame carries the
 * upload ring or, once the bytes have landed, a spinner saying what the server
 * is doing. The moment the source is playable the player takes over and that
 * status retreats to a corner — the work continues, but it is no longer the
 * thing being watched.
 */
export function VideoStage({
  video,
  uploadFraction,
  matches,
  seekRequest,
}: {
  video: Video | null
  uploadFraction: number | null
  matches: ClipMatch[]
  /** Bump `token` to seek; the stage plays from `seconds`. */
  seekRequest: { seconds: number; token: number } | null
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const [hover, setHover] = useState(false)

  const status = stageActivity(video, uploadFraction)

  // Every poll returns a FRESHLY signed URL — a different string for the same
  // bytes. Binding src to it directly reloaded the element every 2s while the
  // understanding phase polled, killing playback the moment it started. Pin
  // the first URL; swap only if the pinned one actually fails (expiry).
  const latestUrl = video?.playback?.url ?? null
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const videoId = video?.id ?? null

  useEffect(() => {
    setPlaybackUrl(null)
  }, [videoId])

  useEffect(() => {
    if (latestUrl) setPlaybackUrl((current) => current ?? latestUrl)
  }, [latestUrl])

  const onPlaybackError = useCallback(() => {
    // The pinned signature has likely expired; move to the newest one.
    setPlaybackUrl((current) => (latestUrl && latestUrl !== current ? latestUrl : current))
  }, [latestUrl])

  const togglePlay = useCallback(() => {
    const element = videoRef.current
    if (!element) return
    if (element.paused) void element.play()
    else element.pause()
  }, [])

  useEffect(() => {
    if (!seekRequest) return
    const element = videoRef.current
    if (!element) return
    element.currentTime = seekRequest.seconds
    void element.play()
  }, [seekRequest])

  const onTimeUpdate = useCallback(() => {
    const element = videoRef.current
    if (!element || !Number.isFinite(element.duration)) return
    setProgress((element.currentTime / element.duration) * 100)
    setCurrentTime(element.currentTime)
    setDuration(element.duration)
  }, [])

  const seek = useCallback((value: number) => {
    const element = videoRef.current
    if (!element || !Number.isFinite(element.duration)) return
    element.currentTime = (value / 100) * element.duration
    setProgress(value)
  }, [])

  const setSpeed = useCallback((value: number) => {
    const element = videoRef.current
    if (!element) return
    element.playbackRate = value
    setSpeedState(value)
  }, [])

  const totalSeconds = video?.durationSeconds ?? duration
  const markers =
    totalSeconds > 0 ? matches.map((match) => Math.min(99.5, (match.startSeconds / totalSeconds) * 100)) : []

  return (
    <motion.div
      layout
      className="mx-auto w-full max-w-4xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <SourceFrame
        width={video?.width}
        height={video?.height}
        className="mx-auto rounded-2xl bg-[#0b0b0d] shadow-[0_18px_50px_rgba(18,18,18,0.18)] ring-1 ring-black/10"
      >
        {playbackUrl ? (
          <video
            ref={videoRef}
            src={playbackUrl}
            className="h-full w-full object-contain"
            onClick={togglePlay}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onTimeUpdate}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={onPlaybackError}
            playsInline
          />
        ) : (
          <StageWaiting activity={status} />
        )}

        {/* Big centre play affordance while paused. */}
        <AnimatePresence>
          {playbackUrl && !playing && (
            <motion.button
              key="bigplay"
              type="button"
              aria-label="Play"
              onClick={togglePlay}
              className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md ring-1 ring-white/25"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <span className="translate-x-0.5">
                <PlayIcon size={30} />
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Still working, but the video is already watchable — so this stays
            out of the way: a corner, a spinner, and what it is doing. The bar
            that used to sit across the top was measuring nothing. */}
        <AnimatePresence>
          {playbackUrl && !status.done && status.label && (
            <motion.div
              key="activity"
              className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1.5 backdrop-blur"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {status.failed ? (
                <span className="text-[11.5px] text-red-300">{status.label}</span>
              ) : (
                <Working label={status.label} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls, reference-style: blur in from the bottom on hover. */}
        <AnimatePresence>
          {playbackUrl && (hover || !playing) && (
            <motion.div
              key="controls"
              className="absolute inset-x-0 bottom-0 m-2 mx-auto max-w-2xl rounded-2xl bg-[#111111c4] p-3 backdrop-blur-md"
              initial={{ y: 16, opacity: 0, filter: "blur(8px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: 16, opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs tabular-nums text-white/85">{formatTime(currentTime)}</span>
                <Slider value={progress} onChange={seek} markers={markers} className="flex-1" />
                <span className="text-xs tabular-nums text-white/85">{formatTime(duration)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={playing ? "Pause" : "Play"}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15"
                  >
                    {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const element = videoRef.current
                      if (!element) return
                      element.muted = !element.muted
                      setMuted(element.muted)
                    }}
                    aria-label={muted ? "Unmute" : "Mute"}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                      {muted ? <path d="m16 9 6 6M22 9l-6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 1.5, 2].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSpeed(value)}
                      className={`rounded-md px-2 py-1 text-xs text-white transition-colors hover:bg-white/15 ${
                        speed === value ? "bg-white/20" : ""
                      }`}
                    >
                      {value}x
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SourceFrame>
    </motion.div>
  )
}

/**
 * The stage before there is anything to play.
 *
 * The ring is drawn only while uploading, because that is the only phase with
 * a real fraction behind it. Once the file has landed, the same space says
 * what the server is doing and spins — no ring creeping toward a number it
 * cannot justify.
 */
function StageWaiting({ activity }: { activity: StageActivity }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius

  if (activity.failed) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6">
        <p className="max-w-sm text-center text-sm text-red-300">{activity.label}</p>
      </div>
    )
  }

  // Nothing to report. An empty frame is the honest answer — a spinner with no
  // words next to it still claims something is running.
  if (activity.percent === null && !activity.label) return null

  if (activity.percent === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Working label={activity.label} size={16} className="text-[13px] text-white/55" />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - activity.percent / 100)}
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.23,1,0.32,1)" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-medium tabular-nums text-white">
          {activity.percent}%
        </span>
      </div>
      <p className="max-w-sm px-6 text-center text-sm text-white/60">{activity.label}</p>
    </div>
  )
}
