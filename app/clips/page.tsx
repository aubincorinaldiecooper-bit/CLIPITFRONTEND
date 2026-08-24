"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
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
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
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
  const [caption, setCaption] = useState("")
  const [publishingId, setPublishingId] = useState<string | null>(null)
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
        setNextBefore(page.nextBefore)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const publish = async (clipId: string) => {
    if (publishingId) return
    setPublishingId(clipId)
    try {
      await api.publishClip(clipId, { caption: caption.trim() })
      // Transient news is transient: the confirmation appears and leaves on
      // its own instead of becoming permanent card content.
      toast({ body: "Sent — it's on its way to your connected accounts." })
      // Only touch the panel if it is still this clip's — another clip's
      // popover may have been opened while this request was in flight, and
      // closing it (or wiping its caption draft) is not this request's call.
      if (publishOpenIdRef.current === clipId) {
        setPublishTarget(null)
        setCaption("")
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
      setPublishingId(null)
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
        setRooms([])
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

  const loadOlder = async () => {
    if (!nextBefore || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await api.listClips(nextBefore)
      setClips((current) => [...(current ?? []), ...page.clips])
      setNextBefore(page.nextBefore)
    } catch {
      // The button stays; pressing it again retries. A failed "older clips"
      // fetch is not worth an error banner over a page that already works.
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <AppShell active="clips">
      <Layout height="auto" contentWidth={1152}>
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
              <Grid columns={{ minWidth: 280, max: 3 }} gap={3}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <Skeleton key={index} height={230} radius={3} index={index} />
                ))}
              </Grid>
            ) : clips.length === 0 ? (
              <EmptyState
                icon={<GhostCards />}
                title="No clips yet"
                description="Cut a moment from any video and it lands here — ready to play, download, caption, and publish."
                actions={<Button label="Clip a video" variant="primary" href="/start" />}
              />
            ) : (
              <VStack gap={4} align="stretch">
                <Grid columns={{ minWidth: 280, max: 3 }} gap={3}>
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
                          <Button label="Captions" variant="secondary" size="sm" href={`/clips/${clip.id}/captions`} />
                        )}
                        {clip.status === "ready" && (
                          <Popover
                            isOpen={publishOpenId === clip.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setCaption("")
                                setPublishTarget(clip.id)
                              } else if (publishOpenIdRef.current === clip.id) {
                                // Only close what is ours: a light-dismiss can
                                // fire while another card's popover is opening.
                                setPublishTarget(null)
                              }
                            }}
                            placement="below"
                            width={320}
                            label="Publish this clip"
                            content={
                              <VStack gap={2} align="stretch">
                                <TextInput
                                  label="Caption"
                                  isLabelHidden
                                  value={caption}
                                  onChange={(value) => setCaption(value)}
                                  placeholder="Write a caption (optional)"
                                  hasAutoFocus
                                />
                                <Button
                                  label="Post to connected accounts"
                                  variant="primary"
                                  size="sm"
                                  isLoading={publishingId === clip.id}
                                  onClick={() => void publish(clip.id)}
                                />
                              </VStack>
                            }
                          >
                            <Button label="Publish" variant="secondary" size="sm" />
                          </Popover>
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
                              rooms === null ? (
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
                {nextBefore && (
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
    </AppShell>
  )
}
