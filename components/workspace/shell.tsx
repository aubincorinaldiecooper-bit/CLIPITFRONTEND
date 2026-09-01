"use client"

import Link from "next/link"
import { Library, Share2, Upload } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { Logo } from "@/components/brand/logo"
import { WorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
import { WorkspaceAccount } from "@/components/workspace/account"
import { ProfileDropdown } from "@/components/workspace/profile-dropdown"
import { NotchNav, type NotchItemData } from "@/components/ui/adaptive-notch-navigation-bar"

/**
 * The app's frame — every signed-in screen wears it.
 *
 * The rail is gone. The owner's call (2026-08-30): with Publishing now an
 * action on each clip in the library and Shared parked while its shape is
 * decided, navigation is two places — Upload and Library — and two places
 * live in the header, not a sidebar. The wordmark goes to Upload, which is
 * also what "home" now means: upload your footage, with an empty state.
 *
 * What the rail's other destinations became:
 * - Publishing: reached from any clip in the Library (the dialog lives
 *   there); the /publishing route still answers for old links.
 * - Shared and Rooms: hidden from navigation for now, deliberately not
 *   deleted — /shared, /shared/[id] and /join keep working, and invite
 *   links still land. When the owner settles Shared's shape it comes back.
 * - Home: the wordmark. /home redirects to /start.
 */

export type AppDestination = "home" | "start" | "clips" | "publishing" | "workspaces" | "join"

const NOTCH_ITEMS: NotchItemData[] = [
  { id: "upload", label: "Upload", icon: Upload, href: "/start" },
  { id: "library", label: "Library", icon: Library, href: "/clips" },
  { id: "publish", label: "Publish", icon: Share2, href: "/publishing" },
]

const NOTCH_LOGO = (
  <a href="/start" aria-label="Clipit — upload your footage" className="flex items-center gap-[7px] py-1.5 text-foreground hover:opacity-80">
    <Logo variant="mark" size={22} />
    <span className="hidden sm:inline">
      <Logo variant="wordmark" size={22} />
    </span>
  </a>
)

export function WorkspaceShell({
  active,
  children,
}: {
  active: AppDestination
  /** Accepted for compatibility with the Shared screens; unused since the
   *  rail (and its per-room highlight) left the frame. */
  activeWorkspaceId?: string
  children: React.ReactNode
}) {
  const notchEnabled = process.env.NEXT_PUBLIC_NOTCH_NAV === "1"

  const activeId =
    active === "start" || active === "home"
      ? "upload"
      : active === "clips"
        ? "library"
        : active === "publishing"
          ? "publish"
          : "upload"

  return (
    <div className="shadcn-scope flex min-h-dvh flex-col bg-background font-sans text-foreground">
      {/* One Tab from the top jumps past the header to the content, so a
          keyboard user is not made to walk the wordmark and every header
          control before reaching the page. */}
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>
      <WorkspaceSignInGate>
        {notchEnabled ? (
          <NotchNav
            items={NOTCH_ITEMS}
            activeId={activeId}
            logo={NOTCH_LOGO}
            rightCorner={<ProfileDropdown />}
          >
            <div id="workspace-content" tabIndex={-1} className="flex flex-1 flex-col gap-6 p-6">
              {children}
            </div>
            <Toaster />
          </NotchNav>
        ) : (
          <>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              {/* The wordmark IS home now: it lands on uploading footage. A full
                  navigation, so the start screen is genuinely fresh. */}
              <a href="/start" aria-label="Clipit — upload your footage" className="flex items-center gap-[7px] py-1.5">
                <Logo variant="mark" size={22} />
                <Logo variant="wordmark" size={22} />
              </a>

              <nav aria-label="Clipit" className="ml-auto flex items-center gap-1.5">
                <Link
                  href="/clips"
                  aria-current={active === "clips" ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active === "clips"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Library
                </Link>
                <a
                  href="/start"
                  aria-current={active === "start" ? "page" : undefined}
                  className="whitespace-nowrap rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Upload
                </a>
              </nav>
              <WorkspaceAccount />
            </header>
            <div id="workspace-content" tabIndex={-1} className="flex flex-1 flex-col gap-6 p-6">
              {children}
            </div>
            <Toaster />
          </>
        )}
      </WorkspaceSignInGate>
    </div>
  )
}
