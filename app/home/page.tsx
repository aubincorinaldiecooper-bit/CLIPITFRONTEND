"use client"

import { useEffect, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { Card } from "@astryxdesign/core/Card"
import { Grid } from "@astryxdesign/core/Grid"
import { Heading } from "@astryxdesign/core/Heading"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { api } from "@/lib/api"
import type { ActivityStats } from "@/lib/types"
import { AppShell } from "@/components/app-shell"
import { authClient } from "@/lib/auth-client"
import {
  ClockGlyph,
  EyeGlyph,
  HeartGlyph,
  QuestionGlyph,
  ScissorsGlyph as ScissorsMark,
  ShareGlyph,
  TrendGlyph,
  VideoGlyph,
} from "@/components/feature-glyphs"
import { IconWell, SectionCard } from "@/components/section-card"

/** The four counts, each with the mark the design gives it. */
const STAT_TILES = [
  { icon: VideoGlyph, label: "Videos", value: (s: ActivityStats | null) => s?.videos },
  { icon: ClockGlyph, label: "Minutes of video", value: (s: ActivityStats | null) => s?.minutesOfVideo },
  { icon: QuestionGlyph, label: "Questions answered", value: (s: ActivityStats | null) => s?.questionsAnswered },
  { icon: ScissorsMark, label: "Clips cut", value: (s: ActivityStats | null) => s?.clipsCut },
] as const

/** What performance would show, once there is any. */
const PERFORMANCE = [
  { icon: EyeGlyph, label: "Views" },
  { icon: HeartGlyph, label: "Likes" },
  { icon: ShareGlyph, label: "Shares" },
] as const

/**
 * Home: the numbers, and the one button that matters.
 *
 * It used to carry a strip of recent clips as well. That was a second copy of
 * the library sitting on the way to the library — the owner's call is that
 * this page is for how things are doing, and browsing clips belongs on the
 * clips page.
 *
 * Every number on this screen is a count of the caller's own rows. The one
 * section that cannot be real yet — how clips perform once posted — says so
 * in a sentence instead of wearing invented zeros as if they were data.
 * A dash means "not loaded", never a fake zero.
 *
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
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = session?.user?.email?.split("@")[0]

  return (
    <AppShell active="home">
      <Layout height="auto" contentWidth={1360}>
        <LayoutContent padding={6}>
          <VStack gap={6} align="stretch">
            <HStack justify="between" align="end" gap={4} wrap="wrap">
          <VStack gap={1.5}>
            <Heading level={1}>
              {firstName ? `Welcome back, ${firstName}` : "Welcome"}
            </Heading>
            <Text as="p" type="body" color="secondary">
              Drop in a long video, describe the moment, and cut it into a post-ready clip.
            </Text>
          </VStack>
          <Button label="Start clipping" variant="primary" icon={ScissorsGlyph} href="/start" />
        </HStack>

            {/* Counted from this caller's rows; a dash means "not loaded",
                never a fake zero. Each tile carries its own mark, as the design
                has them — four bare numbers in a row read as a table, and the
                icon is what tells them apart at a glance. */}
            <Grid columns={{ minWidth: 220, max: 4 }} gap={3}>
              {STAT_TILES.map((tile) => (
                <Card key={tile.label} variant="muted" padding={5}>
                  <VStack gap={6} align="stretch">
                    <IconWell icon={tile.icon} size="sm" />
                    <VStack gap={0.5}>
                      <Text size="4xl" weight="medium">
                        <span className="tabular-nums">{tile.value(stats) ?? "—"}</span>
                      </Text>
                      <Text type="body" color="secondary">{tile.label}</Text>
                    </VStack>
                  </VStack>
                </Card>
              ))}
            </Grid>

            {/* The section that cannot be real yet, saying so plainly. Dashes
                are "no data exists", which is true; zeros would claim a
                measurement that never happened. */}
            <SectionCard
              icon={TrendGlyph}
              title="Post performance"
              descriptionPlacement="below"
              description="Views, likes and shares appear here once you connect the accounts you post to."
              action={<Button label="Connect accounts" variant="secondary" href="/publishing" />}
            >
              <Grid columns={{ minWidth: 200, max: 3 }} gap={0}>
                {PERFORMANCE.map((metric, index) => (
                  <VStack
                    key={metric.label}
                    gap={4}
                    align="stretch"
                    // A rule between the columns, as the design draws it, and
                    // never before the first.
                    className={index > 0 ? "sm:border-l sm:border-border sm:pl-6" : "sm:pr-6"}
                  >
                    <IconWell icon={metric.icon} size="sm" />
                    <VStack gap={0.5}>
                      <Text size="2xl" weight="medium" color="disabled">
                        —
                      </Text>
                      <Text type="body" color="secondary">
                        {metric.label}
                      </Text>
                    </VStack>
                  </VStack>
                ))}
              </Grid>
            </SectionCard>
          </VStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
