"use client"

import { useEffect, useLayoutEffect, useState, type ComponentProps, type SVGProps } from "react"
import {
  SideNav as AstryxSideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav"
import { api } from "@/lib/api"

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
const WORKSPACES_OPEN_KEY = "clipit.nav.workspaces.open"

/**
 * Fired by any page that changes which rooms exist for this person —
 * creating one, accepting an invitation, leaving. The rail listens and
 * refetches, so the tree is never a stale list of doors.
 */
export const WORKSPACES_CHANGED_EVENT = "clipit:workspaces-changed"

export type NavDestination = "home" | "start" | "clips" | "publishing" | "workspaces"

/** Width/height come last so Astryx's sizing wins when it passes its own. */
const HomeGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 24, height: 24 }} {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </svg>
)

const ScissorsGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 24, height: 24 }} {...props}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

const LibraryGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 24, height: 24 }} {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4" />
  </svg>
)

const BroadcastGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 24, height: 24 }} {...props}>
    <circle cx="12" cy="12" r="2" />
    <path d="M7.76 16.24a6 6 0 0 1 0-8.48M16.24 7.76a6 6 0 0 1 0 8.48M4.93 19.07a10 10 0 0 1 0-14.14M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
)

const TeamGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 24, height: 24 }} {...props}>
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.38M15.6 5.2a3.2 3.2 0 0 1 0 5.6" />
  </svg>
)

const FolderGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 20, height: 20 }} {...props}>
    <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.2l2 2.4H19a1.5 1.5 0 0 1 1.5 1.5v9.1A1.5 1.5 0 0 1 19 19.5H5a1.5 1.5 0 0 1-1.5-1.5V6.5Z" />
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
  { key: "workspaces", label: "Workspaces", href: "/workspaces", icon: TeamGlyph },
]

/**
 * A plain anchor, bypassing the router on purpose — see the "New clip" note
 * above. Everything else in the rail navigates through Next via LinkProvider.
 */
const FullNavigationLink = (props: ComponentProps<"a">) => <a {...props} />

export function SideNav({
  active,
  activeWorkspaceId,
}: {
  active: NavDestination
  /** When a room's own page is open, its entry in the tree is the selection. */
  activeWorkspaceId?: string
}) {
  const [collapsed, setCollapsed] = useState(false)
  /**
   * The rooms in the tree. Null while unknown so nothing flashes; a guest or
   * a failed fetch settles on [] and the rail shows a plain Workspaces link —
   * never an error, the rail is not the place to report one.
   */
  const [rooms, setRooms] = useState<Array<{ id: string; name: string }> | null>(null)
  const [workspacesOpen, setWorkspacesOpen] = useState(true)
  // Transitions must not play while the saved state is being applied: the
  // restore happens in useLayoutEffect, before the browser ever paints the
  // default, so the rail simply appears the way its owner left it.
  useLayoutEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "true")
      setWorkspacesOpen(window.localStorage.getItem(WORKSPACES_OPEN_KEY) !== "false")
    } catch {
      // Blocked storage just means the rail starts open. Nothing to do.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = () =>
      void api
        .listWorkspaces()
        .then((page) => {
          if (!cancelled) setRooms(page.signInRequired ? [] : page.workspaces.map(({ id, name }) => ({ id, name })))
        })
        .catch(() => {
          if (!cancelled) setRooms([])
        })
    load()
    window.addEventListener(WORKSPACES_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(WORKSPACES_CHANGED_EVENT, load)
    }
  }, [])

  const handleWorkspacesOpenChange = (isCollapsed: boolean) => {
    setWorkspacesOpen(!isCollapsed)
    try {
      window.localStorage.setItem(WORKSPACES_OPEN_KEY, String(!isCollapsed))
    } catch {
      // Not remembering the fold is fine; refusing to fold would not be.
    }
  }

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
        {NAV_ITEMS.map((item) => {
          if (item.key === "start") {
            return (
              <SideNavItem
                key={item.key}
                label={item.label}
                href={item.href}
                icon={item.icon}
                isSelected={active === item.key}
                as={FullNavigationLink}
              />
            )
          }
          if (item.key === "workspaces" && rooms && rooms.length > 0) {
            // The file tree: rooms revealed right here, one click from
            // anywhere. The label still navigates to the overview (create,
            // invitations); the disclosure toggles the branch.
            return (
              <SideNavItem
                key={item.key}
                label={item.label}
                href={item.href}
                icon={item.icon}
                isSelected={active === item.key && !activeWorkspaceId}
                collapsible={{ isCollapsed: !workspacesOpen, onCollapsedChange: handleWorkspacesOpenChange }}
              >
                {rooms.map((room) => (
                  <SideNavItem
                    key={room.id}
                    label={room.name}
                    href={`/workspaces/${room.id}`}
                    icon={FolderGlyph}
                    isSelected={activeWorkspaceId === room.id}
                    size="sm"
                  />
                ))}
              </SideNavItem>
            )
          }
          return (
            <SideNavItem
              key={item.key}
              label={item.label}
              href={item.href}
              icon={item.icon}
              isSelected={active === item.key}
            />
          )
        })}
      </SideNavSection>
    </AstryxSideNav>
  )
}
