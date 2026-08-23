"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@astryxdesign/core/Button"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { Card } from "@astryxdesign/core/Card"
import { Grid } from "@astryxdesign/core/Grid"
import { Heading } from "@astryxdesign/core/Heading"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { api } from "@/lib/api"
import type { ActivityStats, LibraryClip } from "@/lib/types"
import { AppShell } from "@/components/app-shell"
import { authClient } from "@/lib/auth-client"

/**
 * Home: what you have done here, what you cut most recently, and the one
 * button that matters — now on Astryx's Card/Grid/Heading/Text, which also
 * settles an old debt: the page heading was serif, and serif is the
 * wordmark's voice only. Headings here are Geist like the rest of the
 * interface.
 *
 * Every number on this screen is a count of the caller's own rows. The one
 * section that cannot be real yet — how clips perform once posted — says so
 * in a sentence instead of wearing invented zeros as if they were data.
 * A dash means "not loaded", never a fake zero.
 *
 * The clip cards stay hand-built: they play footage in place, and media
 * surfaces are the owner's carve-out from the Astryx rework.
 */

const ScissorsGlyph = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

export default function HomePage() {
  const { data: session } = authClient.useSession()
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [recent, setRecent] = useState<LibraryClip[] | null>(null)
  const [recentFailed, setRecentFailed] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .getStats()
      .then(({ stats: counted }) => {
        if (!cancelled) setStats(counted)
      })
      .catch(() => {
        // A home page without numbers is still a home page.
      })
    void api
      .listClips()
      .then((page) => {
        if (!cancelled) setRecent(page.clips.slice(0, 6))
      })
      .catch(() => {
        // A failed load is not an empty library. "Nothing yet" over an outage
        // tells someone their clips are gone when they are not.
        if (!cancelled) setRecentFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = session?.user?.email?.split("@")[0]

  return (
    <AppShell active="home">
      <Layout height="auto" contentWidth={1152}>
        <LayoutContent padding={6}>
          <VStack gap={6} align="stretch">
            <HStack justify="between" align="end" gap={4} wrap="wrap">
          <VStack gap={1.5}>
            <Heading level={1}>
              {firstName ? `Welcome back, ${firstName}` : "Welcome"}
            </Heading>
            <Text as="p" type="supporting">
              Drop in a long video, describe the moment, and cut it into a post-ready clip.
            </Text>
          </VStack>
          <Button label="Start clipping" variant="primary" icon={ScissorsGlyph} href="/start" />
        </HStack>

            {/* Counted from this caller's rows; a dash means "not loaded",
                never a fake zero. */}
            <Grid columns={{ minWidth: 150, max: 4 }} gap={2}>
            {(
              [
                { label: "Videos", value: stats?.videos },
                { label: "Minutes of video", value: stats?.minutesOfVideo },
                { label: "Questions answered", value: stats?.questionsAnswered },
                { label: "Clips cut", value: stats?.clipsCut },
              ] as const
            ).map((tile) => (
              <Card key={tile.label} variant="muted" padding={3}>
                <VStack gap={0.5}>
                  <Text size="2xl" weight="medium">
                    <span className="tabular-nums">{tile.value ?? "—"}</span>
                  </Text>
                  <Text type="supporting">{tile.label}</Text>
                </VStack>
              </Card>
            ))}
            </Grid>

            <VStack gap={3} align="stretch">
              <HStack justify="between" align="center" gap={4}>
                <Heading level={2}>
                  Recent clips
                </Heading>
                <Link href="/clips" className="whitespace-nowrap text-[13px] text-foreground/50 transition-colors hover:text-foreground">
                  All clips →
                </Link>
              </HStack>

              {recentFailed ? (
                <p className="text-sm text-error">Couldn't load your clips just now — refresh to try again.</p>
              ) : recent === null ? (
                <Grid columns={{ minWidth: 150, max: 6 }} gap={2}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <Skeleton key={index} height={110} radius={2} index={index} />
                  ))}
                </Grid>
              ) : recent.length === 0 ? (
                <Text as="p" type="supporting">
                  Nothing yet — cut a moment from a video and it lands here.
                </Text>
              ) : (
                <Grid columns={{ minWidth: 150, max: 6 }} gap={2}>
              {recent.map((clip) => (
                <div key={clip.id} className="overflow-hidden rounded-lg bg-black/35 ring-1 ring-white/10">
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
                        <span className="absolute inset-0 m-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 transition-transform group-hover:scale-105">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
                          </svg>
                        </span>
                      )}
                    </button>
                  )}
                  <p className="truncate px-2 py-1.5 text-[11.5px] text-foreground/60">{clip.description}</p>
                </div>
              ))}
                </Grid>
              )}
            </VStack>

            {/* The section that cannot be real yet, saying so plainly. Dashes are
            "no data exists", which is true; zeros would claim a measurement
            that never happened. */}
            <Card variant="muted" padding={4}>
              <VStack gap={4} align="stretch">
                <HStack justify="between" align="center" gap={4} wrap="wrap">
              <VStack gap={1}>
                <Heading level={2}>
                  Post performance
                </Heading>
                <Text as="p" type="supporting">
                  Views, likes and shares appear here once you connect the accounts you post to.
                </Text>
              </VStack>
                  <Button label="Connect accounts" variant="secondary" size="sm" href="/publishing" />
                </HStack>
                <Grid columns={3} gap={2}>
                {["Views", "Likes", "Shares"].map((label) => (
                  <Card key={label} variant="transparent" padding={3}>
                    <VStack gap={0.5}>
                      <Text size="xl" weight="medium" color="disabled">
                        —
                      </Text>
                      <Text type="supporting" color="disabled">
                        {label}
                      </Text>
                    </VStack>
                  </Card>
                ))}
                </Grid>
              </VStack>
            </Card>
          </VStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
