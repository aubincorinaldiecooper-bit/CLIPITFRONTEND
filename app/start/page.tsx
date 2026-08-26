"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { api, ApiError } from "@/lib/api"
import type { Clip, ClipRequest, MatchFeedback, Video } from "@/lib/types"
import { Button } from "@astryxdesign/core/Button"
import { Heading } from "@astryxdesign/core/Heading"
import { Text } from "@astryxdesign/core/Text"
import { MAX_FILES, MAX_FILE_BYTES, UploadPackage, type UploadEntry } from "@/components/flow/upload-package"
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
  /**
   * The files in this drop, each with its own progress and outcome.
   *
   * A single number could not carry this: five files uploading at once have
   * five different amounts done, and one of them failing must not be reported
   * as all five failing — or, worse, disappear.
   */
  const [uploads, setUploads] = useState<UploadEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seekRequest, setSeekRequest] = useState<{ seconds: number; token: number } | null>(null)
  /** Verdicts the server has not confirmed yet. See `reconcileVerdicts`. */
  const pendingVerdicts = useRef(new Map<string, MatchFeedback | null>())
  /** Per match, which rating attempt is the live one. See `rateMatch`. */
  const verdictAttempts = useRef(new Map<string, number>())

  const configured = api.isConfigured()

  /**
   * A page-wide failure — asking a question, cutting a clip.
   *
   * Upload failures do NOT come through here any more: with several files in
   * flight a banner at the top cannot say which one went wrong, so each one is
   * reported on its own row instead.
   */
  const fail = useCallback((cause: unknown) => {
    setError(cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.")
    setBusy(false)
  }, [])

  // --- source -------------------------------------------------------------

  /** Change one row without disturbing the others. */
  const patchUpload = useCallback((id: string, patch: Partial<UploadEntry>) => {
    setUploads((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }, [])

  /**
   * Carry one file all the way: ask for a slot, send the bytes, tell the
   * server it landed.
   *
   * Every failure is written onto that file's own row. Nothing here touches
   * the page-wide error, because with several files in flight a banner at the
   * top cannot say WHICH one went wrong — and the row can.
   */
  const runUpload = useCallback(
    async (entry: UploadEntry) => {
      patchUpload(entry.id, { phase: "uploading", progress: 0, error: undefined })
      try {
        const { video: created, upload } = await api.createUpload(
          entry.file.name,
          entry.file.type || undefined,
        )
        patchUpload(entry.id, { videoId: created.id })
        await api.uploadFile(upload, entry.file, (fraction) =>
          patchUpload(entry.id, { progress: fraction }),
        )
        const { video: queued } = await api.markUploaded(created.id)
        patchUpload(entry.id, { phase: "ready", progress: 1, videoId: queued.id })
        return queued
      } catch (cause) {
        patchUpload(entry.id, {
          phase: "failed",
          error: cause instanceof ApiError ? cause.message : "Upload failed. Try again.",
        })
        return null
      }
    },
    [patchUpload],
  )

  /**
   * Files picked or dropped.
   *
   * One file behaves exactly as it always has — it goes straight into the
   * theater, because that is the whole errand and stopping to show a list of
   * one would be a step for nothing. Several stay here with their rows, so a
   * failure among them is visible and retryable instead of being skipped past
   * on the way to whichever one happened to finish first.
   */
  const startUploads = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      setError(null)

      const room = Math.max(0, MAX_FILES - uploads.length)
      const taken = files.slice(0, room)
      const overflow = files.slice(room)

      const rejected: UploadEntry[] = []
      const accepted: UploadEntry[] = []
      taken.forEach((file, index) => {
        const entry: UploadEntry = {
          id: `${Date.now()}-${index}-${file.name}`,
          file,
          phase: "queued",
        }
        // Refused files still get a row. A file that vanishes on being dropped
        // reads as a bug in the page, where a row saying why reads as an
        // answer.
        if (file.size > MAX_FILE_BYTES) {
          rejected.push({ ...entry, phase: "failed", error: "Too large to upload" })
        } else {
          accepted.push(entry)
        }
      })
      overflow.forEach((file, index) => {
        rejected.push({
          id: `${Date.now()}-over-${index}-${file.name}`,
          file,
          phase: "failed",
          error: `More than ${MAX_FILES} files in one go`,
        })
      })

      const added = [...accepted, ...rejected]
      if (added.length === 0) return
      setUploads((current) => [...current, ...added])
      if (accepted.length === 0) return

      const single = uploads.length === 0 && added.length === 1
      setBusy(true)
      void Promise.all(accepted.map((entry) => runUpload(entry)))
        .then((results) => {
          // A lone file goes on into the theater, as it always did.
          const first = results.find((result) => result !== null)
          if (single && first) setVideo(first)
        })
        .finally(() => setBusy(false))
    },
    [runUpload, uploads.length],
  )

  const retryUpload = useCallback(
    (id: string) => {
      const entry = uploads.find((candidate) => candidate.id === id)
      // A file refused for its size or for overflowing the batch has nothing
      // to retry — trying again would fail the same way.
      if (!entry || entry.file.size > MAX_FILE_BYTES) return
      setBusy(true)
      void runUpload(entry).finally(() => setBusy(false))
    },
    [runUpload, uploads],
  )

  const removeUpload = useCallback((id: string) => {
    setUploads((current) => current.filter((entry) => entry.id !== id))
  }, [])

  // The YouTube-URL path used to start here, from a tab above the drop zone.
  // The owner removed that tab; `api.createYoutubeVideo` and the route behind
  // it are untouched, so bringing it back is a UI change and nothing more.

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
          className="mx-auto flex w-full max-w-[42rem] flex-1 flex-col justify-center py-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {/* Centred, per the mockup — the page has one thing to do and the
              heading sits over it rather than off to one side. */}
          <div className="text-center">
            <Heading level={1}>Add a video</Heading>
          </div>
          <div className="mx-auto mt-3 max-w-[20rem] text-center">
            <Text as="p" type="large" color="secondary">
              Upload a file. We&apos;ll read the video, then you can ask it anything.
            </Text>
          </div>
          <div className="mt-8">
            <UploadPackage
              entries={uploads}
              busy={busy}
              onAdd={startUploads}
              onRemove={removeUpload}
              onRetry={retryUpload}
              // Only offered once there is a choice to make. With one file the
              // page opens it for you.
              //
              // Fetched by id rather than looked up in `library`: that list is
              // loaded once, before any of these uploads existed, and is not
              // refreshed when they land — so searching it found nothing and
              // the button did nothing at all. Asking the server for the video
              // is also what the library rows do.
              onOpen={
                uploads.length > 1
                  ? (entry) => {
                      if (entry.videoId) void openFromLibrary(entry.videoId)
                    }
                  : undefined
              }
            />
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