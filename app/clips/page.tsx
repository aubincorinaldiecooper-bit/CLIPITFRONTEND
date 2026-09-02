"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CaptionsIcon,
  Delete01Icon,
  PencilEdit01Icon,
  ScissorsIcon,
  Upload01Icon,
  VideoReplayIcon,
} from "@hugeicons/core-free-icons"
import { api, ApiError } from "@/lib/api"
import type { LibraryClip } from "@/lib/types"
import {
  useAuthConfigured,
  useWorkspaceSignInGate,
} from "@/components/workspace/sign-in-gate"
import { WorkspaceShell } from "@/components/workspace/shell"
import { CaptionEditor } from "@/components/caption-editor"
import { ClipCard, ClipViewer, type ClipAction } from "@/components/clip-card"
import { ClipRow } from "@/components/clip-row"
import { UploadPackage } from "@/components/flow/upload-package"
import { useVideoUploads } from "@/components/flow/use-video-uploads"
import { UpgradeDialog } from "@/components/flow/upgrade-dialog"
import { TimelineAnimation } from "@/components/ui/timeline-animation"

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
    // Cap the stagger so cards far down the list do not wait seconds
    // after they scroll into view. A short local stagger still feels stepped.
    transition: { delay: Math.min(i, 3) * 0.05, duration: 0.5 },
  }),
  hidden: { y: -20, opacity: 0, filter: "blur(10px)" },
}

