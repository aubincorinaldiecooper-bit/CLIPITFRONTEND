"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { motion } from "motion/react"
import { api, ApiError } from "@/lib/api"
import type { Clip, ClipRequest, Video } from "@/lib/types"
import { SourceStep } from "@/components/flow/source-step"
import { VideoStage } from "@/components/theater/video-stage"
import { QueryDrawer } from "@/components/theater/query-drawer"

const POLL_MS = 2000
const EASE = [0.23, 1, 0.32, 1] as const

/**
 * The theater: the video seated centre stage with one progress arc from
 * upload through understanding, and a collapsible drawer on the right where
 * questions are asked and their evidence lands.
 */
/** One question and everything that came back for it. The drawer keeps all of them. */
export interface Exchange {
  request: ClipRequest
  clips: Clip[]
}

export default function StartPage() {
  const [video, setVideo] = useState<Video | null>(null)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [uploadFraction, setUploadFraction] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seekRequest, setSeekRequest] = useState<{ seconds: number; token: number } | null>(null)

  const configured = api.isConfigured()

  const fail = useCallback((cause: unknown) => {
    setError(cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.")
    setBusy(false)
    setUploadFraction(null)
  }, [])

  // --- source -------------------------------------------------------------

  const startUpload = useCallback(
    async (file: File) => {
      setError(null)
      setBusy(true)
      try {
        const { video: created, upload } = await api.createUpload(file.name, file.type || undefined)
        setVideo(created)
        setUploadFraction(0)
        await api.uploadFile(upload, file, setUploadFraction)
        const { video: queued } = await api.markUploaded(created.id)
        setVideo(queued)
        setUploadFraction(null)
      } catch (cause) {
        fail(cause)
      } finally {
        setBusy(false)
      }
    },
    [fail],
  )

  const startYoutube = useCallback(
    async (url: string) => {
      setError(null)
      setBusy(true)
      try {
        const { video: created } = await api.createYoutubeVideo(url)
        setVideo(created)
      } catch (cause) {
        fail(cause)
      } finally {
        setBusy(false)
      }
    },
    [fail],
  )

  // --- polling ------------------------------------------------------------

  const videoId = video?.id
  // Playback and the understanding phase both land after "ready", so keep
  // polling until the index settles too.
  const indexSettled =
    video?.index == null ||
    video.index.status === "ready" ||
    video.index.status === "failed" ||
    video.index.status === "unavailable"
  const videoSettled = video?.status === "failed" || (video?.status === "ready" && indexSettled && !!video?.playback)

  useEffect(() => {
    if (!videoId || videoSettled || uploadFraction !== null) return

    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const { video: latest } = await api.getVideo(videoId)
        if (!cancelled) setVideo(latest)
      } catch {
        // A transient poll failure is not worth interrupting the flow for.
      }
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [videoId, videoSettled, uploadFraction])

  // Any exchange can still be moving: the newest while it searches, and any
  // older one whose clip is being cut. Poll them all until they settle.
  const unsettledIds = exchanges
    .filter(
      (exchange) =>
        exchange.request.status === "pending" ||
        exchange.request.status === "searching" ||
        exchange.clips.some((clip) => clip.status === "pending" || clip.status === "generating"),
    )
    .map((exchange) => exchange.request.id)
  const unsettledKey = unsettledIds.join(",")

  useEffect(() => {
    if (unsettledIds.length === 0) return

    let cancelled = false
    const timer = setInterval(async () => {
      for (const id of unsettledIds) {
        try {
          const { clipRequest: latest, clips: latestClips } = await api.getClipRequest(id)
          if (cancelled) return
          setExchanges((previous) =>
            previous.map((exchange) =>
              exchange.request.id === latest.id ? { request: latest, clips: latestClips } : exchange,
            ),
          )
        } catch {
          // Ignore a dropped poll; the next tick will catch up.
        }
      }
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsettledKey])

  // --- actions ------------------------------------------------------------

  const startSearch = useCallback(
    async (instruction: string) => {
      if (!video) return
      setError(null)
      setBusy(true)
      try {
        const { clipRequest: created } = await api.createClipRequest(video.id, instruction)
        // Append, never replace: the drawer keeps the whole conversation.
        setExchanges((previous) => [...previous, { request: created, clips: [] }])
      } catch (cause) {
        fail(cause)
      } finally {
        setBusy(false)
      }
    },
    [video, fail],
  )

  const clipMatch = useCallback(
    async (exchangeRequestId: string, matchId: string) => {
      setError(null)
      try {
        const { clips: created } = await api.generateClips(exchangeRequestId, [matchId])
        setExchanges((previous) =>
          previous.map((exchange) => {
            if (exchange.request.id !== exchangeRequestId) return exchange
            const merged = new Map(exchange.clips.map((clip) => [clip.id, clip]))
            for (const clip of created) merged.set(clip.id, clip)
            return { ...exchange, clips: Array.from(merged.values()) }
          }),
        )
      } catch (cause) {
        fail(cause)
      }
    },
    [fail],
  )

  const seekTo = useCallback((seconds: number) => {
    setSeekRequest((current) => ({ seconds, token: (current?.token ?? 0) + 1 }))
  }, [])

  const reset = useCallback(() => {
    setVideo(null)
    setExchanges([])
    setError(null)
    setSeekRequest(null)
  }, [])

  if (!configured) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-serif text-2xl">Backend not configured</h1>
        <p className="mt-3 text-sm text-foreground/60">
          Set <code className="rounded bg-white/10 px-1.5 py-0.5">NEXT_PUBLIC_API_URL</code> to the CLIPIT API
          URL and redeploy.
        </p>
      </main>
    )
  }

  // Seek-bar ticks come from the newest completed exchange.
  const matches =
    [...exchanges].reverse().find((exchange) => exchange.request.status === "completed")?.request.matches ?? []

  return (
    <main className="flex min-h-dvh w-full flex-col px-6 py-8">
      <header className="mx-auto flex w-full max-w-6xl items-baseline justify-between gap-4">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          CLIPIT
        </Link>
        {video && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-foreground/40 underline underline-offset-4 transition-colors hover:text-foreground/80"
          >
            Start over
          </button>
        )}
      </header>

      {!video ? (
        <motion.div
          className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <h1 className="font-serif text-3xl">Add a video</h1>
          <p className="mt-2 text-sm text-foreground/55">
            Upload a file or paste a YouTube link. The video takes the stage while it is read once, end to end —
            then ask it anything.
          </p>
          <div className="mt-8">
            <SourceStep onUpload={startUpload} onYoutube={startYoutube} busy={busy} uploadFraction={uploadFraction} />
          </div>
        </motion.div>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-8 lg:pr-[380px]">
          <VideoStage video={video} uploadFraction={uploadFraction} matches={matches} seekRequest={seekRequest} />

          <p className="mx-auto mt-3 max-w-xl truncate text-center text-xs text-foreground/40">
            {video.title ?? video.originalFilename ?? video.sourceUrl}
            {video.durationTimecode ? ` · ${video.durationTimecode}` : ""}
          </p>

          <QueryDrawer
            video={video}
            exchanges={exchanges}
            busy={busy}
            onSearch={startSearch}
            onSeek={seekTo}
            onClip={clipMatch}
          />
        </div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mx-auto mt-4 w-full max-w-xl rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </motion.p>
      )}
    </main>
  )
}
