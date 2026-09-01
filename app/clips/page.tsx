"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Folder01Icon,
  ScissorsIcon,
  SubtitleIcon,
  Upload01Icon,
  Upload02Icon,
  VideoReplayIcon,
} from "@hugeicons/core-free-icons"
import { api, ApiError } from "@/lib/api"
import type { LibraryClip, SocialAccount } from "@/lib/types"
import { WorkspaceShell } from "@/components/workspace/shell"
import { CaptionEditor } from "@/components/caption-editor"
import { ClipCard, ClipDownloadAction } from "@/components/clip-card"
import {
  useAuthConfigured,
  useWorkspaceResumeIntent,
  useWorkspaceSignInGate,
} from "@/components/workspace/sign-in-gate"
import { PlatformLogo } from "@/components/platform-logos"
import { ChosenTick, PublishPreview } from "@/components/publish-preview"
import { clearDraft, saveDraft, savedDrafts } from "@/lib/drafts"
import { UploadPackage } from "@/components/flow/upload-package"
import { useVideoUploads } from "@/components/flow/use-video-uploads"
import { UpgradeDialog } from "@/components/flow/upgrade-dialog"
import { TimelineAnimation } from "@/components/ui/timeline-animation"

/**
 * The caption length to count against.
 *
 * The shortest limit among the platforms this posts to, so a caption inside it
 * fits everywhere. Advisory: the counter turns red, nothing is blocked. A
 * platform trims what it minds about, and refusing to type past this would be
 * us enforcing a rule that only one of them applies.
 */
const CAPTION_LIMIT = 220

/**
 * How each card arrives: out of focus, then sharp, one after the next.
 *
 * The upstream timeline steps by half a second per item, which reads well for
 * nine landing-page blocks and badly for a library — the twentieth clip would
 * wait ten seconds to appear. A tenth of a second per card keeps the sweep and
 * lets a full page finish while you are still looking at it.
 */
const CARD_REVEAL = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
  hidden: { y: -20, opacity: 0, filter: "blur(10px)" },
}

/**
 * Everything you have cut, newest first — on the app shell the Shared screens
 * proved out. Each card is the clip's still until you press play, then the
 * clip itself in place — no lightbox, no second page; media surfaces are the
 * owner's carve-out. Download uses the signed attachment URL, so the browser
 * saves the file without this page touching the bytes.
 */
/** Platform names as their own users write them, never a lowercased id. */
const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X",
}

/** The square secondary buttons on a clip card's action row. */
function ClipAction({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: typeof SubtitleIcon
  onClick?: () => void
}) {
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-full"
    >
      <HugeiconsIcon icon={icon} />
    </Button>
  )
}

