"use client"

import { useEffect, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { Grid } from "@astryxdesign/core/Grid"
import { Heading } from "@astryxdesign/core/Heading"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { api } from "@/lib/api"
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
