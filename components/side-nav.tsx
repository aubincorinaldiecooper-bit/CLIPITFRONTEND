"use client"

import { useEffect, useLayoutEffect, useState, type ComponentProps, type SVGProps } from "react"
import {
  SideNav as AstryxSideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav"
import { Logo } from "@/components/brand/logo"
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
/**
 * A person's name from their address. Not clever — the part before the @ is
 * what people recognise each other by in a small team, and it is the only
 * name this app is ever given.
 */
export function personName(email: string | null | undefined): string | null {
  if (!email) return null
  const local = email.split("@")[0]?.trim()
  return local ? local : null
}

const WORKSPACES_OPEN_KEY = "clipit.nav.workspaces.open"

/**
 * Fired by any page that changes which rooms exist for this person —
 * creating one, accepting an invitation, leaving. The rail listens and
 * refetches, so the tree is never a stale list of doors.
 */
export const WORKSPACES_CHANGED_EVENT = "clipit:workspaces-changed"

export type NavDestination = "home" | "start" | "clips" | "publishing" | "workspaces"

/**
 * The frame every rail glyph is drawn in.
 *
 * The size lives here, once, as a token-backed utility rather than pixels on
 * each icon. It has to: Astryx's SideNavItem hands its icon a fixed "sm"
 * (16px) treatment with no prop or theme hook to change it — verified by
 * measuring lg/md/sm items, all of which render a 16px icon — so the glyph
 * drops Astryx's own size class and wears its own instead of fighting it.
 * Colour still comes from the row, through `currentColor`.
 */
function NavGlyph({
  size = "nav",
  children,
  className: _astryxSizeClass,
  ...props
}: SVGProps<SVGSVGElement> & { size?: "nav" | "tree" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
      className={size === "tree" ? "size-5 shrink-0" : "size-6 shrink-0"}
    >
      {children}
    </svg>
  )
}

const HomeGlyph = (props: SVGProps<SVGSVGElement>) => (
  <NavGlyph {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </NavGlyph>
)

const ScissorsGlyph = (props: SVGProps<SVGSVGElement>) => (
  <NavGlyph {...props}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </NavGlyph>
)

const LibraryGlyph = (props: SVGProps<SVGSVGElement>) => (
  <NavGlyph {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4" />
  </NavGlyph>
)

const BroadcastGlyph = (props: SVGProps<SVGSVGElement>) => (
  <NavGlyph {...props}>
    <circle cx="12" cy="12" r="2" />
    <path d="M7.76 16.24a6 6 0 0 1 0-8.48M16.24 7.76a6 6 0 0 1 0 8.48M4.93 19.07a10 10 0 0 1 0-14.14M19.07 4.93a10 10 0 0 1 0 14.14" />
  </NavGlyph>
)

const TeamGlyph = (props: SVGProps<SVGSVGElement>) => (
  <NavGlyph {...props}>
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.38M15.6 5.2a3.2 3.2 0 0 1 0 5.6" />
  </NavGlyph>
)

const FolderGlyph = (props: SVGProps<SVGSVGElement>) => (
  <NavGlyph size="tree" {...props}>
    <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.2l2 2.4H19a1.5 1.5 0 0 1 1.5 1.5v9.1A1.5 1.5 0 0 1 19 19.5H5a1.5 1.5 0 0 1-1.5-1.5V6.5Z" />
  </NavGlyph>
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
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; label: string }> | null>(null)
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
          if (cancelled) return
          // The personal workspace is deliberately NOT listed here. It is the
          // same room "Your clips" already links to, and showing one place
          // twice under two names — once as a page, once as a room — was the
          // thing that made the rail confusing. Workspaces means the rooms
          // you share with other people.
          setRooms(
            page.signInRequired
              ? []
              : page.workspaces
                  .filter((room) => !room.isPersonal)
                  .map(({ id, name, isOwner, ownerEmail }) => ({
                    id,
                    name,
                    // A room someone invited you to reads as theirs.
                    label: isOwner ? name : `${personName(ownerEmail) ?? "Shared"} · ${name}`,
                  })),
          )
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
      // The open rail's width, from the theme's --rail-open-width token,
      // applied ONLY while the rail is open. Not a side-nav override in the
      // theme: a component override applies in the collapsed state too, and
      // since Astryx collapses by narrowing, pinning the width there froze
      // the fold — the chevron stored its preference and the rail never
      // moved. Collapsed leaves width to the component, exactly as its own
      // resizable mode does.
      className={collapsed ? undefined : "w-[var(--rail-open-width)]"}
      collapsible={{ isCollapsed: collapsed, onCollapsedChange: handleCollapsedChange }}
      // No footer. The account was briefly moved down here to anchor the
      // rail's empty lower half; that was not asked for, and it put the
      // address and Sign out in the bottom corner in small type. It lives in
      // the header, where the owner put it.
      header={
        // The mark rides Astryx's own icon slot and the word its heading slot,
        // so the rail keeps the component's spacing and collapse behaviour
        // rather than a hand-built header sitting where one should be.
        <SideNavHeading
          icon={<Logo variant="mark" size={22} />}
          heading="Clipit"
          headingHref="/"
        />
      }
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
                    label={room.label}
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
