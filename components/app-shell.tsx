"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { AppShell as AstryxAppShell } from "@astryxdesign/core/AppShell"
import { Logo } from "@/components/brand/logo"
import { AccountControl } from "@/components/account-control"
import { NAV_ITEMS, SideNav, type NavDestination } from "@/components/side-nav"

/**
 * The frame every screen sits in, now on Astryx's AppShell: it owns the skip
 * link, the main landmark, and the rail slot; we keep the decisions that are
 * ours — the account control stays in the header (its own rework comes with
 * the account screens), and phones keep the link row that already earns its
 * space instead of the auto-generated drawer, until that drawer gets its own
 * verified pass (mobileNav={false} suppresses it deliberately).
 *
 * The brand lives in the rail on desktop and in the header row on phones —
 * both draw the same Logo component, so there is one wordmark in the product
 * rather than a rail and a header disagreeing about what it looks like —
 * once each, never both.
 */
export function AppShell({
  active,
  activeWorkspaceId,
  headerExtra,
  children,
}: {
  active: NavDestination
  /** The open room, when a workspace page is showing — selects its tree entry. */
  activeWorkspaceId?: string
  headerExtra?: ReactNode
  children: ReactNode
}) {
  return (
    <AstryxAppShell height="fill" variant="section" contentPadding={0} mobileNav={false} sideNav={<SideNav active={active} activeWorkspaceId={activeWorkspaceId} />}>
      {/* Two rows — the header at its own height, the page taking everything
          left — rather than a flex column. In a flex column the page below the
          header is only as tall as its own content, so a screen holding one
          empty state drew it in a 500px band at the top of an 860px window and
          left 360px of dead ground beneath it. `Layout height="fill"` fills
          its container; this is what finally gives it a container worth
          filling. */}
      <div className="grid min-h-dvh min-w-0 flex-1 grid-rows-[auto_1fr]">
        {/* The shell no longer pads the content area: each page's Layout owns
            its own inset now, and double horizontal padding pushed content
            out of line with this header. The header pads itself instead. */}
        {/* flex-wrap: on a phone with a video open this row holds the brand,
            three links, the clip-another button and the account — which is
            more than 360px owns. Wrapping to a second row beats controls at
            zero width. */}
        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 pt-6">
          <span className="flex min-w-0 items-center gap-4 lg:hidden">
            <Link href="/" aria-label="Clipit — home" className="shrink-0">
              <Logo size={22} />
            </Link>
            <nav aria-label="CLIPIT" className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {NAV_ITEMS.map((item) => {
                const className = `whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                  active === item.key ? "bg-white/10 text-foreground" : "text-foreground/60 hover:text-foreground"
                }`
                // Same rule as the rail: New clip is a full navigation, so it
                // resets the theater even when tapped from the theater.
                return item.key === "start" ? (
                  <a key={item.key} href={item.href} className={className}>
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.key} href={item.href} className={className}>
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </span>

          {/* The account has moved to the foot of the rail — destinations at
              the top, the person at the bottom, which is the shape the
              owner's reference uses and what stops the rail's lower half
              reading as an empty column. On a phone the rail is not on
              screen, so the header keeps it there. */}
          <span className="ml-auto flex shrink-0 items-center gap-3">
            {headerExtra}
            <span className="lg:hidden">
              <AccountControl />
            </span>
          </span>
        </header>

        {children}
      </div>
    </AstryxAppShell>
  )
}
