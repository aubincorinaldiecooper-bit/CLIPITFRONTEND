"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { api, ApiError } from "@/lib/api"
import type { ClipMatch, MatchFeedback, MatchFeedbackReason, Video } from "@/lib/types"

import type { UploadEntry } from "@/components/flow/upload-package"
import { useVideoUploads } from "@/components/flow/use-video-uploads"
import { UpgradeDialog } from "@/components/flow/upgrade-dialog"
import { WorkspaceShell } from "@/components/workspace/shell"
import { Wizard } from "@/components/start/wizard"
import { UploadStep } from "@/components/start/upload-step"
import { WatchStep } from "@/components/start/watch-step"
import { ReviewStep } from "@/components/start/review-step"
import type { Exchange, StartStep } from "@/components/start/types"

const POLL_MS = 2000
const EASE = [0.23, 1, 0.32, 1] as const

export default function StartPage() {
  const [video, setVideo] = useState<Video | null>(null)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<StartStep>("upload")
  const [promptDraft, setPromptDraft] = useState("")

  /** Verdicts the server has not confirmed yet. See `reconcileVerdicts`. */
  const pendingVerdicts = useRef(
    new Map<string, { verdict: MatchFeedback | null; reason: MatchFeedbackReason | null }>(),
  )
  /** Per match, which rating attempt is the live one. See `rateMatch`. */
  const verdictAttempts = useRef(new Map<string, number>())

  const configured = api.isConfigured()

  /**
   * A page-wide failure — asking a question, cutting a clip.
   *
   * Upload failures do NOT come through here: with several files in flight a
   * banner at the top cannot say which one went wrong, so each one is
   * reported on its own row instead (the shared engine owns that).
   */
  const fail = useCallback((cause: unknown) => {
    setError(cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.")
    setBusy(false)
  }, [])

  /**
   * The uploads, run by the shared engine (components/flow/use-video-uploads)
   * — the same one the library's drag-anywhere uses, so a file behaves
   * identically whichever door it came through. When a drop's batch lands, the
   * wizard enables the Next button; the user is in control of moving on.
   */
  const {
    uploads,
    setUploads,
    startUploads,
    retryUpload,
    removeUpload,
    overLimit,
    clearOverLimit,
  } = useVideoUploads({
    onBatchLanded: (videos) => {
      const first = videos[0]
      if (first) setVideo((current) => current ?? first)
    },
  })

  /**
   * Videos handed over from another door — the library uploads on /clips,
   * then arrives here as ?videos=id,id. The batch is seeded so the carousel
   * can walk it, and the first one opens.
   */
  useEffect(() => {
    const handed = new URLSearchParams(window.location.search).get("videos")
    if (!handed) return
    const ids = handed.split(",").filter(Boolean)
    if (ids.length === 0) return
    // The address is consumed: reloading must not re-open a stale batch.
    const url = new URL(window.location.href)
    url.searchParams.delete("videos")
    window.history.replaceState(window.history.state, "", url.toString())
    setUploads(
      ids.map((videoId, index) => ({
        id: `handed-${index}-${videoId}`,
        file: new File([], "Uploaded video"),
        phase: "ready" as const,
        videoId,
      })),
    )
    void openFromLibrary(ids[0]!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * How far along the video currently on screen is.
   *
   * Derived from that one file's row rather than held separately: with several
   * uploads running there is no single "the" progress, and the theater only
   * ever shows one video. Null once its bytes have landed, which is also what
   * releases the poller below.
   */
  const activeUpload = uploads.find((entry) => entry.videoId !== undefined && entry.videoId === video?.id)
  const uploadFraction =
    activeUpload?.phase === "uploading" ? activeUpload.progress ?? 0 : null

  // --- polling ------------------------------------------------------------

  const videoId = video?.id
  const indexSettled =
    video?.index == null ||
    video.index.status === "ready" ||
    video.index.status === "failed" ||
    video.index.status === "unavailable"
  const videoSettled = video?.status === "failed" || (video?.status === "ready" && indexSettled && !!video?.playback)

  useEffect(() => {
    if (!videoId || videoSettled || uploadFraction !== null) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const { video: latest } = await api.getVideo(videoId)
        if (!cancelled) setVideo(latest)
      } catch {
        // A transient poll failure is not worth interrupting the flow for.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS)
    }

    timer = setTimeout(poll, POLL_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [videoId, videoSettled, uploadFraction])

  /**
   * Re-applies verdicts the server has not confirmed yet.
   */
  const reconcileVerdicts = useCallback((request: Exchange["request"]): Exchange["request"] => {
    const pending = pendingVerdicts.current
    if (pending.size === 0 || !request.matches?.length) return request

    const matches = request.matches.map((match) => {
      const held = pending.get(match.id)
      if (held === undefined) return match
      if (match.feedback === held.verdict && (match.feedbackReason ?? null) === held.reason) {
        pending.delete(match.id)
        return match
      }
      return { ...match, feedback: held.verdict, feedbackReason: held.reason }
    })

    return { ...request, matches }
  }, [])

  const unsettledIds = exchanges
    .filter(
      (exchange) =>
        exchange.request.status === "pending" ||
        exchange.request.status === "searching" ||
        exchange.request.matches?.some((match) => match.reclipStatus === "pending") ||
        exchange.clips.some((clip) => clip.status === "pending" || clip.status === "generating") ||
        // A vertical moment is not finished when its landscape cut is: the
        // 9:16 render follows, and the tile says "Cutting…" until it lands.
        // Without this the request settles on the cut and the render is
        // never fetched — the tile stays cutting until a reload.
        exchange.clips.some((clip) => clip.media?.derivativeStatus === "pending"),
    )
    .map((exchange) => exchange.request.id)
  const unsettledKey = unsettledIds.join(",")

  useEffect(() => {
    if (unsettledIds.length === 0) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      for (const id of unsettledIds) {
        if (cancelled) return
        try {
          const { clipRequest: latest, clips: latestClips } = await api.getClipRequest(id)
          if (cancelled) return
          const reconciled = reconcileVerdicts(latest)
          setExchanges((previous) =>
            previous.map((exchange) =>
              exchange.request.id === reconciled.id ? { request: reconciled, clips: latestClips } : exchange,
            ),
          )
        } catch {
          // Ignore a dropped poll; the next round will catch up.
        }
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS)
    }

    timer = setTimeout(poll, POLL_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsettledKey, reconcileVerdicts])

  // --- actions ------------------------------------------------------------

  const currentRequest = exchanges.at(-1)?.request ?? null

  /**
   * A search that is still running. Leaving the waiting screen does not stop
   * it — nothing can, there is no cancel on the server — so asking again is
   * routed back to the search in flight instead of starting a second one.
   */
  const searchRunning = currentRequest?.status === "pending" || currentRequest?.status === "searching"

  /**
   * Asks a question of the video. The first question goes to the waiting
   * screen; one asked from the review screen stays there — its moments land
   * in the feed as they are cut, and the dialogue shows it looking.
   */
  const startSearch = useCallback(
    async (instruction: string, options: { stay?: boolean } = {}): Promise<boolean> => {
      if (!video || busy) return false
      setError(null)
      setBusy(true)
      try {
        const { clipRequest: created } = await api.createClipRequest(video.id, instruction)
        setExchanges((previous) => [...previous, { request: created, clips: [] }])
        if (!options.stay) setStep("watch")
        return true
      } catch (cause) {
        fail(cause)
        return false
      } finally {
        setBusy(false)
      }
    },
    [video, busy, fail],
  )

  const handleNext = useCallback(() => {
    if (step === "upload") {
      if (searchRunning) {
        setStep("watch")
        return
      }
      const instruction = promptDraft.trim()
      if (!instruction || !video?.readyForSearch || busy) return
      setPromptDraft("")
      void startSearch(instruction)
    } else if (step === "watch") {
      setStep("review")
    }
  }, [step, promptDraft, video, busy, searchRunning, startSearch])

  const handleBack = useCallback(() => {
    if (step === "watch") setStep("upload")
  }, [step])

  /** Drops the search that could not finish, but keeps its text so the user can edit and resend. */
  const retrySearch = useCallback(() => {
    const instruction = currentRequest?.instruction ?? ""
    setExchanges((previous) => previous.slice(0, -1))
    setPromptDraft(instruction)
    setError(null)
    setStep("upload")
  }, [currentRequest?.instruction])

  /**
   * Taking a file off the list takes it off the screen too: a video that was
   * removed cannot stay the one being asked about.
   */
  const dropUpload = useCallback(
    (entryId: string) => {
      const dropped = uploads.find((entry) => entry.id === entryId)
      removeUpload(entryId)
      if (dropped?.videoId && dropped.videoId === video?.id) {
        setVideo(null)
        setExchanges([])
        setPromptDraft("")
        setStep("upload")
      }
    },
    [uploads, removeUpload, video?.id],
  )

  /** Resolves true once the server has taken the Re-clip; false when it refused, with the reason shown. */
  const reclipMatch = useCallback(
    async (exchangeRequestId: string, matchId: string): Promise<boolean> => {
      setError(null)
      const paint = (match: ClipMatch): ClipMatch => ({
        ...match,
        reclipStatus: "pending",
        reclipError: null,
      })
      setExchanges((previous) =>
        previous.map((exchange) =>
          exchange.request.id === exchangeRequestId
            ? {
                ...exchange,
                request: {
                  ...exchange.request,
                  matches: exchange.request.matches?.map((match) => (match.id === matchId ? paint(match) : match)),
                },
              }
            : exchange,
        ),
      )
      try {
        const { match } = await api.reclipMatch(exchangeRequestId, matchId)
        setExchanges((previous) =>
          previous.map((exchange) =>
            exchange.request.id === exchangeRequestId
              ? {
                  ...exchange,
                  request: {
                    ...exchange.request,
                    matches: exchange.request.matches?.map((existing) => (existing.id === matchId ? match : existing)),
                  },
                }
              : exchange,
          ),
        )
        return true
      } catch (cause) {
        setExchanges((previous) =>
          previous.map((exchange) =>
            exchange.request.id === exchangeRequestId
              ? {
                  ...exchange,
                  request: {
                    ...exchange.request,
                    matches: exchange.request.matches?.map((existing) =>
                      existing.id === matchId ? { ...existing, reclipStatus: null } : existing,
                    ),
                  },
                }
              : exchange,
          ),
        )
        fail(cause)
        return false
      }
    },
    [fail],
  )

  const showVerdict = useCallback(
    (
      exchangeRequestId: string,
      matchId: string,
      verdict: MatchFeedback | null,
      reason: MatchFeedbackReason | null = null,
    ) =>
      setExchanges((previous) =>
        previous.map((exchange) => {
          if (exchange.request.id !== exchangeRequestId) return exchange
          const matches = exchange.request.matches?.map((match) =>
            match.id === matchId ? { ...match, feedback: verdict, feedbackReason: reason } : match,
          )
          return matches ? { ...exchange, request: { ...exchange.request, matches } } : exchange
        }),
      ),
    [],
  )

  const rateMatch = useCallback(
    async (
      exchangeRequestId: string,
      matchId: string,
      verdict: MatchFeedback | null,
      reason?: MatchFeedbackReason | null,
    ) => {
      setError(null)

      const previousMatch = exchanges
        .find((exchange) => exchange.request.id === exchangeRequestId)
        ?.request.matches?.find((match) => match.id === matchId)
      const previousVerdict = previousMatch?.feedback ?? null
      const previousReason = previousMatch?.feedbackReason ?? null

      const attempt = (verdictAttempts.current.get(matchId) ?? 0) + 1
      verdictAttempts.current.set(matchId, attempt)
      const isCurrent = () => verdictAttempts.current.get(matchId) === attempt

      pendingVerdicts.current.set(matchId, { verdict, reason: reason ?? null })
      showVerdict(exchangeRequestId, matchId, verdict, reason ?? null)

      try {
        const { match } = await api.rateMatch(exchangeRequestId, matchId, verdict, reason ?? null)
        if (!isCurrent()) return
        pendingVerdicts.current.set(matchId, {
          verdict: match.feedback ?? null,
          reason: match.feedbackReason ?? null,
        })
        showVerdict(exchangeRequestId, matchId, match.feedback ?? null, match.feedbackReason ?? null)
      } catch (cause) {
        if (!isCurrent()) return
        pendingVerdicts.current.delete(matchId)
        showVerdict(exchangeRequestId, matchId, previousVerdict, previousReason)
        fail(cause)
      }
    },
    [exchanges, fail, showVerdict],
  )

  const keepMatch = useCallback(
    async (exchangeRequestId: string, matchId: string) => {
      setError(null)
      const attempt = (verdictAttempts.current.get(matchId) ?? 0) + 1
      verdictAttempts.current.set(matchId, attempt)
      const isCurrent = () => verdictAttempts.current.get(matchId) === attempt

      pendingVerdicts.current.set(matchId, { verdict: "approved", reason: null })
      showVerdict(exchangeRequestId, matchId, "approved", null)

      try {
        await api.rateMatch(exchangeRequestId, matchId, "approved", null)
      } catch (cause) {
        if (!isCurrent()) return
        pendingVerdicts.current.delete(matchId)
        showVerdict(exchangeRequestId, matchId, null, null)
        fail(cause)
        return
      }

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
        if (!isCurrent()) return
        pendingVerdicts.current.set(matchId, { verdict: null, reason: null })
        showVerdict(exchangeRequestId, matchId, null, null)
        void api.rateMatch(exchangeRequestId, matchId, null, null).catch(() => undefined)
        fail(cause)
      }
    },
    [fail, showVerdict],
  )

  const reset = useCallback(() => {
    setVideo(null)
    setExchanges([])
    setError(null)
    setStep("upload")
    setPromptDraft("")
  }, [])

  const openFromLibrary = useCallback(
    async (videoIdToOpen: string) => {
      setError(null)
      setBusy(true)
      try {
        const { video: opened } = await api.getVideo(videoIdToOpen)
        setExchanges([])
        setPromptDraft("")
        setVideo(opened)
        setStep("upload")
      } catch (cause) {
        fail(cause)
      } finally {
        setBusy(false)
      }
    },
    [fail],
  )

  useEffect(() => {
    if (step !== "watch") return
    // A search that failed has no moments to review; the waiting screen shows
    // what went wrong and offers another go.
    if (currentRequest?.status === "completed") setStep("review")
  }, [step, currentRequest?.status])

  if (!configured) {
    return (
      <main className="shadcn-scope mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center bg-background px-6 py-16 text-foreground">
        <h1 className="text-2xl font-semibold tracking-tight">Backend not configured</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Set <code className="rounded bg-shmuted px-1.5 py-0.5">NEXT_PUBLIC_API_URL</code> to the CLIPIT API
          URL and redeploy.
        </p>
      </main>
    )
  }

  return (
    <WorkspaceShell active="start">
      <div className="flex w-full flex-1 flex-col">
        {step !== "review" ? (
          <Wizard step={step}>
            {step === "upload" && (
              <UploadStep
                entries={uploads}
                video={video}
                promptValue={promptDraft}
                onPromptChange={setPromptDraft}
                onAdd={startUploads}
                onRemove={dropUpload}
                onRetry={retryUpload}
                onSubmit={handleNext}
                onResume={() => setStep("watch")}
                disabled={busy}
                searchInstruction={searchRunning ? currentRequest?.instruction : undefined}
              />
            )}
            {step === "watch" && (
              <WatchStep request={currentRequest} onBack={handleBack} onRetry={retrySearch} />
            )}
          </Wizard>
        ) : (
          <ReviewStep
            exchanges={exchanges}
            video={video}
            busy={busy}
            searching={searchRunning}
            onKeep={keepMatch}
            onSkip={(requestId, matchId) => rateMatch(requestId, matchId, "rejected")}
            onUndoSkip={(requestId, matchId) => rateMatch(requestId, matchId, null)}
            onReclip={reclipMatch}
            onAsk={(instruction) => (searchRunning ? false : startSearch(instruction, { stay: true }))}
            onUploadMore={reset}
          />
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="mx-auto mt-4 w-full max-w-xl rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </div>
      <UpgradeDialog files={overLimit} onClose={clearOverLimit} />
    </WorkspaceShell>
  )
}
