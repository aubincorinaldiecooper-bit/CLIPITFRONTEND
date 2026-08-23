"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
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
  const [sendingTo, setSendingTo] = useState<string | null>(null)

  const setSendTarget = (id: string | null) => {
    sendOpenIdRef.current = id
    setSendOpenId(id)
  }

  const openSend = (clipId: string) => {
    setRooms(null)
    setSharedWith([])
    setSendTarget(clipId)
    void api
      .getClipWorkspaces(clipId)
      .then((result) => {
        // Still this clip's popover? Someone may have moved on mid-fetch.
        if (sendOpenIdRef.current !== clipId) return
        setRooms(result.workspaces)
        setSharedWith(result.sharedWith)
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
              <VStack gap={3} align="start">
                <Text as="p" type="supporting">
                  Nothing here yet — cut a moment from a video and it lands here.
                </Text>
                <Button label="Clip a video" variant="primary" size="sm" href="/start" />
              </VStack>
            ) : (
              <VStack gap={4} align="stretch">
                <Grid columns={{ minWidth: 280, max: 3 }} gap={3}>
                {clips.map((clip) => (
                  <div key={clip.id} className="overflow-hidden rounded-xl bg-black/35 ring-1 ring-white/10">
                    {playingId === clip.id && clip.url ? (
                      <video src={clip.url} controls autoPlay playsInline className="aspect-video w-full bg-black" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPlayingId(clip.id)}
                        disabled={!clip.url}
                        aria-label={`Play: ${clip.description}`}
                        className="group relative block aspect-video w-full bg-black/60 disabled:cursor-default"
                      >
                        {clip.thumbnailUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={clip.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                        )}
                        {clip.url && (
                          <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 transition-transform group-hover:scale-105">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
                            </svg>
                          </span>
                        )}
                      </button>
                    )}

                    <div className="flex flex-col gap-2 p-3">
                      <p className="line-clamp-2 min-h-[2.5rem] text-[13.5px] leading-snug text-foreground/85">
                        {clip.description || "A moment from your video"}
                      </p>
                      <p className="truncate text-[12px] text-foreground/40">
                        <span className="font-mono tabular-nums">
                          {clip.startTimecode} – {clip.endTimecode}
                        </span>
                        {clip.videoTitle ? ` · ${clip.videoTitle}` : ""}
                        {` · ${new Date(clip.createdAt).toLocaleDateString()}`}
                      </p>
                      <HStack gap={2} align="center" wrap="wrap">
                        {clip.downloadUrl && (
                          /* A plain anchor with `download`, not a routed link:
                             the browser must save the signed file directly. */
                          <a
                            href={clip.downloadUrl}
                            download
                            className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-black transition-transform active:scale-[0.97]"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
                            </svg>
                            Download
                          </a>
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
                      </HStack>
                    </div>
                  </div>
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
