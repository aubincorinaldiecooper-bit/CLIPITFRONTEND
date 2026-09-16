"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import { AnimatePresence } from "motion/react"
import { api, ApiError } from "@/lib/api"
import type { ChatSignal, Clip, ClipMatch, InternetSearchState, MatchFeedback, MatchFeedbackReason, Video } from "@/lib/types"

import type { UploadEntry } from "@/components/flow/upload-package"
import { useVideoUploads } from "@/components/flow/use-video-uploads"
import { UpgradeDialog } from "@/components/flow/upgrade-dialog"
import { SearchShell } from "@/components/moments/search-shell"
import { FollowUpComposer, SearchHome } from "@/components/moments/search-home"
import { InternetStage } from "@/components/moments/internet-stage"
import { ResultsStage } from "@/components/moments/results-stage"
import { MomentConversation } from "@/components/moments/moment-conversation"
import { PublishDialog } from "@/components/start/publish-dialog"
import { clipRowFor, needsKeep, publishableFor } from "@/components/start/production"
import { oneAtATime, runKeep } from "@/components/start/keep-flow"
import { feedMoments, type FeedMoment } from "@/components/start/moments"
import { askGate, askTarget } from "@/components/start/ask-gate"
import { nextRead, RETRY_MS } from "@/components/start/search-polling"
import type { Exchange } from "@/components/start/types"
import { consumeSearchParams, matchForClip, restoreConversation } from "@/components/start/restore"
import { writeSearchParams } from "@/lib/search-params"
import { setReportContext } from "@/lib/report-context"
import { useWorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
import { readIntent } from "@/components/sign-in-gate"

const POLL_MS = 2000
const EASE = [0.23, 1, 0.32, 1] as const

/**
 * The three screens' addresses, on one page.
 *
 *   /start                                  search home
 *   /start?video=V&search=S                 the results of question S
 *   /start?video=V&search=S&moment=M        one moment of them, with its conversation
 *
 * One page holding one conversation — the video, its questions, the
 * polling, keep and publish — and three addresses within it, written
 * with the native history API so Back and Forward walk the screens and a
 * reload lands where it left off (the owner's call of 2026-09-02 that the
 * conversation comes back with the video). The library opens a video here
 * the same way, with `video`.
 */
interface Address {
  video: string | null
  search: string | null
  moment: string | null
  /**
   * A question asked of the internet. It has no video and no request of its
   * own, so it gets its own name in the address — which is what makes the
   * results a screen you can reload, link to, and come back to with Back,
   * rather than something that only exists until you look away.
   */
  ask: string | null
}

function readAddress(): Address {
  const params = new URL(window.location.href).searchParams
  return {
    video: params.get("video"),
    search: params.get("search"),
    moment: params.get("moment"),
    ask: params.get("ask"),
  }
}

/**
 * The errand a sign-in was asked for, read on return once the person is
 * signed in. Rendered inside the shell, where the gate lives; the page
 * itself renders the shell and so cannot use the gate's hooks. The errand
 * is only READ here: it leaves the address when the page carries it out,
 * so a return whose loading failed keeps it for a reload to try again
 * (Devin's finding on #82).
 */
function ResumeAfterSignIn({ onPublish }: { onPublish: (clipId: string) => void }) {
  const { isSignedIn } = useWorkspaceSignInGate()
  const handed = useRef(false)
  useEffect(() => {
    if (!isSignedIn || handed.current) return
    const intent = readIntent(window.location.search)
    if (intent?.action !== "publish") return
    handed.current = true
    onPublish(intent.clipId)
  }, [isSignedIn, onPublish])
  return null
}

export default function StartPage() {
  const [video, setVideo] = useState<Video | null>(null)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  /** The conversation as it is now, for work that waited its turn. */
  const exchangesRef = useRef(exchanges)
  exchangesRef.current = exchanges
  /** Moments whose Keep is being written; their cards' Keep waits. */
  const [keepingIds, setKeepingIds] = useState<ReadonlySet<string>>(() => new Set())
  const keepQueue = useRef(new Map<string, Promise<unknown>>())
  const keepingRef = useRef(keepingIds)
  keepingRef.current = keepingIds
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The internet search on screen: how it is doing and what it has found. */
  const [internetSearch, setInternetSearch] = useState<InternetSearchState | null>(null)
  const [promptDraft, setPromptDraft] = useState("")
  /** The address, mirrored: which screen, and which question and moment it is about. */
  const [address, setAddress] = useState<Address>({ video: null, search: null, moment: null, ask: null })
  /** Move between the screens: write the address, then read it back. */
  const go = useCallback((changes: Partial<Address>, mode: "push" | "replace" = "push") => {
    writeSearchParams(changes, mode)
    setAddress(readAddress())
  }, [])
  /**
   * A new screen starts at its top. The screens share one scrolling
   * region (the shell's), and pushState does not touch it — so "Open
   * moment" pressed low on a long results page opened the moment page
   * scrolled past its own heading and its way back.
   */
  const screenRoot = useRef<HTMLDivElement>(null)
  const screenKey = `${address.ask ?? ""}/${address.search ?? ""}/${address.moment ?? ""}`
  useEffect(() => {
    window.scrollTo({ top: 0 })
    for (let node = screenRoot.current?.parentElement ?? null; node; node = node.parentElement) {
      if (node.scrollTop > 0) node.scrollTop = 0
    }
  }, [screenKey])
  // The address says which video is attached, whichever door it came
  // through, so a reload keeps it and Back from the results still has it.
  const videoId = video?.id ?? null
  useEffect(() => {
    if (videoId && address.video !== videoId) go({ video: videoId }, "replace")
  }, [videoId, address.video, go])
  /** The moment in the centre of the stage, so the stage reopens on it and a report names its question. */
  const [stagedMomentId, setStagedMomentId] = useState<string | null>(null)
  const onStagedMomentChange = useCallback((moment: FeedMoment | undefined) => {
    if (moment) setStagedMomentId(moment.match.id)
  }, [])
  /** Sound is one setting for the whole page: unmute once, stay unmuted from card to page. */
  const [muted, setMuted] = useState(true)
  /**
   * The kept clip the publish screens are open for, if any. Only its
   * identity is held: whether its file is ready is read from the
   * conversation on every render, so the dialog's "ready" follows the
   * server rather than a snapshot taken at the press.
   */
  const [publishing, setPublishing] = useState<{ id: string; title: string } | null>(null)
  /** A Publish press whose keep is still being written: the feed waits, and a second press is refused. */
  const [publishPending, setPublishPending] = useState(false)
  const publishInFlight = useRef(false)
  /** A clip a sign-in was asked for; published once the conversation it belongs to is back. */
  const [resumePublish, setResumePublish] = useState<string | null>(null)

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
    clearUploads,
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
   * The address on arrival: a video opened from the library, a reload, a
   * sign-in that came back. The video named there is opened, with its
   * conversation, and the screen follows from the rest of the address.
   */
  useEffect(() => {
    const first = readAddress()
    setAddress(first)
    // Back and Forward walk the screens; the page follows the address.
    const onPop = () => setAddress(readAddress())
    window.addEventListener("popstate", onPop)
    if (first.video) void openFromLibrary(first.video)
    return () => window.removeEventListener("popstate", onPop)
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
   * Which screen, from the address alone: a moment it names that is on
   * stage, else the results of the question it names (the newest, if the
   * one named is not here), else home. The conversation does not get a
   * say — Back from the results must land on home, with the video still
   * attached, not on the results again (Devin's finding on #95) — so a
   * video opened with a conversation has its newest question written into
   * the address as it opens.
   */
  const stagedExchange = useMemo(
    () => (video && address.search ? (exchanges.find((exchange) => exchange.request.id === address.search) ?? exchanges.at(-1) ?? null) : null),
    [video, exchanges, address.search],
  )
  const stagedMoments = useMemo(() => (stagedExchange ? feedMoments([stagedExchange], video) : []), [stagedExchange, video])
  const openMoment = address.moment ? stagedMoments.find((moment) => moment.match.id === address.moment) : undefined
  /**
   * Which screen, from the address alone.
   *
   * A question asked of the internet has no video and no request, so it is
   * named in the address in its own right. A video question wins if somehow
   * both are named: the video is the thing on screen, and the ask would be
   * one left behind.
   */
  const screen: "home" | "results" | "moment" | "internet" = stagedExchange
    ? openMoment
      ? "moment"
      : "results"
    : address.ask
      ? "internet"
      : "home"

  // What a problem reported from this page is about: the video, and the
  // question on stage — the one that owns the moment on screen (Devin's
  // finding on #88). Cleared on the way out.
  const reportVideoId = video?.id ?? null
  const reportRequestId = stagedExchange?.request.id ?? currentRequest?.id ?? null
  useEffect(() => {
    setReportContext({ videoId: reportVideoId, clipRequestId: reportRequestId })
    return () => setReportContext({ videoId: null, clipRequestId: null })
  }, [reportVideoId, reportRequestId])

  /**
   * Asks a question of the video. Every question, the first included, is
   * answered on the review screen: the dialogue acknowledges it at once and
   * says what the search is doing, and its moments land in the feed as they
   * are found. There is no waiting screen any more.
   */
  const startSearch = useCallback(
    async (instruction: string): Promise<boolean> => {
      if (!video || busy) return false
      setError(null)
      setBusy(true)
      try {
        const { clipRequest: created } = await api.createClipRequest(video.id, instruction)
        setExchanges((previous) => [...previous, { request: created, clips: [] }])
        // Its results, where the search says what it is doing and its
        // moments land as they are found.
        go({ video: video.id, search: created.id, moment: null })
        return true
      } catch (cause) {
        fail(cause)
        return false
      } finally {
        setBusy(false)
      }
    },
    [video, busy, fail, go],
  )

  /**
   * The same question, asked of the internet instead of a video. It answers
   * in one step, so there is no waiting screen and nothing to poll.
   */
  const startInternetSearch = useCallback(
    async (query: string): Promise<boolean> => {
      if (busy) return false
      setError(null)
      setBusy(true)
      try {
        // The search answers at once with somewhere to follow it, not with an
        // answer: watching pages takes minutes, and the results screen fills
        // as they are watched.
        const started = await api.startInternetSearch(query)
        setInternetSearch(started)
        // Its own address, so the screen survives a reload and Back returns
        // to the empty box rather than leaving the page altogether.
        go({ ask: started.searchId, video: null, search: null, moment: null })
        return true
      } catch (cause) {
        // A search that could not start has told us nothing about what is out
        // there. Leaving the last one on screen, or showing an empty result,
        // would both say something we did not find out.
        setInternetSearch(null)
        fail(cause)
        return false
      } finally {
        setBusy(false)
      }
    },
    [busy, fail, go],
  )

  /**
   * Follow the search on screen until it is done.
   *
   * Every reply carries everything found so far, not just what is new, so a
   * poll that is missed or arrives out of order can never leave the screen
   * permanently short a moment.
   */
  useEffect(() => {
    const searchId = address.ask
    if (!searchId) return
    if (internetSearch?.searchId === searchId && internetSearch.phase === "answered") return

    let stopped = false
    const read = async () => {
      try {
        const state = await api.internetSearch(searchId)
        if (stopped) return
        setError(null)
        setInternetSearch(state)
        const again = nextRead({ failed: false, phase: state.phase })
        if (again !== null) timer = window.setTimeout(read, again)
      } catch (cause) {
        if (stopped) return
        // A search we cannot read is not a search that found nothing — and a
        // search still running does not stop because one read failed. The
        // scouts are working either way; giving up here would leave the
        // screen frozen at whatever it last saw for the rest of the search,
        // with every later moment missed. So the trouble is said out loud and
        // the next read goes out anyway, a little further apart in case what
        // failed needs a moment. A read that succeeds clears the notice.
        fail(cause)
        timer = window.setTimeout(read, nextRead({ failed: true }) ?? RETRY_MS)
      }
    }
    let timer = window.setTimeout(read, internetSearch?.searchId === searchId ? POLL_MS : 0)
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [address.ask, internetSearch?.searchId, internetSearch?.phase, fail])

  const handleNext = useCallback(() => {
    // One search at a time: the box under the results holds a second
    // question back while one runs, and this holds the line if it did not.
    if (searchRunning) return
    const instruction = promptDraft.trim()
    if (!instruction || busy) return

    // Anything in the tray means a video was meant, even a pick that failed.
    const attaching = uploads.length > 0
    // Nothing attached and nothing coming: the question is for the internet.
    if (askTarget(video, { attaching }) === "internet") {
      // The words stay in the box until there is something to show for them.
      // This search answers in place, so clearing first would leave someone
      // whose connection dropped staring at an error and an empty box with
      // their question gone.
      void startInternetSearch(instruction).then((found) => {
        if (found) setPromptDraft("")
      })
      return
    }

    // A question goes as soon as the upload has landed; the answer waits for
    // the rest inside the search, and the results say what it is waiting on.
    if (!askGate(video, { attaching }).accepting) return
    setPromptDraft("")
    void startSearch(instruction)
  }, [promptDraft, video, busy, searchRunning, startSearch, startInternetSearch, uploads])

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
        go({ video: null, search: null, moment: null }, "replace")
      }
    },
    [uploads, removeUpload, video?.id, go],
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

  /**
   * Records what someone thought of an ANSWER — the model's words, not a
   * moment. It is a note about whether the search was any good; nothing in
   * the app reads it back, and nothing on screen changes because of it.
   *
   * Deliberately NOT wrapped in the page's error banner. A rating that fails
   * to send is not the person's problem to solve and does not stop what they
   * were doing; the thumb un-fills and says so where it was pressed. Putting
   * it in the banner would push the moment card down the screen over a note
   * nobody asked for.
   */
  const rateAnswer = useCallback(
    (requestId: string, event: ChatSignal) =>
      api.recordChatSignal(requestId, event, { clientEventId: crypto.randomUUID() }),
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

  /** The server's own account of a question, applied. For when no poll would come. */
  const refreshRequest = useCallback(
    async (requestId: string) => {
      const { clipRequest: latest, clips: latestClips } = await api.getClipRequest(requestId)
      const reconciled = reconcileVerdicts(latest)
      setExchanges((previous) =>
        previous.map((exchange) => (exchange.request.id === reconciled.id ? { request: reconciled, clips: latestClips } : exchange)),
      )
    },
    [reconcileVerdicts],
  )

  /**
   * Keep: the moment is approved and its file is started — the cut, the
   * framing and the 9:16 encode happen from this press, not before it.
   * Resolves to the clip the server recorded; null when it refused, with
   * the reason shown. One press at a time per moment: a retry waits for
   * the press before it, rollback included (Devin's finding on #88), and
   * the card's Keep waits with it.
   */
  const keepMatch = useCallback(
    (exchangeRequestId: string, matchId: string): Promise<Clip | null> =>
      oneAtATime(keepQueue.current, matchId, async () => {
        setError(null)
        setKeepingIds((current) => new Set(current).add(matchId))
        const attempt = (verdictAttempts.current.get(matchId) ?? 0) + 1
        verdictAttempts.current.set(matchId, attempt)
        // What the moment already was, so a failure takes back only what
        // this press made: a Keep again on a moment whose cut failed leaves
        // it kept. Read now, after any press before this one has settled.
        const before = exchangesRef.current
          .find((exchange) => exchange.request.id === exchangeRequestId)
          ?.request.matches?.find((candidate) => candidate.id === matchId)
        const previous = { verdict: before?.feedback ?? null, reason: before?.feedbackReason ?? null }
        try {
          return await runKeep(previous, {
            approve: () => api.rateMatch(exchangeRequestId, matchId, "approved", null).then(() => undefined),
            produce: async () => {
              const { clips: created } = await api.generateClips(exchangeRequestId, [matchId])
              setExchanges((previous) =>
                previous.map((exchange) => {
                  if (exchange.request.id !== exchangeRequestId) return exchange
                  const merged = new Map(exchange.clips.map((clip) => [clip.id, clip]))
                  for (const clip of created) merged.set(clip.id, clip)
                  return { ...exchange, clips: Array.from(merged.values()) }
                }),
              )
              return created.find((clip) => clip.clipMatchId === matchId) ?? created[0] ?? null
            },
            rollback: (verdict) => api.rateMatch(exchangeRequestId, matchId, verdict.verdict, verdict.reason).then(() => undefined),
            show: (verdict) => showVerdict(exchangeRequestId, matchId, verdict.verdict, verdict.reason),
            pending: {
              set: (verdict) => pendingVerdicts.current.set(matchId, verdict),
              delete: () => pendingVerdicts.current.delete(matchId),
            },
            isCurrent: () => verdictAttempts.current.get(matchId) === attempt,
            reconcile: () => refreshRequest(exchangeRequestId),
            fail,
          })
        } finally {
          setKeepingIds((current) => {
            const next = new Set(current)
            next.delete(matchId)
            return next
          })
        }
      }),
    [fail, showVerdict, refreshRequest],
  )

  /**
   * Publish from the feed means keep: the moment is approved and its file
   * started (a clip sent out is a clip in the library), and the publish
   * screens open for that clip and wait for the file. A moment kept earlier
   * already has its clip and goes straight to the screens. A keep the
   * server refused opens nothing — the banner says why.
   */
  const publishMoment = useCallback(
    async (exchangeRequestId: string, matchId: string) => {
      // One publish at a time: a second press could otherwise land while the
      // first keep is still being written and swap the clip under an open
      // dialog.
      if (publishInFlight.current || publishing !== null) return
      // A moment whose Keep is being written is not kept again by Publish:
      // the card holds Publish too, and this holds the line if it did not.
      if (keepingRef.current.has(matchId)) return
      const exchange = exchanges.find((candidate) => candidate.request.id === exchangeRequestId)
      const match = exchange?.request.matches?.find((candidate) => candidate.id === matchId)
      if (!exchange || !match) return
      publishInFlight.current = true
      setPublishPending(true)
      try {
        // A moment not yet kept is kept now; one whose cut failed is kept
        // again, which makes it again. Otherwise its clip already exists.
        const existing = clipRowFor(match, exchange.clips)
        let clipId = needsKeep(match, existing) ? null : (existing?.id ?? match.clip?.id ?? null)
        if (!clipId) {
          const kept = await keepMatch(exchangeRequestId, matchId)
          if (!kept) return
          clipId = kept.id
        }
        const id = clipId
        // Never replace a clip already in the dialog: the first press owns it.
        setPublishing((current) => current ?? { id, title: match.description || "A moment from your video" })
      } finally {
        publishInFlight.current = false
        setPublishPending(false)
      }
    },
    [exchanges, keepMatch, publishing],
  )

  /** The clip in the dialog, with whether its file is there read fresh from the conversation. */
  const publishable = useMemo(
    () => (publishing ? publishableFor(exchanges, publishing.id, publishing.title) : null),
    [exchanges, publishing],
  )

  /**
   * Another video takes the place of the one attached. Everything about the
   * old one goes — its rows (their transfers stopped), its conversation, its
   * address — and the question typed stays: it was about to be asked of the
   * new video, and clearing it made a person type it twice (Devin's finding
   * on #96). The tray goes with the video so a landed row is never left with
   * no way of becoming the video searched (Devin's finding on #95).
   */
  const replaceVideo = useCallback(() => {
    clearUploads()
    setVideo(null)
    setExchanges([])
    setError(null)
    go({ video: null, search: null, moment: null }, "replace")
  }, [clearUploads, go])

  /** Nothing attached, nothing asked: home, empty. */
  const reset = useCallback(() => {
    replaceVideo()
    setPromptDraft("")
  }, [replaceVideo])

  const openFromLibrary = useCallback(
    async (videoIdToOpen: string) => {
      setError(null)
      setBusy(true)
      try {
        const { video: opened } = await api.getVideo(videoIdToOpen)
        // The conversation comes back with the video (the owner's call,
        // 2026-09-02): a sign-in that returned here, a reload, a video
        // opened from history — the review is where it was left.
        const restored = await restoreConversation(videoIdToOpen, api, reconcileVerdicts)
        setExchanges(restored)
        setPromptDraft("")
        setVideo(opened)
        // Opened, with its conversation: the address says which video and,
        // unless it already names one, its newest question — so the results
        // are the screen, and a reload lands back on them.
        go({ video: opened.id, search: readAddress().search ?? restored.at(-1)?.request.id ?? null }, "replace")
      } catch (cause) {
        fail(cause)
      } finally {
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fail, go],
  )

  /**
   * Before a sign-in asked for from the publish screens: the video rides on
   * the address, so the magic link brings the person back to it — with its
   * conversation — rather than to a fresh start page. The errand itself
   * (publish this clip) is parked by the gate.
   */
  const parkVideoForSignIn = useCallback(() => {
    if (!video) return
    go({ video: video.id }, "replace")
  }, [video, go])

  // The parked publish, carried out once its moment is back on screen — and
  // only then taken out of the address, so a reload before this point tries
  // the return again, and one after it does not publish twice.
  useEffect(() => {
    if (!resumePublish || busy) return
    const found = matchForClip(exchanges, resumePublish)
    if (!found) return
    setResumePublish(null)
    consumeSearchParams(["then"])
    void publishMoment(found.requestId, found.matchId)
  }, [resumePublish, busy, exchanges, publishMoment])

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

  const stagedIndex = stagedExchange ? exchanges.findIndex((exchange) => exchange.request.id === stagedExchange.request.id) : -1
  /** A screen's own address, for the links that lead to it. */
  const addressOf = (parts: Partial<Address>) => {
    const params = new URLSearchParams()
    if (parts.video) params.set("video", parts.video)
    if (parts.search) params.set("search", parts.search)
    if (parts.moment) params.set("moment", parts.moment)
    if (parts.ask) params.set("ask", parts.ask)
    const query = params.toString()
    return query ? `/start?${query}` : "/start"
  }
  const momentHref = (moment: FeedMoment) => addressOf({ video: video?.id ?? null, search: moment.requestId, moment: moment.match.id })
  const resultsHref = addressOf({ video: video?.id ?? null, search: stagedExchange?.request.id ?? null, moment: null })

  return (
    <SearchShell>
      <div ref={screenRoot} className="flex w-full flex-1 flex-col">
        <AnimatePresence mode="wait" initial={false}>
          {screen === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="flex w-full flex-1 flex-col px-4 py-10 sm:px-6"
            >
              {/*
                The composer keeps this whole region to itself — basis-full and
                no shrinking — so results arriving underneath cannot move it.
                Centring the two together would slide the box upward by half
                the height of whatever came back, the moment Search was used.
              */}
              <div className="flex w-full shrink-0 basis-full flex-col items-center justify-center">
                <SearchHome
                  entries={uploads}
                  video={video}
                  promptValue={promptDraft}
                  onPromptChange={setPromptDraft}
                  onAdd={startUploads}
                  onRemove={dropUpload}
                  onRetry={retryUpload}
                  onSubmit={handleNext}
                  onReplace={replaceVideo}
                  onDetach={reset}
                  disabled={busy}
                />
              </div>
            </motion.div>
          )}

          {screen === "internet" && (
            <motion.div
              key={`internet-${address.ask}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="flex w-full flex-1 flex-col pb-16"
            >
              {/*
                Until the first reply arrives there is a question and nothing
                else, which is the loading state anyway — so the screen shows
                it rather than a blank frame while the first poll is in
                flight. The question is the one that was typed; the search
                returns its own copy, which takes over once it lands.
              */}
              <InternetStage
                query={internetSearch?.query ?? promptDraft}
                phase={internetSearch?.searchId === address.ask ? internetSearch.phase : "loading"}
                moments={internetSearch?.searchId === address.ask ? internetSearch.moments : []}
              />
            </motion.div>
          )}

          {screen === "results" && stagedExchange && (
            <motion.div
              key={`results-${stagedExchange.request.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="flex w-full flex-1 flex-col pb-16"
            >
              <ResultsStage
                exchange={stagedExchange}
                video={video}
                moments={stagedMoments}
                followUp={stagedIndex > 0}
                initialMomentId={stagedMomentId}
                onActiveChange={onStagedMomentChange}
                momentHref={momentHref}
                onOpen={(moment) => go({ search: moment.requestId, moment: moment.match.id })}
                others={exchanges
                  .filter((exchange) => exchange.request.id !== stagedExchange.request.id)
                  .map((exchange) => ({ id: exchange.request.id, instruction: exchange.request.instruction }))}
                onPickOther={(requestId) => go({ search: requestId, moment: null })}
                muted={muted}
                onMutedChange={setMuted}
              />
              <div className="mx-auto mt-10 w-full max-w-[640px] px-4">
                <FollowUpComposer
                  video={video}
                  promptValue={promptDraft}
                  onPromptChange={setPromptDraft}
                  onSubmit={handleNext}
                  disabled={busy}
                  searching={searchRunning}
                />
              </div>
            </motion.div>
          )}

          {screen === "moment" && stagedExchange && openMoment && (
            <motion.div
              key={`moment-${openMoment.match.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="mx-auto w-full max-w-[1040px] px-4 pt-2 pb-10 sm:px-8 max-[860px]:px-0 max-[860px]:pt-0 max-[860px]:pb-0"
            >
              <MomentConversation
                moment={openMoment}
                exchange={stagedExchange}
                video={video}
                moments={stagedMoments}
                followUp={stagedIndex > 0}
                searching={searchRunning}
                backHref={resultsHref}
                onBack={() => go({ moment: null })}
                onAsk={(instruction) => (searchRunning ? false : startSearch(instruction))}
                onReclip={(moment) => reclipMatch(moment.requestId, moment.match.id)}
                onRateAnswer={rateAnswer}
                muted={muted}
                onMutedChange={setMuted}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <PublishDialog clip={publishable} onClose={() => setPublishing(null)} onSignIn={parkVideoForSignIn} />
        <ResumeAfterSignIn onPublish={setResumePublish} />

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
    </SearchShell>
  )
}
