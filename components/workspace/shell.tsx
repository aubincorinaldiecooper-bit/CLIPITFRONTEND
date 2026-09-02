"use client"

import { Library, Upload } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { Logo } from "@/components/brand/logo"
import { WorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
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
  // A full navigation, as the wordmark's link is: the start screen must be
  // genuinely fresh, and a client-side hop to the page already showing
  // would keep the wizard where it was.
  { id: "upload", label: "Upload", icon: Upload, href: "/start", fullNavigation: true },
  { id: "library", label: "Library", icon: Library, href: "/clips" },
]

/**
 * Which notch item the page being shown belongs to. Pages the nav does not
 * list — Publishing, Shared, Join — select nothing: saying "you are on
 * Upload" there would be untrue.
 */
export function notchActiveId(active: AppDestination): string | null {
  if (active === "start" || active === "home") return "upload"
  if (active === "clips") return "library"
  return null
}

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
  const activeId = notchActiveId(active)

  return (
    <div className="shadcn-scope flex min-h-dvh flex-col bg-background font-sans text-foreground">
      {/* One Tab from the top jumps past the header to the content, so a
          keyboard user is not made to walk the wordmark and every header
          control before reaching the page. */}
      <a
        href="#workspace-content"
        // Above the notch header, later in the document, whose logo sits exactly
        // where this appears. Both stacking values come from the one scale in
        // app/globals.css, so the order is a fact stated once, not two numbers
        // that happen to agree.
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-(--z-skip-link) focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>
      <WorkspaceSignInGate>
        {/* The notch nav IS the header (owner, 2026-09-02). It sat behind a
            build-time switch that nothing set, so production showed a plain
            bar for a day while the real header waited in the code. */}
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
      </WorkspaceSignInGate>
    </div>
  )
}
