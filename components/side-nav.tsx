"use client"

import { useLayoutEffect, useState, type ComponentProps, type SVGProps } from "react"
import {
  SideNav as AstryxSideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav"

/**
 * The left rail: where you are in CLIPIT, and the way to everywhere else.
 *
 * Astryx's SideNav does the furniture — the landmark, aria-current on the
 * selected item, the disclosure-pattern collapse, icon-only flyouts — and we
 * keep the decisions that were ours before the move:
 *
 * - Collapsed is remembered per browser (same key as always), restored
 *   before first paint so a person who saved the rail closed never watches
 *   it animate shut on every navigation.
 * - "New clip" is a full navigation on purpose: landing on /start fresh is
 *   what resets the theater, so it must work even from /start itself.
 * - The wordmark keeps its serif voice via the theme's side-nav-heading
 *   override — the one place serif is allowed to appear.
 */

const COLLAPSED_KEY = "clipit.nav.collapsed"

export type NavDestination = "home" | "start" | "clips" | "publishing"

/** Width/height come last so Astryx's sizing wins when it passes its own. */
const HomeGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden width={18} height={18} {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </svg>
)

const ScissorsGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden width={18} height={18} {...props}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

const LibraryGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden width={18} height={18} {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4" />
  </svg>
)

const BroadcastGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden width={18} height={18} {...props}>
    <circle cx="12" cy="12" r="2" />
    <path d="M7.76 16.24a6 6 0 0 1 0-8.48M16.24 7.76a6 6 0 0 1 0 8.48M4.93 19.07a10 10 0 0 1 0-14.14M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
)

export const NAV_ITEMS: Array<{
  key: NavDestination
  label: string
  href: string
  icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element
}> = [
  { key: "home", label: "Home", href: "/home", icon: HomeGlyph },
  { key: "start", label: "New clip", href: "/start", icon: ScissorsGlyph },
  { key: "clips", label: "Your clips", href: "/clips", icon: LibraryGlyph },
  { key: "publishing", label: "Publishing", href: "/publishing", icon: BroadcastGlyph },
]

/**
 * A plain anchor, bypassing the router on purpose — see the "New clip" note
 * above. Everything else in the rail navigates through Next via LinkProvider.
 */
const FullNavigationLink = (props: ComponentProps<"a">) => <a {...props} />

export function SideNav({ active }: { active: NavDestination }) {
  const [collapsed, setCollapsed] = useState(false)
  // Transitions must not play while the saved state is being applied: the
  // restore happens in useLayoutEffect, before the browser ever paints the
  // default, so the rail simply appears the way its owner left it.
  useLayoutEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "true")
    } catch {
      // Blocked storage just means the rail starts open. Nothing to do.
    }
  }, [])

  const handleCollapsedChange = (next: boolean) => {
    setCollapsed(next)
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(next))
    } catch {
      // Not remembering the fold is fine; refusing to fold would not be.
    }
  }

  return (
    <AstryxSideNav
      collapsible={{ isCollapsed: collapsed, onCollapsedChange: handleCollapsedChange }}
      header={<SideNavHeading heading="CLIPIT" headingHref="/" />}
    >
      <SideNavSection title="Navigate" isHeaderHidden>
        {NAV_ITEMS.map((item) =>
          item.key === "start" ? (
            <SideNavItem
              key={item.key}
              label={item.label}
              href={item.href}
              icon={item.icon}
              isSelected={active === item.key}
              as={FullNavigationLink}
            />
          ) : (
            <SideNavItem
              key={item.key}
              label={item.label}
              href={item.href}
              icon={item.icon}
              isSelected={active === item.key}
            />
          ),
        )}
      </SideNavSection>
    </AstryxSideNav>
  )
}
