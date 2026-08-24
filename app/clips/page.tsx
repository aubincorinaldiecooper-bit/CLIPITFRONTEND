"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
import { Center } from "@astryxdesign/core/Center"
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
import { EmptyState } from "@astryxdesign/core/EmptyState"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { Grid } from "@astryxdesign/core/Grid"
import { Heading } from "@astryxdesign/core/Heading"
import { Popover } from "@astryxdesign/core/Popover"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { TextInput } from "@astryxdesign/core/TextInput"
import { useToast } from "@astryxdesign/core/Toast"
import { api, ApiError } from "@/lib/api"
import type { LibraryClip } from "@/lib/types"
import { AppShell } from "@/components/app-shell"
import { CaptionEditor } from "@/components/caption-editor"
import { PublishPreview } from "@/components/publish-preview"
import { ClipCard, ClipDownloadAction } from "@/components/clip-card"
import { GhostCards } from "@/components/empty-illustrations"

/**
 * Everything you have cut, newest first — chrome on Astryx, clips
 * hand-built. Each card is the clip's still until you press play, then the
 * clip itself in place — no lightbox, no second page; media surfaces are the
 * owner's carve-out from the Astryx rework. Download uses the signed
 * attachment URL, so the browser saves the file without this page touching
 * the bytes.
 *
 * The heading was serif and is Geist now — serif is the wordmark's voice
 * only, per the AGENTS.md floors.
 */
