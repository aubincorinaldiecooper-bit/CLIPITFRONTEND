"use client"

import { useEffect, useLayoutEffect, useState, type ComponentProps, type SVGProps } from "react"
import {
  SideNav as AstryxSideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav"
import { Logo } from "@/components/brand/logo"
import { ProfileDropdown } from "@/components/workspace/profile-dropdown"
import { api } from "@/lib/api"

/**
 * Clipit's primary navigation for the conversational workspace.
 *
 * The product now starts with a question and treats video as context, so the
 * navigation is deliberately small: start a fresh search, revisit produced
 * clips, or open shared rooms. Publishing stays attached to a moment/clip and
 * is not duplicated as a top-level destination.
 */

const COLLAPSED_KEY = "clipit.nav.collapsed"

export function personName(email: string | null | undefined): string | null {
  if (!email) return null
  const local = email.split("@")[0]?.trim()
  return local ? local : null
}

const WORKSPACES_OPEN_KEY = "clipit.nav.workspaces.open"
export const WORKSPACES_CHANGED_EVENT = "clipit:workspaces-changed"

export type NavDestination = "home" | "start" | "clips" | "publishing" | "workspaces"

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

const SearchGlyph = (props: SVGProps<SVGSVGElement>) => (
  <NavGlyph {...props}>
    <path d="M12 5v14M5 12h14" />
  </NavGlyph>
)

const LibraryGlyph = (props: SVGProps<SVGSVGElement>) => (
  <NavGlyph {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4" />
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
  { key: "start", label: "New search", href: "/start", icon: SearchGlyph },
  { key: "clips", label: "Library", href: "/clips", icon: LibraryGlyph },
  { key: "workspaces", label: "Shared", href: "/shared", icon: TeamGlyph },
]

const FullNavigationLink = (props: ComponentProps<"a">) => <a {...props} />

export function SideNav({
  active,
  activeWorkspaceId,
}: {
  active: NavDestination
  activeWorkspaceId?: string
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; label: string }> | null>(null)
  const [workspacesOpen, setWorkspacesOpen] = useState(true)

  useLayoutEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "true")
      setWorkspacesOpen(window.localStorage.getItem(WORKSPACES_OPEN_KEY) !== "false")
    } catch {
      // Storage is optional; the rail simply starts open when unavailable.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = () =>
      void api
        .listWorkspaces()
        .then((page) => {
          if (cancelled) return
          setRooms(
            page.signInRequired
              ? []
              : page.workspaces
                  .filter((room) => !room.isPersonal)
                  .map(({ id, name, isOwner, ownerEmail }) => ({
                    id,
                    name,
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
      // Remembering the fold is a convenience, not a requirement.
    }
  }

  const handleCollapsedChange = (next: boolean) => {
    setCollapsed(next)
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(next))
    } catch {
      // The navigation still works without persisted UI preference.
    }
  }

  return (
    <AstryxSideNav
      className={collapsed ? undefined : "w-[var(--rail-open-width)]"}
      collapsible={{ isCollapsed: collapsed, onCollapsedChange: handleCollapsedChange }}
      header={
        <SideNavHeading
          icon={<Logo variant="mark" size={22} />}
          heading="Clipit"
          headingHref="/start"
        />
      }
      footer={<ProfileDropdown compact={collapsed} />}
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
                isSelected={active === item.key || active === "home"}
                as={FullNavigationLink}
              />
            )
          }
          if (item.key === "workspaces" && rooms && rooms.length > 0) {
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
                    href={`/shared/${room.id}`}
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
