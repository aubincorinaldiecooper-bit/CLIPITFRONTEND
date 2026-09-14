"use client"

import { Film, Plus, Users } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { buttonVariants } from "@/components/space/button"
import { Toaster } from "@/components/ui/sonner"
import { ProfileDropdown, type ProfileLink } from "@/components/workspace/profile-dropdown"
import { WorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
import { cn } from "@/lib/utils"

/**
 * The search screens' shell — the almost-invisible one from the owner's
 * prototype (2026-09-14): the mark on the left, New search and the account
 * on the right, and nothing else.
 *
 * No side rail. Inside the workspace rail every search screen read as a
 * SaaS workspace with a results component dropped into it (the owner,
 * 2026-09-14); the product these screens are is a video search, and a
 * search has a header. The library and the shared rooms keep the rail —
 * they are what they were — and are reached from the account menu here,
 * not from links in the header (the owner, 2026-09-14).
 *
 * On a phone the header is the mark and the account, nothing more: the
 * word beside the mark goes, and so does New search — the box to type the
 * next question into is already on the screen, and a second way to the
 * same thing contradicts it (the owner, 2026-09-14).
 *
 * The sign-in gate is the workspace's own, so publishing and signing in
 * behave here exactly as they do there. The report dock does not come
 * along: a floating control over the footage is not part of the picture.
 */

/** Where the account menu can take you from here. */
const DESTINATIONS: ProfileLink[] = [
  { label: "Library", href: "/clips", icon: <Film className="size-4" /> },
  { label: "Shared", href: "/shared", icon: <Users className="size-4" /> },
]

export function SearchShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceSignInGate>
      <div className="shadcn-scope flex min-h-dvh w-full flex-col bg-background text-foreground" data-testid="search-shell">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-shcard focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-7">
          {/* A full navigation, as the rail's New search was: it resets the
              page, so a search in progress is left rather than carried. */}
          <a href="/start" aria-label="Clipit — new search" className="shrink-0 text-foreground">
            <span className="max-[860px]:hidden">
              <Logo size={19} />
            </span>
            <span className="hidden max-[860px]:inline-flex">
              <Logo variant="mark" size={22} />
            </span>
          </a>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a href="/start" className={cn(buttonVariants({ variant: "default", size: "lg" }), "rounded-full px-4 max-[860px]:hidden")}>
              <Plus className="size-[15px]" />
              New search
            </a>
            <ProfileDropdown compact align="end" links={DESTINATIONS} />
          </div>
        </header>
        <main id="content" className="flex w-full flex-1 flex-col">
          {children}
        </main>
        <Toaster />
      </div>
    </WorkspaceSignInGate>
  )
}
