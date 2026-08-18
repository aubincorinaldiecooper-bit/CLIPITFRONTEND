"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { api, ApiError } from "@/lib/api"
import type { Clip, ClipRequest, Video } from "@/lib/types"
import { EASE, StepShell, type StepState } from "@/components/flow/step-shell"
import { SourceStep } from "@/components/flow/source-step"
import { ProcessingStep } from "@/components/flow/processing-step"
import { InstructionStep } from "@/components/flow/instruction-step"
import { ResultsStep } from "@/components/flow/results-step"

const POLL_MS = 2000

/**
 * The whole clipping flow on one page.
 *
 * Each stage is revealed as the previous one completes and collapses to a
 * summary line, so the path from source to finished clip stays on screen.
 */
export default function StartPage() {
  const [video, setVideo] = useState<Video | null>(null)
  const [clipRequest, setClipRequest] = useState<ClipRequest | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [uploadFraction, setUploadFraction] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configured = api.isConfigured()

  const fail = useCallback((cause: unknown) => {
    setError(cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.")
    setBusy(false)
    setUploadFraction(null)
    setGenerating(false)
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
  const videoSettled = video?.status === "ready" || video?.status === "failed"

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

  const requestId = clipRequest?.id
  // Keep polling past completion while clips are still rendering.
  const clipsPending = clips.some((clip) => clip.status === "pending" || clip.status === "generating")
  const requestSettled =
    (clipRequest?.status === "completed" || clipRequest?.status === "failed") && !clipsPending

  useEffect(() => {
    if (!requestId || requestSettled) return

    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const { clipRequest: latest, clips: latestClips } = await api.getClipRequest(requestId)
        if (cancelled) return
        setClipRequest(latest)
        setClips(latestClips)
      } catch {
        // Ignore a dropped poll; the next tick will catch up.
      }
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [requestId, requestSettled])

  // Preselect every match the first time a search completes, so the common
  // case is one click rather than N.
  const preselected = useRef(false)
  useEffect(() => {
    if (preselected.current) return
    if (clipRequest?.status !== "completed") return
    const matches = clipRequest.matches ?? []
    if (matches.length === 0) return
    preselected.current = true
    setSelected(new Set(matches.map((match) => match.id)))
  }, [clipRequest])

  // --- actions ------------------------------------------------------------

  const startSearch = useCallback(
    async (instruction: string) => {
      if (!video) return
      setError(null)
      setBusy(true)
      try {
        const { clipRequest: created } = await api.createClipRequest(video.id, instruction)
        setClipRequest(created)
        setClips([])
        setSelected(new Set())
        preselected.current = false
      } catch (cause) {
        fail(cause)
      } finally {
        setBusy(false)
      }
    },
    [video, fail],
  )

  const generate = useCallback(async () => {
    if (!clipRequest) return
    setError(null)
    setGenerating(true)
    try {
      const { clips: created } = await api.generateClips(clipRequest.id, Array.from(selected))
      setClips((current) => {
        const merged = new Map(current.map((clip) => [clip.id, clip]))
        for (const clip of created) merged.set(clip.id, clip)
        return Array.from(merged.values())
      })
    } catch (cause) {
      fail(cause)
    } finally {
      setGenerating(false)
    }
  }, [clipRequest, selected, fail])

  const toggle = useCallback((matchId: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setVideo(null)
    setClipRequest(null)
    setClips([])
    setSelected(new Set())
    setError(null)
    preselected.current = false
  }, [])

  // --- stage derivation ---------------------------------------------------

  const sourceState: StepState = video ? "done" : "active"
  const processingState: StepState = !video ? "upcoming" : video.readyForSearch ? "done" : "active"
  const instructionState: StepState = !video?.readyForSearch ? "upcoming" : clipRequest ? "done" : "active"
  const resultsState: StepState = clipRequest ? "active" : "upcoming"

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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
      <header className="mb-10 flex items-baseline justify-between gap-4">
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

      <div className="space-y-3">
        <StepShell
          index={1}
          title="Add a video"
          state={sourceState}
          summary={video?.title ?? video?.originalFilename ?? video?.sourceUrl ?? undefined}
        >
          <SourceStep
            onUpload={startUpload}
            onYoutube={startYoutube}
            busy={busy}
            uploadFraction={uploadFraction}
          />
        </StepShell>

        <StepShell
          index={2}
          title="Processing"
          state={processingState}
          summary={
            video?.durationTimecode ? `${video.durationTimecode} · ${video.chunkCount} segments` : "Ready"
          }
        >
          {video && <ProcessingStep video={video} />}
        </StepShell>

        <StepShell
          index={3}
          title="What do you want to find?"
          state={instructionState}
          summary={clipRequest?.instruction}
        >
          {video && <InstructionStep video={video} onSubmit={startSearch} busy={busy} />}
        </StepShell>

        <StepShell index={4} title="Moments" state={resultsState}>
          {clipRequest && (
            <ResultsStep
              clipRequest={clipRequest}
              clips={clips}
              selected={selected}
              onToggle={toggle}
              onGenerate={generate}
              generating={generating}
            />
          )}
        </StepShell>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-6 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </motion.p>
      )}
    </main>
  )
}
