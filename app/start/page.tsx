"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { api, ApiError } from "@/lib/api"
import type { Clip, ClipRequest, MatchFeedback, Video } from "@/lib/types"
import { Button } from "@astryxdesign/core/Button"
import { Heading } from "@astryxdesign/core/Heading"
import { Text } from "@astryxdesign/core/Text"
import { SourceStep } from "@/components/flow/source-step"
import { VideoStage } from "@/components/theater/video-stage"
import { QueryDrawer } from "@/components/theater/query-drawer"
import { AppShell } from "@/components/app-shell"

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
  /** Verdicts the server has not confirmed yet. See `reconcileVerdicts`. */
  const pendingVerdicts = useRef(new Map<string, MatchFeedback | null>())
  /** Per match, which rating attempt is the live one. See `rateMatch`. */
  const verdictAttempts = useRef(new Map<string, number>())

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

    /**
     * One request at a time, scheduled after the last one lands.
     *
     * On an interval, a slow response can arrive after a newer one and
     * overwrite it with older state — which shows up as the reading progress
     * counting backwards, the exact "is it broken?" the progress was added to
     * answer. Chaining the next poll to the end of the previous one makes the
     * order impossible to get wrong, and stops requests stacking up on a
     * connection too slow to keep pace with them.
     */
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
   *
   * A poll replaces a whole exchange, so one that left before a rating landed
   * arrives after it carrying the old answer — and if that same poll reports a
   * clip ready, polling stops and the verdict stays wrong for the session.
   * Holding the verdict here and laying it back over polled data keeps the two
   * from racing. Each entry drops itself the moment the server says the same
   * thing, so this never becomes a second source of truth.
   */
  const reconcileVerdicts = useCallback((request: ClipRequest): ClipRequest => {
    const pending = pendingVerdicts.current
    if (pending.size === 0 || !request.matches?.length) return request

    const matches = request.matches.map((match) => {
      if (!pending.has(match.id)) return match
      const verdict = pending.get(match.id) ?? null
      if (match.feedback === verdict) {
        pending.delete(match.id)
        return match
      }
      return { ...match, feedback: verdict }
    })

    return { ...request, matches }
  }, [])

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

    // Same reasoning as the video poll above: one round at a time, scheduled
    // after the last one finishes, so a slow response cannot land after a
    // newer one and put back state the user has already moved past.
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

  const startSearch = useCallback(
    async (instruction: string) => {
      // Guarded here rather than only at each button. Every caller pays for a
      // search, and a second one started while the first is in flight is work
      // the person asked for once and is charged for twice.
      if (!video || busy) return
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
    [video, busy, fail],
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

  const showVerdict = useCallback(
    (exchangeRequestId: string, matchId: string, verdict: MatchFeedback | null) =>
      setExchanges((previous) =>
        previous.map((exchange) => {
          if (exchange.request.id !== exchangeRequestId) return exchange
          const matches = exchange.request.matches?.map((match) =>
            match.id === matchId ? { ...match, feedback: verdict } : match,
          )
          return matches ? { ...exchange, request: { ...exchange.request, matches } } : exchange
        }),
      ),
    [],
  )

  /**
   * Records what someone thought of a match, without waiting for the server.
   *
   * A thumbs-down takes the moment off the screen, and a removal that lags
   * behind the tap reads as the tap not having registered — so the state moves
   * first and is put back if the request fails. Each attempt carries a
   * sequence number for that match: a slow failure must not undo a verdict the
   * user has since replaced, which would resurrect a moment they removed twice.
   */
  const rateMatch = useCallback(
    async (exchangeRequestId: string, matchId: string, verdict: MatchFeedback | null) => {
      setError(null)

      const previousVerdict =
        exchanges
          .find((exchange) => exchange.request.id === exchangeRequestId)
          ?.request.matches?.find((match) => match.id === matchId)?.feedback ?? null

      const attempt = (verdictAttempts.current.get(matchId) ?? 0) + 1
      verdictAttempts.current.set(matchId, attempt)
      const isCurrent = () => verdictAttempts.current.get(matchId) === attempt

      pendingVerdicts.current.set(matchId, verdict)
      showVerdict(exchangeRequestId, matchId, verdict)

      try {
        const { match } = await api.rateMatch(exchangeRequestId, matchId, verdict)
        if (!isCurrent()) return
        // Trust the row the server returned rather than what was sent, and keep
        // holding it until a poll comes back agreeing.
        pendingVerdicts.current.set(matchId, match.feedback ?? null)
        showVerdict(exchangeRequestId, matchId, match.feedback ?? null)
      } catch (cause) {
        if (!isCurrent()) return
        pendingVerdicts.current.delete(matchId)
        showVerdict(exchangeRequestId, matchId, previousVerdict)
        fail(cause)
      }
    },
    [exchanges, fail, showVerdict],
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

  /**
   * What signing in is for: the videos come back.
   *
   * Fetched once on the landing screen. Guests get their own tab's uploads,
   * which on a fresh tab is nothing — so for them the list simply never
   * appears and the screen is exactly what it was before accounts existed.
   */
  const [library, setLibrary] = useState<Video[]>([])
  useEffect(() => {
    if (video) return
    let cancelled = false
    void api
      .listVideos()
      .then(({ videos }) => {
        if (!cancelled) setLibrary(videos.filter((entry) => entry.status !== "failed"))
      })
      .catch(() => {
        // A library that cannot load is a landing page without a list, not an
        // error worth interrupting an upload for.
      })
    return () => {
      cancelled = true
    }
  }, [video])

  const openFromLibrary = useCallback(
    async (videoId: string) => {
      setError(null)
      setBusy(true)
      try {
        const { video: opened } = await api.getVideo(videoId)
        setExchanges([])
        setSeekRequest(null)
        setVideo(opened)
      } catch (cause) {
        fail(cause)
      } finally {
        setBusy(false)
      }
    },
    [fail],
  )

  if (!configured) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <Heading level={1}>Backend not configured</Heading>
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
    <AppShell
      active="start"
      headerExtra={
        video ? (
          <Button
            label="Clip another video"
            variant="primary"
            size="sm"
            onClick={reset}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
            }
          />
        ) : undefined
      }
    >
      <div className="flex w-full flex-1 flex-col px-6 py-6">
      {!video ? (
        <motion.div
          className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {/* Centred, per the mockup — the page has one thing to do and the
              heading sits over it rather than off to one side. */}
          <div className="text-center">
            <Heading level={1}>Add a video</Heading>
          </div>
          <div className="mx-auto mt-2 max-w-md text-center">
            <Text as="p" type="supporting">
              Upload a file or paste a YouTube link. We&apos;ll read the video once, end to end — then you
              can ask it anything.
            </Text>
          </div>
          <div className="mt-8">
            <SourceStep onUpload={startUpload} onYoutube={startYoutube} busy={busy} uploadFraction={uploadFraction} />
          </div>

          {library.length > 0 && (
            <div className="mt-10">
              <p className="text-[13px] font-medium text-foreground/40">Your videos</p>
              <div className="mt-2 flex flex-col gap-1">
                {library.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => void openFromLibrary(entry.id)}
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-white/10 transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground/85">
                      {entry.title ?? entry.originalFilename ?? entry.sourceUrl ?? "Untitled video"}
                    </span>
                    {entry.durationTimecode && (
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground/40">
                        {entry.durationTimecode}
                      </span>
                    )}
                    <span className="shrink-0 text-[12px] text-foreground/35">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
            onRate={rateMatch}
          />
        </div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mx-auto mt-4 w-full max-w-xl rounded-lg border border-error px-4 py-3 text-sm text-error"
        >
          {error}
        </motion.p>
      )}
      </div>
    </AppShell>
  )
}