export default function ClipsPage() {
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
  /**
   * The publish form lives in a Popover over the card — the card itself
   * never grows or reflows (the AGENTS.md no-reflow rule). One caption draft
   * belongs to whichever popover is open; the ref mirrors the open id so a
   * finishing request can tell whether the open panel is still its own.
   */
  const [publishOpenId, setPublishOpenId] = useState<string | null>(null)
  const publishOpenIdRef = useRef<string | null>(null)
  /**
   * Caption drafts, one per clip. A draft survives its popover closing —
   * clicking a pixel outside the panel must not erase a paragraph someone
   * typed — and is dropped only when the publish it was written for lands.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({})
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
  const toast = useToast()

  const setPublishTarget = (id: string | null) => {
    publishOpenIdRef.current = id
    setPublishOpenId(id)
  }

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
      const { posts } = await api.publishClip(clipId, { caption: (drafts[clipId] ?? "").trim() })
      // Transient news is transient: the confirmation appears and leaves on
      // its own instead of becoming permanent card content. When a platform
      // needs a different shape than the clip was shot in, the file is cut
      // first — say so, so a short delay reads as work, not silence.
      const shaping = posts?.filter((entry) => entry.status === "rendering") ?? []
      toast({
        body:
          shaping.length > 0
            ? `Sent — ${shaping
                .flatMap((entry) => entry.targets.map((target) => target.platform))
                .map((platform) => platform.charAt(0).toUpperCase() + platform.slice(1))
                .join(" and ")} ${shaping.length === 1 && shaping[0]!.targets.length === 1 ? "gets" : "get"} a ${shaping
                .map((entry) => entry.aspect)
                .join(" and ")} cut first; it posts automatically when ready.`
            : "Sent — it's on its way to your connected accounts.",
      })
      // The draft did its job; the panel closes only if it is still this
      // clip's — another clip's popover may have opened mid-flight.
      setDrafts((current) => {
        const { [clipId]: _sent, ...rest } = current
        return rest
      })
      if (publishOpenIdRef.current === clipId) {
        setPublishTarget(null)
      }
    } catch (cause) {
      // The API's refusals are already written for people ("No connected
      // accounts. Connect one on the Publishing page first.") — repeat them.
      // Error toasts stay until dismissed, so the message can't be missed.
      toast({
        type: "error",
        body: cause instanceof ApiError ? cause.message : "Couldn't publish just now. Try again.",
      })
    } finally {
      setPublishingIds((current) => current.filter((id) => id !== clipId))
    }
  }

  /**
   * The Send-to-workspace control: per clip, a popover listing the rooms the
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
        // "The request failed" and "you are in no workspace" are different
        // answers, and this popover must never return them as the same one.
        setSendFailed(true)
      })
  }

  const sendTo = async (clipId: string, workspaceId: string, name: string) => {
    if (sendingTo) return
    setSendingTo(workspaceId)
    try {
      await api.sendClipToWorkspace(workspaceId, clipId)
      toast({ body: `Sent to ${name}. It stays in your library too.` })
      setSharedWith((current) => (current.includes(workspaceId) ? current : [...current, workspaceId]))
    } catch (cause) {
      toast({
        type: "error",
        body: cause instanceof ApiError ? cause.message : "Couldn't send that clip. Try again.",
      })
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
          toast({ body: "Your captioned clip is ready." })
          return
        }
        if (clip.status === "failed" || (clip.status === "ready" && clip.error)) {
          forget()
          toast({ type: "error", body: clip.error ?? "That render failed." })
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
      toast({ body: "Still rendering — it'll appear in your library when it's done." })
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
    <AppShell active="clips">
      <Layout height="auto" contentWidth={1360}>
        <LayoutContent padding={6}>
          <VStack gap={5} align="stretch">
            <VStack gap={1.5}>
              <Heading level={1}>Your clips</Heading>
              <Text as="p" type="supporting">
                Every clip you have cut, ready to play or download.
              </Text>
            </VStack>

            {failed ? (
              <p className="text-sm text-error">Couldn't load your clips. Refresh to try again.</p>
            ) : clips === null ? (
              <Grid columns={{ minWidth: 320, max: 4 }} gap={3}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <Skeleton key={index} height={230} radius={3} index={index} />
                ))}
              </Grid>
            ) : clips.length === 0 ? (
              // Centred in the space the grid would fill, like the reference:
              // an empty page should hold its room, not huddle under the
              // heading.
              <Center minHeight="55vh">
                <EmptyState
                  icon={<GhostCards />}
                  title="No clips yet"
                  description="Cut a moment from any video and it lands here — ready to play, download, caption, and publish."
                  actions={<Button label="Clip a video" variant="primary" href="/start" />}
                />
              </Center>
            ) : (
              <VStack gap={4} align="stretch">
                <Grid columns={{ minWidth: 320, max: 4 }} gap={3}>
                {clips.map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    isPlaying={playingId === clip.id}
                    onPlay={() => setPlayingId(clip.id)}
                    showDate
                    actions={
                      <>
                        {clip.downloadUrl && <ClipDownloadAction href={clip.downloadUrl} />}
                        {clip.status === "ready" && (
                          <Button
                            label="Captions"
                            variant="secondary"
                            size="sm"
                            onClick={() => setCaptionClipId(clip.id)}
                          />
                        )}
                        {clip.status === "ready" && (
                          <Button
                            label="Publish"
                            variant="secondary"
                            size="sm"
                            onClick={() => setPublishTarget(clip.id)}
                          />
                        )}
                        {clip.status === "ready" && (
                          <Popover
                            isOpen={sendOpenId === clip.id}
                            onOpenChange={(open) => {
                              if (open) {
                                openSend(clip.id)
                              } else if (sendOpenIdRef.current === clip.id) {
                                setSendTarget(null)
                              }
                            }}
                            placement="below"
                            width={280}
                            label="Send this clip to a workspace"
                            // The list is all buttons; without an input to
                            // take auto-focus, the hidden accessibility close
                            // button is focused first and pops visible below
                            // the menu. Light dismiss and Escape both remain.
                            hasCloseButton={false}
                            content={
                              sendFailed ? (
                                <VStack gap={2} align="stretch">
                                  <Text as="p" type="supporting" display="block">
                                    Couldn't load your workspaces just now.
                                  </Text>
                                  <Button
                                    label="Try again"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openSend(clip.id)}
                                  />
                                </VStack>
                              ) : rooms === null ? (
                                <Skeleton height={60} radius={2} />
                              ) : sendSignInRequired ? (
                                <Text as="p" type="supporting" display="block">
                                  Workspaces belong to you, not to a browser tab — sign in (top
                                  right) to send clips to one.
                                </Text>
                              ) : rooms.length === 0 ? (
                                <Text as="p" type="supporting" display="block">
                                  You're not in any shared workspace yet. Make one on the Workspaces
                                  page, then send clips there.
                                </Text>
                              ) : (
                                <VStack gap={1} align="stretch">
                                  {rooms.map((room) =>
                                    sharedWith.includes(room.id) ? (
                                      <Text key={room.id} as="p" type="supporting" display="block">
                                        ✓ Already in {room.name}
                                      </Text>
                                    ) : (
                                      <Button
                                        key={room.id}
                                        label={`Send to ${room.name}`}
                                        variant="secondary"
                                        size="sm"
                                        isLoading={sendingTo === room.id}
                                        onClick={() => void sendTo(clip.id, room.id, room.name)}
                                      />
                                    ),
                                  )}
                                </VStack>
                              )
                            }
                          >
                            <Button label="Send to workspace" variant="secondary" size="sm" />
                          </Popover>
                        )}
                      </>
                    }
                  />
                ))}
                </Grid>
                {hasMore && (
                  <HStack justify="center">
                    <Button
                      label={loadingMore ? "Loading…" : "Show older clips"}
                      variant="secondary"
                      size="sm"
                      isLoading={loadingMore}
                      onClick={() => void loadOlder()}
                    />
                  </HStack>
                )}
              </VStack>
            )}
          </VStack>
        </LayoutContent>
      </Layout>
      {/* Approve before the world sees it: every platform's actual cut,
          played at its true shape, and nothing posted until the button. */}
      <Dialog
        isOpen={publishOpenId !== null}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null)
        }}
        purpose="form"
        width="min(980px, 94vw)"
        maxHeight="92vh"
      >
        <DialogHeader
          title="Check before you post"
          onOpenChange={(open) => !open && setPublishTarget(null)}
        />
        {publishOpenId && (
          <PublishPreview
            clipId={publishOpenId}
            caption={drafts[publishOpenId] ?? ""}
            // The guard lives HERE, not in the dialog: closing the dialog
            // unmounts it, and a flag that resets would let a second Post
            // start a publish of a clip already on its way out.
            isPublishing={publishingIds.includes(publishOpenId)}
            onPublishStart={() => setPublishingIds((current) => [...current, publishOpenId])}
            onPublishSettled={() =>
              setPublishingIds((current) => current.filter((id) => id !== publishOpenId))
            }
            onCaptionChange={(value) =>
              setDrafts((current) => ({ ...current, [publishOpenId]: value }))
            }
            onPublished={({ posts }) => {
              const target = publishOpenId
              // Close only OUR dialog. A slow publish finishing after
              // someone moved on to another clip must not dismiss the
              // preview they are now looking at.
              if (publishOpenIdRef.current === target) setPublishTarget(null)
              if (target) {
                setDrafts((current) => {
                  const { [target]: _sent, ...rest } = current
                  return rest
                })
              }
              const shaping = posts?.filter((entry) => entry.status === "rendering") ?? []
              toast({
                body:
                  shaping.length > 0
                    ? "Posted — one cut is still rendering and goes out on its own when it's done."
                    : "Posted — it's on its way to your connected accounts.",
              })
            }}
          />
        )}
      </Dialog>

      <Dialog
        isOpen={captionClipId !== null}
        onOpenChange={(open) => {
          if (!open) closeCaptionEditor()
        }}
        purpose="form"
        width="min(1100px, 94vw)"
        maxHeight="92vh"
      >
        {/* Passing onOpenChange is what gives the header its close button —
            without it the only ways out were the two save buttons, and on a
            touch screen there was no way out at all. */}
        <DialogHeader title="Captions" onOpenChange={(open) => !open && closeCaptionEditor()} />
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
              // response at all, so it is fetched on its own rather than left
              // showing the version it no longer is.
              if (outcome.mode === "replace") patchClip(outcome.clipId)
            }}
          />
        )}
      </Dialog>
    </AppShell>
  )
}
