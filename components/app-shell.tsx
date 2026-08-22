"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { AccountControl } from "@/components/account-control"
import { NAV_ITEMS, SideNav, type NavDestination } from "@/components/side-nav"

/**
 * The frame every screen sits in: side rail on the left (desktop), a small
 * link row instead on phones, and a header whose right side holds the account
 * and whatever the current screen needs at hand.
 *
 * The brand lives in the rail on desktop and in the header on phones — once
 * each, never both.
 */
export function AppShell({
  active,
  headerExtra,
  children,
}: {
  active: NavDestination
  headerExtra?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh w-full">
      <SideNav active={active} />

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col px-6 py-6">
        {/* flex-wrap: on a phone with a video open this row holds the brand,
            three links, the clip-another button and the account — which is
            more than 360px owns. Wrapping to a second row beats controls at
            zero width. */}
        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <span className="flex min-w-0 items-center gap-4 lg:hidden">
            <Link href="/" className="shrink-0 font-serif text-2xl tracking-tight">
              CLIPIT
            </Link>
            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
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

          <span className="ml-auto flex shrink-0 items-center gap-3">
            {headerExtra}
            <AccountControl />
          </span>
        </header>

        {children}
      </div>
    </div>
  )
}