/**
 * Everything you have cut, newest first. Each card is the clip's still until
 * you press play, then the clip itself in place — no lightbox, no second page;
 * media surfaces are the owner's carve-out. Download uses the signed attachment
 * URL, so the browser saves the file without this page touching the bytes.
 */

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
  /** Counts enters/leaves — a plain boolean flickers over child elements. */
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  const [clips, setClips] = useState<LibraryClip[] | null>(null)
  /**
   * Whether older clips exist below what is currently held. The cursor is
   * deliberately kept in a ref as well as state, so async handlers read the
   * latest value without a stale closure.
   */
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  /** Cursor for the next older page, so an emptied list can still load more. */
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const pagingRef = useRef({ hasMore, nextBefore })
  /** True once someone has paged past the newest page. */
  const pagedOlderRef = useRef(false)
  /** Set while a delete is in progress, so the empty-state effect can load older. */
  const loadOlderAfterDeleteRef = useRef<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    pagingRef.current = { hasMore, nextBefore }
  }, [hasMore, nextBefore])
  const [openId, setOpenId] = useState<string | null>(null)

  /** Which clip's caption editor is open — a modal visit, not a page. */
  const [captionClipId, setCaptionClipId] = useState<string | null>(null)
  /**
   * Renders started from the caption editor and not yet landed: the clip the
   * editor was opened on, and the clip being written. Kept on the PAGE, not
   * in the modal, so closing the modal mid-render neither loses the clip nor
   * lets the same render be started twice.
   */
  const [pendingRenders, setPendingRenders] = useState<Array<{ source: string; target: string }>>([])

  const { askToSignIn, isSignedIn } = useWorkspaceSignInGate()
  /** Null while unknown, false on a guest-only deployment. See the empty state. */
  const authConfigured = useAuthConfigured()

  /** Rename a clip — its title overrides the moment description in the library. */
  const [renameTarget, setRenameTarget] = useState<{ clipId: string; value: string; originalValue: string } | null>(null)
  const [renameBusy, setRenameBusy] = useState(false)

  /** Delete a clip after an explicit confirmation. */
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void api
      .listClips()
      .then((page) => {
        if (cancelled) return
        setClips(page.clips)
        setHasMore(page.nextBefore !== null)
        setNextBefore(page.nextBefore)
      })
      .catch(() => {
        if (!cancelled) {
          setClips([])
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    if (!pagedOlderRef.current) {
      setHasMore(page.nextBefore !== null)
      setNextBefore(page.nextBefore)
    }
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

  const handleRename = async (clipId: string, title: string) => {
    setRenameBusy(true)
    try {
      const { clip: renamed } = await api.renameClip(clipId, title)
      setClips((current) => current?.map((clip) => (clip.id === clipId ? renamed : clip)) ?? current)
      // A stale completion should not close a dialog the user already opened
      // for a different clip.
      setRenameTarget((current) => (current?.clipId === clipId ? null : current))
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Couldn't rename that clip. Try again.")
    } finally {
      setRenameBusy(false)
    }
  }

  const handleDelete = async (clipId: string) => {
    setDeleteBusy(true)
    try {
      await api.deleteClip(clipId)
      // Use a functional update so any loadOlder/refresh that completed while
      // the delete was in flight is not overwritten by a stale closure.
      setClips((current) => current?.filter((clip) => clip.id !== clipId) ?? [])
      setOpenId((current) => (current === clipId ? null : current))
      setDeleteTargetId((current) => (current === clipId ? null : current))
      // Let the empty-state effect decide whether to page in older clips,
      // using the latest pagination values from a ref.
      loadOlderAfterDeleteRef.current = clipId
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Couldn't delete that clip. Try again.")
    } finally {
      setDeleteBusy(false)
    }
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
    const { hasMore: more, nextBefore: cursor } = pagingRef.current
    if (!more || loadingMore || !cursor) return
    setLoadingMore(true)
    pagedOlderRef.current = true
    try {
      const page = await api.listClips(cursor)
      setClips((current) => {
        const held = new Set((current ?? []).map((clip) => clip.id))
        return [...(current ?? []), ...page.clips.filter((clip) => !held.has(clip.id))]
      })
      setHasMore(page.nextBefore !== null)
      setNextBefore(page.nextBefore)
    } catch {
      // The button stays; pressing it again retries. A failed "older clips"
      // fetch is not worth an error banner over a page that already works.
    } finally {
      setLoadingMore(false)
    }
  }

  /**
   * If the list ever becomes empty while the backend says there are older
   * clips waiting, load them automatically. This covers deleting the last
   * clip on a page without re-introducing stale closures into handleDelete.
   */
  useEffect(() => {
    if (
      loadOlderAfterDeleteRef.current &&
      clips !== null &&
      clips.length === 0 &&
      pagingRef.current.hasMore &&
      pagingRef.current.nextBefore &&
      !loadingMore
    ) {
      void loadOlder()
    }
    loadOlderAfterDeleteRef.current = null
  }, [clips, loadingMore])

  /**
   * One row per source video, newest video first, its clips newest first.
   * The reference's rows are categories; ours are the films the clips came
   * from, which is how someone remembers what they cut.
   */
  const rows = useMemo(() => {
    const byVideo = new Map<string, { videoId: string; title: string; clips: LibraryClip[] }>()
    for (const clip of clips ?? []) {
      const row = byVideo.get(clip.videoId)
      if (row) row.clips.push(clip)
      else byVideo.set(clip.videoId, { videoId: clip.videoId, title: clip.videoTitle ?? "Your video", clips: [clip] })
    }
    return Array.from(byVideo.values())
  }, [clips])

  const openClip = clips?.find((clip) => clip.id === openId) ?? null

  /** What the library offers on a clip: the card's menu and the viewer's row, from one list. */
  const clipActions = (clip: LibraryClip): ClipAction[] => [
    ...(clip.downloadUrl ? [{ label: "Download", href: clip.downloadUrl }] : []),
    ...(clip.status === "ready"
      ? [
          { label: "Edit captions", icon: CaptionsIcon, onClick: () => setCaptionClipId(clip.id) },
          {
            label: "Rename",
            icon: PencilEdit01Icon,
            onClick: () => setRenameTarget({ clipId: clip.id, value: clip.description, originalValue: clip.description }),
          },
        ]
      : []),
    { label: "Delete", icon: Delete01Icon, tone: "danger" as const, onClick: () => setDeleteTargetId(clip.id) },
  ]

  return (
    <>
      <div
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

        {clips === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48 rounded-md" />
            <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-hidden px-1 pb-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Skeleton key={index} className="h-[420px] w-[190px] flex-none rounded-xl sm:w-[220px]" />
              ))}
            </div>
          </div>
        ) : clips.length === 0 || failed ? (
          // The empty page holds its room instead of huddling under the
          // heading — the same dashed-card state the other screens use.
          // A failed load shows the same CTA: refreshing is the next action.
          <Card className="flex flex-1 items-center justify-center border-dashed">
            <CardContent className="flex max-w-md flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-shmuted text-muted-foreground">
                <HugeiconsIcon icon={VideoReplayIcon} className="size-6" />
              </span>
              {failed ? (
                <>
                  <h2 className="text-lg font-semibold">Couldn’t load your clips</h2>
                  <p className="text-sm text-muted-foreground">
                    The library couldn’t connect. Try again, or upload a video to get started.
                  </p>
                </>
              ) : isSignedIn ? (
                <>
                  <h2 className="text-lg font-semibold">No clips yet</h2>
                  <p className="text-sm text-muted-foreground">
                    Cut a moment from any video and it lands here — ready to play, download,
                    edit, rename, or delete.
                  </p>
                </>
              ) : authConfigured === false ? (
                <>
                  <h2 className="text-lg font-semibold">No clips in this tab yet</h2>
                  <p className="text-sm text-muted-foreground">
                    Clips live with the browser tab that made them on this deployment, and
                    accounts aren&apos;t switched on. Cut one and it lands here.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold">Sign in to see your clips</h2>
                  <p className="text-sm text-muted-foreground">
                    This page is only showing clips made in this browser tab. Anything saved to
                    your account is waiting behind sign-in.
                  </p>
                </>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {failed && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFailed(false)
                      setClips(null)
                      void api.listClips().then((page) => {
                        setClips(page.clips)
                        setHasMore(page.nextBefore !== null)
                        setNextBefore(page.nextBefore)
                      }).catch(() => {
                        setClips([])
                        setFailed(true)
                      })
                    }}
                  >
                    Try again
                  </Button>
                )}
                {!failed && !isSignedIn && authConfigured !== false && (
                  <Button
                    disabled={authConfigured === null}
                    onClick={askToSignIn}
                    className="whitespace-nowrap"
                  >
                    Sign in
                  </Button>
                )}
                <Button asChild className="whitespace-nowrap">
                  <a href="/start">
                    <HugeiconsIcon icon={ScissorsIcon} />
                    Clip a video
                  </a>
                </Button>
              </div>
              {!failed && hasMore && nextBefore && (
                <div className="mt-2 flex justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => void loadOlder()}
                    className="whitespace-nowrap"
                  >
                    {loadingMore ? "Loading…" : "Show older clips"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {rows.map((row) => (
              <ClipRow key={row.videoId} title={row.title} count={row.clips.length}>
                {row.clips.map((clip, index) => (
                  <TimelineAnimation key={clip.id} animationNum={index} customVariants={CARD_REVEAL}>
                    <ClipCard
                      clip={clip}
                      surface="light"
                      onOpen={() => setOpenId(clip.id)}
                      showDate
                      actions={clipActions(clip)}
                    />
                  </TimelineAnimation>
                ))}
              </ClipRow>
            ))}
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

      {/* Opening a card: the clip in its true shape, with the same actions. */}
      <ClipViewer
        clip={openClip}
        onClose={() => setOpenId(null)}
        showDate
        actions={openClip ? clipActions(openClip) : undefined}
      />

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

      {/* Rename the clip in the library. The API name is videoTitle; the page
          displays it as the description when one exists. */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent className="shadcn-scope sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Rename clip</DialogTitle>
            <DialogDescription>This is what you’ll see in your library.</DialogDescription>
          </DialogHeader>
          {renameTarget && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleRename(renameTarget.clipId, renameTarget.value)
              }}
              className="flex flex-col gap-4"
            >
              <Input
                value={renameTarget.value}
                onChange={(e) => setRenameTarget((current) => (current ? { ...current, value: e.target.value } : null))}
                placeholder="A moment from your video"
                autoFocus
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRenameTarget(null)}
                  disabled={renameBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={renameBusy || renameTarget.value === renameTarget.originalValue}>
                  {renameBusy ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete a clip permanently. The source upload is untouched. */}
      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null)
        }}
      >
        <DialogContent className="shadcn-scope sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Delete this clip?</DialogTitle>
            <DialogDescription>
              This can’t be undone. The original video stays in your uploads.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTargetId(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteBusy}
              onClick={() => {
                if (deleteTargetId) void handleDelete(deleteTargetId)
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </Button>
          </div>
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