function ClipsBody() {
  const router = useRouter()
  /**
   * The library is a door for new footage too, at the owner's ask: drag a
   * video anywhere onto this page — the page shows the same upload state the
   * New clip screen uses — or press Upload video. The engine is the shared
   * one, and when the batch lands it hands the videos to the theater
   * (/start?videos=…), which opens the first and offers the carousel.
   */
  const {
    uploads,
    startUploads,
    retryUpload,
    removeUpload,
    overLimit,
    clearOverLimit,
  } = useVideoUploads({
    onBatchLanded: (videos) => {
      router.push(`/start?videos=${videos.map((video) => video.id).join(",")}`)
    },
  })
  const uploadInput = useRef<HTMLInputElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  /** Counts enters/leaves — a plain boolean flickers over child elements. */
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  const [clips, setClips] = useState<LibraryClip[] | null>(null)
  /**
   * Whether older clips exist below what is currently held. The cursor is
   * deliberately NOT stored: it is read off the last clip on screen at the
   * moment the button is pressed, so a refresh that adds clips at the top
   * can never leave it pointing into the middle of the list (which would
   * re-fetch cards already on screen).
   */
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  /** True once someone has paged past the newest page. */
  const pagedOlderRef = useRef(false)
  const [failed, setFailed] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  /** The publish dialog's target clip; the ref mirrors it so a finishing
   *  request can tell whether the open panel is still its own. */
  const [publishOpenId, setPublishOpenId] = useState<string | null>(null)
  /**
   * The accounts a publish could go to, and which are ticked.
   *
   * Loaded when the dialog opens rather than with the page: most visits to
   * the library never publish anything, and this is the only screen that
   * needs it.
   */
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null)
  const [accountsFailed, setAccountsFailed] = useState(false)
  const [chosenAccountIds, setChosenAccountIds] = useState<string[]>([])
  const publishOpenIdRef = useRef<string | null>(null)
  /**
   * Caption drafts, one per clip. A draft survives its dialog closing —
   * clicking outside the panel must not erase a paragraph someone typed —
   * and is dropped only when the publish it was written for lands.
   *
   * Seeded from the ones Save draft has written down, so a caption written
   * yesterday is still there today.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  // Read once, on the client. Deliberately not part of the initial state: this
  // page is prerendered, and reading storage during the first render makes the
  // server's HTML and the browser's disagree.
  useEffect(() => {
    setDrafts((current) => ({ ...savedDrafts(), ...current }))
  }, [])
  const [publishingIds, setPublishingIds] = useState<string[]>([])
  /** Which clip's caption editor is open — a modal visit, not a page. */
  const [captionClipId, setCaptionClipId] = useState<string | null>(null)
  /**
   * Renders started from the caption editor and not yet landed: the clip the
   * editor was opened on, and the clip being written. Kept on the PAGE, not
   * in the modal, so closing the modal mid-render neither loses the clip nor
   * lets the same render be started twice.
   */
  const [pendingRenders, setPendingRenders] = useState<Array<{ source: string; target: string }>>([])
  const { requireSignIn, askToSignIn, isSignedIn } = useWorkspaceSignInGate()
  /** Null while unknown, false on a guest-only deployment. See the empty state. */
  const authConfigured = useAuthConfigured()

  // Signed in from the prompt and come back? Reopen the clip they were about
  // to publish, rather than dropping them on the library with no idea where
  // they were. It opens the dialog — it does NOT publish: that button is
  // theirs to press, and pressing it for them would post to the world on the
  // strength of a URL parameter.
  useWorkspaceResumeIntent(
    (intent) => intent.action === "publish" || intent.action === "send",
    (intent) => {
      if (intent.action === "publish") setPublishTarget(intent.clipId)
      if (intent.action === "send") openSend(intent.clipId)
    },
  )

  const setPublishTarget = (id: string | null) => {
    publishOpenIdRef.current = id
    setPublishOpenId(id)
  }

  // The accounts a publish can reach, fetched when the dialog opens. Every
  // connected one starts ticked: the previous behaviour was "goes to all of
  // them", and opening a picker that silently defaults to nothing would turn
  // a familiar action into a puzzle.
  useEffect(() => {
    if (publishOpenId === null) return
    let cancelled = false
    setAccountsFailed(false)
    void api
      .listSocialAccounts()
      .then((page) => {
        if (cancelled) return
        const connected = page.accounts.filter((account) => account.status === "connected")
        setAccounts(connected)
        setChosenAccountIds(connected.map((account) => account.id))
      })
      .catch(() => {
        // A failed load is not "no accounts". Saying "connect one first" to
        // someone who has three would be a lie about their own setup.
        if (!cancelled) setAccountsFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [publishOpenId])

  useEffect(() => {
    let cancelled = false
    void api
      .listClips()
      .then((page) => {
        if (cancelled) return
        setClips(page.clips)
        setHasMore(page.nextBefore !== null)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const publish = async (clipId: string) => {
    if (publishingIds.includes(clipId)) return
    setPublishingIds((current) => [...current, clipId])
    try {
      const { posts } = await api.publishClip(clipId, {
        caption: (drafts[clipId] ?? "").trim(),
        // Omitted means "all" to the API. Sending the list only when it is a
        // real subset keeps a publish working even if the account list could
        // not be loaded — the old behaviour, unchanged, rather than a
        // failure to fetch turning into a failure to post.
        ...(accounts && chosenAccountIds.length > 0 && chosenAccountIds.length < accounts.length
          ? { accountIds: chosenAccountIds }
          : {}),
      })
      // Transient news is transient: the confirmation appears and leaves on
      // its own instead of becoming permanent card content. When a platform
      // needs a different shape than the clip was shot in, the file is cut
      // first — say so, so a short delay reads as work, not silence.
      const shaping = posts?.filter((entry) => entry.status === "rendering") ?? []
      toast.success(
        shaping.length > 0
          ? `Sent — ${shaping
              .flatMap((entry) => entry.targets.map((target) => target.platform))
              .map((platform) => platform.charAt(0).toUpperCase() + platform.slice(1))
              .join(" and ")} ${shaping.length === 1 && shaping[0]!.targets.length === 1 ? "gets" : "get"} a ${shaping
              .map((entry) => entry.aspect)
              .join(" and ")} cut first; it posts automatically when ready.`
          : "Sent — it's on its way to your connected accounts.",
      )
      // The draft did its job; the panel closes only if it is still this
      // clip's — another clip's dialog may have opened mid-flight. A saved
      // copy goes too: keeping a caption that has already been published would
      // hand it straight back the next time this clip was opened.
      setDrafts((current) => {
        const { [clipId]: _sent, ...rest } = current
        return rest
      })
      clearDraft(clipId)
      if (publishOpenIdRef.current === clipId) {
        setPublishTarget(null)
      }
    } catch (cause) {
      // The API's refusals are already written for people ("No connected
      // accounts. Connect one on the Publishing page first.") — repeat them.
      toast.error(
        cause instanceof ApiError ? cause.message : "Couldn't publish just now. Try again.",
        { duration: Infinity, closeButton: true },
      )
    } finally {
      setPublishingIds((current) => current.filter((id) => id !== clipId))
    }
  }

  /**
   * The Send-to-room control: per clip, a popover listing the rooms the
   * caller is in, saying which already have it. Rooms are fetched when the
   * popover opens — the list is tiny and always current.
   */
  const [sendOpenId, setSendOpenId] = useState<string | null>(null)
  const sendOpenIdRef = useRef<string | null>(null)
  const [rooms, setRooms] = useState<Array<{ id: string; name: string }> | null>(null)
  /** The fetch failed — different answer from "you have no rooms". */
  const [sendFailed, setSendFailed] = useState(false)
  const [sharedWith, setSharedWith] = useState<string[]>([])
  const [sendSignInRequired, setSendSignInRequired] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)

  const setSendTarget = (id: string | null) => {
    sendOpenIdRef.current = id
    setSendOpenId(id)
  }

  const openSend = (clipId: string) => {
    setRooms(null)
    setSharedWith([])
    setSendSignInRequired(false)
    setSendFailed(false)
    setSendTarget(clipId)
    void api
      .getClipWorkspaces(clipId)
      .then((result) => {
        // Still this clip's popover? Someone may have moved on mid-fetch.
        if (sendOpenIdRef.current !== clipId) return
        setRooms(result.workspaces)
        setSharedWith(result.sharedWith)
        setSendSignInRequired(Boolean(result.signInRequired))
      })
      .catch(() => {
        if (sendOpenIdRef.current !== clipId) return
        // "The request failed" and "you are in no room" are different
        // answers, and this popover must never return them as the same one.
        setSendFailed(true)
      })
  }

  const sendTo = async (clipId: string, workspaceId: string, name: string) => {
    if (sendingTo) return
    setSendingTo(workspaceId)
    try {
      await api.sendClipToWorkspace(workspaceId, clipId)
      toast.success(`Sent to ${name}. It stays in your library too.`)
      setSharedWith((current) => (current.includes(workspaceId) ? current : [...current, workspaceId]))
    } catch (cause) {
      toast.error(
        cause instanceof ApiError ? cause.message : "Couldn't send that clip. Try again.",
      )
    } finally {
      setSendingTo(null)
    }
  }

  /**
   * Re-read the newest page and MERGE it in: someone who paged down to find
   * a clip keeps every card they loaded getting there, and clips already on
   * screen take their fresh copy (signed URLs expire; a replaced clip
   * carries new captions, size and duration).
   */
  const refreshNewestPage = async () => {
    const page = await api.listClips()
    setClips((current) => {
      if (!current) return page.clips
      const fresh = new Map(page.clips.map((clip) => [clip.id, clip]))
      const kept = current.map((clip) => fresh.get(clip.id) ?? clip)
      const held = new Set(current.map((clip) => clip.id))
      const added = page.clips.filter((clip) => !held.has(clip.id))
      return [...added, ...kept]
    })
    // Only the newest page can answer "is there more?" when it is all we
    // hold; once someone has paged deeper, the answer they have is the true
    // one.
    if (!pagedOlderRef.current) setHasMore(page.nextBefore !== null)
  }

  /** Update one clip in place, wherever in the list it happens to be. */
  const patchClip = (clipId: string) => {
    void api
      .getClip(clipId)
      .then(({ clip: fresh }) => {
        setClips(
          (current) => current?.map((clip) => (clip.id === fresh.id ? { ...clip, ...fresh } : clip)) ?? current,
        )
      })
      .catch(() => {})
  }

  /**
   * Follow a render the user walked away from. The clip is being made
   * whether or not the modal is open, so the library waits for it and says
   * when it lands — rather than quietly never showing it.
   */
  const watchRender = (target: string) => {
    let attempts = 0
    const forget = () => setPendingRenders((current) => current.filter((entry) => entry.target !== target))
    const tick = async () => {
      attempts += 1
      try {
        const { clip } = await api.getClip(target)
        if (clip.status === "ready" && !clip.error) {
          await refreshNewestPage().catch(() => {})
          patchClip(target)
          forget()
          toast.success("Your captioned clip is ready.")
          return
        }
        if (clip.status === "failed" || (clip.status === "ready" && clip.error)) {
          forget()
          toast.error(clip.error ?? "That render failed.")
          return
        }
      } catch {
        // A dropped poll is not a failed render; try again.
      }
      if (attempts < 40) window.setTimeout(() => void tick(), 3000)
      else forget()
    }
    window.setTimeout(() => void tick(), 3000)
  }

  /** Close the editor, and keep following anything it left running. */
  const closeCaptionEditor = () => {
    const source = captionClipId
    setCaptionClipId(null)
    const pending = pendingRenders.find((entry) => entry.source === source)
    if (pending) {
      toast.info("Still rendering — it'll appear in your library when it's done.")
      watchRender(pending.target)
    }
  }

  const loadOlder = async () => {
    const oldest = clips?.[clips.length - 1]
    if (!hasMore || loadingMore || !oldest) return
    setLoadingMore(true)
    pagedOlderRef.current = true
    try {
      // "Older than the oldest card on screen" — the server pages by
      // creation time, so this is exact even if clips were added since.
      const page = await api.listClips(oldest.createdAt)
      setClips((current) => {
        const held = new Set((current ?? []).map((clip) => clip.id))
        return [...(current ?? []), ...page.clips.filter((clip) => !held.has(clip.id))]
      })
      setHasMore(page.nextBefore !== null)
    } catch {
      // The button stays; pressing it again retries. A failed "older clips"
      // fetch is not worth an error banner over a page that already works.
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <div
        ref={timelineRef}
        className="relative flex flex-1 flex-col gap-5"
        onDragEnter={(event) => {
          if (![...event.dataTransfer.items].some((item) => item.kind === "file")) return
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          startUploads(Array.from(event.dataTransfer.files))
        }}
      >
        {/* The upload placeholder, over the page while a drag hovers — the
            same look the New clip screen greets a drop with. */}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-ring bg-shaccent/95 text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-shmuted text-muted-foreground ring-1 ring-shborder">
              <HugeiconsIcon icon={Upload01Icon} className="size-9" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Drop videos to upload</h2>
              <p className="text-sm text-muted-foreground">MP4, MOV, MKV, WebM — up to 6 hours each</p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Your clips</h1>
            <p className="text-sm text-muted-foreground">
              Every clip you have cut, ready to play or download.
            </p>
          </div>
          {/* The button beside the drag-and-drop, as asked — the same door
              for anyone who does not think in drops. */}
          <Button onClick={() => uploadInput.current?.click()}>
            <HugeiconsIcon icon={Upload01Icon} />
            Upload video
          </Button>
          <input
            ref={uploadInput}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) startUploads(Array.from(event.target.files))
              event.currentTarget.value = ""
            }}
          />
        </div>

        {uploads.length > 0 && (
          <UploadPackage
            entries={uploads}
            onAdd={startUploads}
            onRemove={removeUpload}
            onRetry={retryUpload}
          />
        )}

        {failed ? (
          <p className="text-sm text-destructive">Couldn&apos;t load your clips. Refresh to try again.</p>
        ) : clips === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-[230px] w-full rounded-2xl" />
            ))}
          </div>
        ) : clips.length === 0 ? (
          // An empty list means one of two different things, and saying the
          // wrong one tells a person their work is gone.
          //
          // Signed out, the API scopes this list to the anonymous session —
          // this browser tab. It never looked at the account's clips. So
          // "No clips yet" would assert an absence nobody verified, which is
          // the failure CLAUDE.md names first. Signed in, the list IS the
          // whole answer and the original words are true.
          <Card className="flex flex-1 items-center justify-center border-dashed">
            <CardContent className="flex max-w-md flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-shmuted text-muted-foreground">
                <HugeiconsIcon icon={VideoReplayIcon} className="size-6" />
              </span>
              {isSignedIn ? (
                <>
                  <h2 className="text-lg font-semibold">No clips yet</h2>
                  <p className="text-sm text-muted-foreground">
                    Cut a moment from any video and it lands here — ready to play, download,
                    caption, and publish.
                  </p>
                  <Button className="mt-2" asChild>
                    <a href="/start">
                      <HugeiconsIcon icon={ScissorsIcon} />
                      Clip a video
                    </a>
                  </Button>
                </>
              ) : authConfigured === false ? (
                // Guest-only deployment: there is no sign-in to offer, so
                // pointing at one would be a second false promise on top of
                // the one this whole change exists to remove. Codex caught
                // this on #62. Say what is actually true of this tab.
                <>
                  <h2 className="text-lg font-semibold">No clips in this tab yet</h2>
                  <p className="text-sm text-muted-foreground">
                    Clips live with the browser tab that made them on this deployment, and
                    accounts aren&apos;t switched on. Cut one and it lands here.
                  </p>
                  <Button className="mt-2" asChild>
                    <a href="/start">
                      <HugeiconsIcon icon={ScissorsIcon} />
                      Clip a video
                    </a>
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold">Sign in to see your clips</h2>
                  <p className="text-sm text-muted-foreground">
                    This page is only showing clips made in this browser tab. Anything saved to
                    your account is waiting behind sign-in.
                  </p>
                  {/* Null while the check is in flight: the button waits
                      rather than flashing an offer that may not exist. */}
                  <Button className="mt-2" disabled={authConfigured === null} onClick={askToSignIn}>
                    Sign in
                  </Button>
                  <Button variant="secondary" asChild>
                    <a href="/start">
                      <HugeiconsIcon icon={ScissorsIcon} />
                      Clip a video
                    </a>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {clips.map((clip, index) => (
                <TimelineAnimation
                  key={clip.id}
                  animationNum={index}
                  timelineRef={timelineRef}
                  customVariants={CARD_REVEAL}
                >
                  <ClipCard
                    clip={clip}
                    surface="light"
                    isPlaying={playingId === clip.id}
                    onPlay={() => setPlayingId(clip.id)}
                    showDate
                    actions={
                      <>
                        {clip.downloadUrl && (
                          <ClipDownloadAction href={clip.downloadUrl} surface="light" />
                        )}
                        {clip.status === "ready" && (
                          <ClipAction
                            label="Captions"
                            icon={SubtitleIcon}
                            onClick={() => setCaptionClipId(clip.id)}
                          />
                        )}
                        {clip.status === "ready" && (
                          <ClipAction
                            label="Publish"
                            icon={Upload02Icon}
                            onClick={() =>
                              requireSignIn({ action: "publish", clipId: clip.id }, () =>
                                setPublishTarget(clip.id),
                              )
                            }
                          />
                        )}
                        {clip.status === "ready" && (
                          <Popover
                            open={sendOpenId === clip.id}
                            onOpenChange={(open) => {
                              if (open) {
                                // Sending a clip into a shared room needs a
                                // person: rooms outlive a browser tab.
                                requireSignIn({ action: "send", clipId: clip.id }, () =>
                                  openSend(clip.id),
                                )
                              } else if (sendOpenIdRef.current === clip.id) {
                                setSendTarget(null)
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="secondary"
                                size="icon-sm"
                                aria-label="Send to a room"
                                title="Send to a room"
                                className="rounded-full"
                              >
                                <HugeiconsIcon icon={Folder01Icon} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="shadcn-scope w-[280px]" align="start">
                              {sendFailed ? (
                                <div className="flex flex-col gap-2">
                                  <p className="text-[13px] text-muted-foreground">
                                    Couldn&apos;t load your rooms just now.
                                  </p>
                                  <Button variant="secondary" size="sm" onClick={() => openSend(clip.id)}>
                                    Try again
                                  </Button>
                                </div>
                              ) : rooms === null ? (
                                <Skeleton className="h-[60px] w-full rounded-lg" />
                              ) : sendSignInRequired ? (
                                <p className="text-[13px] text-muted-foreground">
                                  Shared rooms belong to you, not to a browser tab — sign in (top
                                  right) to send clips to one.
                                </p>
                              ) : rooms.length === 0 ? (
                                <p className="text-[13px] text-muted-foreground">
                                  You&apos;re not in any shared room yet. Make one on the Shared page,
                                  then send clips there.
                                </p>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {rooms.map((room) =>
                                    sharedWith.includes(room.id) ? (
                                      <p key={room.id} className="px-1 py-1 text-[13px] text-muted-foreground">
                                        ✓ Already in {room.name}
                                      </p>
                                    ) : (
                                      <Button
                                        key={room.id}
                                        variant="secondary"
                                        size="sm"
                                        className="justify-start"
                                        disabled={sendingTo === room.id}
                                        onClick={() => void sendTo(clip.id, room.id, room.name)}
                                      >
                                        {sendingTo === room.id ? "Sending…" : `Send to ${room.name}`}
                                      </Button>
                                    ),
                                  )}
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        )}
                      </>
                    }
                  />
                </TimelineAnimation>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center">
                <Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void loadOlder()}>
                  {loadingMore ? "Loading…" : "Show older clips"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Type a caption, send it. The cut each platform receives is made
          server-side at publish time. */}
      <Dialog
        open={publishOpenId !== null}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null)
        }}
      >
        <DialogContent className="shadcn-scope flex max-h-[90vh] flex-col sm:max-w-[740px]">
          {publishOpenId && (
            // The heading and the buttons stay put; only the middle scrolls.
            // Four connected accounts and a preview frame were already enough
            // to push Publish off the bottom of a laptop screen, and a button
            // you cannot reach is the same as a button that is not there.
            <div className="flex min-h-0 flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Publish</DialogTitle>
                <DialogDescription>Share your clip with the world.</DialogDescription>
              </DialogHeader>

              <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
                <PublishPreview clip={clips?.find((clip) => clip.id === publishOpenId) ?? null} />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="publish-caption" className="text-sm font-medium">
                    Caption
                  </label>
                  <textarea
                    id="publish-caption"
                    rows={3}
                    value={drafts[publishOpenId] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [publishOpenId]: event.target.value }))
                    }
                    placeholder="Write a caption..."
                    // The shortest cap across the platforms this posts to, so
                    // the count means "this will fit everywhere". Advisory,
                    // not enforced.
                    maxLength={CAPTION_LIMIT}
                    className="w-full resize-y rounded-md border border-shborder bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                  <p className="self-end text-[12px] tabular-nums text-muted-foreground">
                    {(drafts[publishOpenId] ?? "").length}/{CAPTION_LIMIT}
                  </p>
                </div>

                {/* Which accounts get it. Everything connected starts ticked,
                    because "goes to all of them" is what this button did
                    before and a picker that quietly defaulted to nothing
                    would turn a familiar action into a puzzle. */}
                {accountsFailed ? (
                  <p className="text-[13px] text-muted-foreground">
                    Couldn&apos;t load your accounts just now — posting will still go to all of them.
                  </p>
                ) : accounts === null ? (
                  <Skeleton className="h-[72px] w-full rounded-lg" />
                ) : accounts.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    No connected accounts. Connect one on the Publishing page first.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] text-muted-foreground">Accounts</p>
                    <ul className="flex flex-col gap-2">
                      {accounts.map((account) => {
                        const on = chosenAccountIds.includes(account.id)
                        const platform = PLATFORM_LABELS[account.platform] ?? account.platform
                        return (
                          <li key={account.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() =>
                                setChosenAccountIds((current) =>
                                  on
                                    ? current.filter((id) => id !== account.id)
                                    : [...current, account.id],
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-shborder transition-colors hover:bg-shaccent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <PlatformLogo platform={account.platform} size="sm" />
                              {/* Name and handle on ONE line: two accounts on
                                  one platform is normal, so the handle is
                                  never dropped. */}
                              <span className="flex min-w-0 items-center gap-3">
                                <span className="text-sm">{platform}</span>
                                {account.displayName && (
                                  <span className="truncate text-[13px] text-muted-foreground">
                                    {account.displayName}
                                  </span>
                                )}
                              </span>
                              <span className="ml-auto">
                                <ChosenTick isOn={on} />
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">
                  {accounts && accounts.length > 0
                    ? chosenAccountIds.length === 0
                      ? "Pick at least one account."
                      : `${chosenAccountIds.length} ${chosenAccountIds.length === 1 ? "account" : "accounts"} selected`
                    : "Goes to every account you have connected."}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      saveDraft(publishOpenId, drafts[publishOpenId] ?? "")
                      setPublishTarget(null)
                    }}
                  >
                    Save draft
                  </Button>
                  <Button
                    // The guard stays on the page, not in the dialog: closing
                    // this unmounts it, and a flag that reset would let a
                    // second Post start a publish of a clip already on its
                    // way out.
                    disabled={
                      publishingIds.includes(publishOpenId) ||
                      // An empty tick-list is a refusal to pick, not
                      // permission to post everywhere — the same rule the
                      // API enforces.
                      (accounts !== null && accounts.length > 0 && chosenAccountIds.length === 0)
                    }
                    onClick={() => void publish(publishOpenId)}
                  >
                    {publishingIds.includes(publishOpenId) ? "Publishing…" : "Publish"}
                    <HugeiconsIcon icon={ArrowRight01Icon} />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* The caption editor keeps its own furniture for now: it is a working
          editor (toolbar, font pickers, undo) whose innards are still on the
          old system, and swapping them is its own piece of work — flagged to
          the owner rather than rushed. The dialog around it is the app's. */}
      <Dialog
        open={captionClipId !== null}
        onOpenChange={(open) => {
          if (!open) closeCaptionEditor()
        }}
      >
        <DialogContent className="shadcn-scope max-h-[92vh] overflow-y-auto sm:max-w-[1100px]">
          <DialogHeader>
            <DialogTitle>Captions</DialogTitle>
          </DialogHeader>
          {captionClipId && (
            <CaptionEditor
              clipId={captionClipId}
              isBusyElsewhere={pendingRenders.some((entry) => entry.source === captionClipId)}
              onRenderStarted={(target) => {
                const source = captionClipId
                if (source) setPendingRenders((current) => [...current, { source, target }])
              }}
              onDone={(outcome) => {
                setCaptionClipId(null)
                setPendingRenders((current) => current.filter((entry) => entry.target !== outcome.clipId))
                void refreshNewestPage().catch(() => {})
                // A replaced clip deeper than the newest page is not in that
                // response at all, so it is fetched on its own rather than
                // left showing the version it no longer is.
                if (outcome.mode === "replace") patchClip(outcome.clipId)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <UpgradeDialog files={overLimit} onClose={clearOverLimit} />
    </>
  )
}

export default function ClipsPage() {
  // The body sits INSIDE the shell because the shell provides the sign-in
  // gate; hooks called above the provider have nothing to read.
  return (
    <WorkspaceShell active="clips">
      <ClipsBody />
    </WorkspaceShell>
  )
}
