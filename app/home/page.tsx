"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  BubbleChatQuestionIcon,
  Clock01Icon,
  FavouriteIcon,
  ScissorsIcon,
  Share01Icon,
  TradeUpIcon,
  Video01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { api } from "@/lib/api"
import type { ActivityStats } from "@/lib/types"
import { WorkspaceShell } from "@/components/workspace/shell"
import { authClient } from "@/lib/auth-client"

/** The four counts, each with the mark that tells it apart at a glance. */
const STAT_TILES: ReadonlyArray<{
  icon: IconSvgElement
  label: string
  value: (s: ActivityStats | null) => number | undefined
}> = [
  { icon: Video01Icon, label: "Videos", value: (s) => s?.videos },
  { icon: Clock01Icon, label: "Minutes of video", value: (s) => s?.minutesOfVideo },
  { icon: BubbleChatQuestionIcon, label: "Questions answered", value: (s) => s?.questionsAnswered },
  { icon: ScissorsIcon, label: "Clips cut", value: (s) => s?.clipsCut },
]

/** What performance would show, once there is any. */
const PERFORMANCE: ReadonlyArray<{ icon: IconSvgElement; label: string }> = [
  { icon: ViewIcon, label: "Views" },
  { icon: FavouriteIcon, label: "Likes" },
  { icon: Share01Icon, label: "Shares" },
]

/**
 * Home: the numbers, and the one button that matters — on the app shell the
 * Shared screens proved out, at the owner's direction.
 *
 * Every number on this screen is a count of the caller's own rows. The one
 * section that cannot be real yet — how clips perform once posted — says so
 * in a sentence instead of wearing invented zeros as if they were data.
 * A dash means "not loaded", never a fake zero.
 */
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
    <WorkspaceShell active="home">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {firstName ? `Welcome back, ${firstName}` : "Welcome"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Drop in a long video, describe the moment, and cut it into a post-ready clip.
            </p>
          </div>
          <Button asChild>
            <a href="/start">
              <HugeiconsIcon icon={ScissorsIcon} />
              Start clipping
            </a>
          </Button>
        </div>

        {/* Counted from this caller's rows; a dash means "not loaded", never
            a fake zero. Each tile carries its own mark — four bare numbers in
            a row read as a table. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_TILES.map((tile) => (
            <Card key={tile.label}>
              <CardContent className="flex flex-col gap-6">
                <span className="flex size-9 items-center justify-center rounded-md bg-shmuted text-muted-foreground">
                  <HugeiconsIcon icon={tile.icon} className="size-[18px]" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-3xl font-medium tabular-nums">
                    {tile.value(stats) ?? "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">{tile.label}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* The section that cannot be real yet, saying so plainly. Dashes are
            "no data exists", which is true; zeros would claim a measurement
            that never happened. */}
        <Card>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-shmuted text-muted-foreground">
                  <HugeiconsIcon icon={TradeUpIcon} className="size-[18px]" />
                </span>
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold">Post performance</h2>
                  <p className="text-sm text-muted-foreground">
                    Views, likes and shares appear here once you connect the accounts you post to.
                  </p>
                </div>
              </div>
              <Button variant="secondary" asChild>
                <Link href="/publishing">Connect accounts</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3">
              {PERFORMANCE.map((metric, index) => (
                <div
                  key={metric.label}
                  // A rule between the columns, and never before the first.
                  className={
                    "flex flex-col gap-4 " +
                    (index > 0 ? "sm:border-l sm:border-shborder sm:pl-6" : "sm:pr-6")
                  }
                >
                  <span className="flex size-9 items-center justify-center rounded-md bg-shmuted text-muted-foreground">
                    <HugeiconsIcon icon={metric.icon} className="size-[18px]" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-2xl font-medium text-muted-foreground/60">—</span>
                    <span className="text-sm text-muted-foreground">{metric.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  )
}
