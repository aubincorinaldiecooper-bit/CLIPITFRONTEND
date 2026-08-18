"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { ClipMatch, Video } from "@/lib/types"

const EASE = [0.23, 1, 0.32, 1] as const

/**
 * One number from source bytes to a searchable, understood video:
 * upload 0–35, ingest/preprocess 35–75, understanding 75–100. The
 * understanding phase reports no granular percent, so it holds and pulses
 * rather than inventing one.
 */
export function overallProgress(
  video: Video | null,
  uploadFraction: number | null,
): { percent: number; label: string; pulsing: boolean; done: boolean } {
  if (uploadFraction !== null) {
    return { percent: Math.round(uploadFraction * 35), label: "Uploading…", pulsing: false, done: false }
  }
  if (!video) return { percent: 0, label: "", pulsing: false, done: false }

  if (video.status === "failed") {
    return { percent: 0, label: video.error ?? "Processing failed", pulsing: false, done: false }
  }

  if (video.status !== "ready") {
    return {
      percent: 35 + Math.round((video.progress.percent / 100) * 40),
      label: video.progress.message,
      pulsing: false,
      done: false,
    }
  }

  const index = video.index ?? { status: "unavailable" as const, sceneCount: 0, error: null }
  if (index.status === "pending" || index.status === "queued" || index.status === "running") {
    return { percent: 85, label: "Watching the video…", pulsing: true, done: false }
  }

  return { percent: 100, label: "Ready", pulsing: false, done: true }
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
 * The video, seated centre stage. Before playback exists it is a progress
 * dial; the moment the source is playable the player takes over, with the
 * remaining pipeline progress reduced to a hairline strip at the top.
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

  const status = overallProgress(video, uploadFraction)
  const playbackUrl = video?.playback?.url ?? null

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
      className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-black/50 shadow-[0_0_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative aspect-video w-full">
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
            playsInline
          />
        ) : (
          <ProgressDial percent={status.percent} label={status.label} pulsing={status.pulsing} failed={video?.status === "failed"} />
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

        {/* Remaining pipeline progress once the player has taken the stage. */}
        {playbackUrl && !status.done && (
          <div className="pointer-events-none absolute inset-x-0 top-0">
            <div className="h-0.5 w-full bg-white/10">
              <div
                className="h-full bg-amber-300/80 transition-[width] duration-700"
                style={{ width: `${status.percent}%` }}
              />
            </div>
            <span
              className="absolute left-3 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur"
              style={status.pulsing ? { animation: "pulse-soft 2.2s ease-in-out infinite" } : undefined}
            >
              {status.label} · {status.percent}%
            </span>
          </div>
        )}

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
      </div>
    </motion.div>
  )
}

function ProgressDial({
  percent,
  label,
  pulsing,
  failed,
}: {
  percent: number
  label: string
  pulsing: boolean
  failed?: boolean
}) {
  const radius = 54
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5">
      <div className="relative h-36 w-36" style={pulsing ? { animation: "pulse-soft 2.2s ease-in-out infinite" } : undefined}>
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={failed ? "rgba(248,113,113,0.9)" : "rgba(255,255,255,0.9)"}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.23,1,0.32,1)" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-medium tabular-nums">
          {percent}%
        </span>
      </div>
      <p className={`max-w-sm px-6 text-center text-sm ${failed ? "text-red-300" : "text-foreground/60"}`}>{label}</p>
    </div>
  )
}
