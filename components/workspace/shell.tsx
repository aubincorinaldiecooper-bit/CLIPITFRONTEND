"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Folder01Icon,
  Home01Icon,
  PodcastIcon,
  ScissorsIcon,
  UserGroupIcon,
  VideoReplayIcon,
} from "@hugeicons/core-free-icons"
import { Logo } from "@/components/brand/logo"
import { api } from "@/lib/api"
import { personName } from "@/components/side-nav"
import { WORKSPACES_CHANGED_EVENT } from "@/components/side-nav"
import { WorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
import { WorkspaceAccount } from "@/components/workspace/account"

/**
 * The frame for the WORKSPACE screens — the shadcn/uselayouts pilot, by the
 * owner's decision. Everything else in the app keeps the Astryx shell; these
 * routes get shadcn's own sidebar, header and light look, scoped under
 * .shadcn-scope so nothing leaks outward.
 *
 * The same five destinations as the Astryx rail, in the same order, with the
 * shared rooms listed under Workspaces — navigation does not change because
 * the furniture did. The account stays in the header's top-right, where the
 * owner has kept it.
 */

const DESTINATIONS = [
  { key: "home", label: "Home", href: "/home", icon: Home01Icon },
  { key: "start", label: "New clip", href: "/start", icon: ScissorsIcon },
  { key: "clips", label: "Your clips", href: "/clips", icon: VideoReplayIcon },
  { key: "publishing", label: "Publishing", href: "/publishing", icon: PodcastIcon },
  { key: "workspaces", label: "Shared", href: "/shared", icon: UserGroupIcon },
] as const

export function WorkspaceShell({
  active,
  activeWorkspaceId,
  children,
}: {
  active: "workspaces"
  activeWorkspaceId?: string
  children: React.ReactNode
}) {
  /** The shared rooms, for the sidebar's Workspaces group. Same rules as the
   *  Astryx rail: guests and failures settle on an empty list, never an
   *  error — the rail is not the place to report one. */
  const [rooms, setRooms] = useState<Array<{ id: string; label: string }>>([])

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

  return (
    <div className="shadcn-scope bg-background font-sans text-foreground">
      <WorkspaceSignInGate>
        <SidebarProvider>
          {/* collapsible="icon": the trigger folds the rail to an icon strip
              rather than sliding it away — the collapsed-but-present rail
              this product has used all along. */}
          <Sidebar collapsible="icon">
            <SidebarHeader>
              <Link
                href="/"
                aria-label="Clipit — home"
                className="flex items-center gap-[7px] overflow-hidden px-2 py-1.5 text-sidebar-foreground"
              >
                {/* Split lockup: in icon mode only the mark survives — the
                    full wordmark overflowed the 48px rail and sat on top of
                    the trigger, swallowing its clicks. */}
                <Logo variant="mark" size={22} />
                <span className="group-data-[collapsible=icon]:hidden">
                  <Logo variant="wordmark" size={22} />
                </span>
              </Link>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {DESTINATIONS.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild isActive={item.key === active}>
                          {/* New clip stays a full navigation: landing on
                              /start fresh is what resets the theater. */}
                          {item.key === "start" ? (
                            <a href={item.href}>
                              <HugeiconsIcon icon={item.icon} />
                              <span>{item.label}</span>
                            </a>
                          ) : (
                            <Link href={item.href}>
                              <HugeiconsIcon icon={item.icon} />
                              <span>{item.label}</span>
                            </Link>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              {rooms.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>Rooms</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {rooms.map((room) => (
                        <SidebarMenuItem key={room.id}>
                          <SidebarMenuButton asChild isActive={room.id === activeWorkspaceId}>
                            <Link href={`/shared/${room.id}`}>
                              <HugeiconsIcon icon={Folder01Icon} />
                              <span>{room.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <span className="ml-auto">
                <WorkspaceAccount />
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </WorkspaceSignInGate>
    </div>
  )
}
