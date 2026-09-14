"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { buttonVariants } from "@/components/space/button"
import { Toaster } from "@/components/ui/sonner"
import { ProfileDropdown } from "@/components/workspace/profile-dropdown"
import { WorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
import { cn } from "@/lib/utils"

/**
 * The search screens' shell — the almost-invisible one from the owner's
 * prototype (2026-09-14): the mark and two quiet links on the left, New
 * search and the account on the right, and nothing else.
 *
 * No side rail. Inside the workspace rail every search screen read as a
 * SaaS workspace with a results component dropped into it (the owner,
 * 2026-09-14); the product these screens are is a video search, and a
 * search has a header. The library and the shared rooms keep the rail —
 * they are what they were — and are one quiet link away from here.
 *
 * The sign-in gate is the workspace's own, so publishing and signing in
 * behave here exactly as they do there. The report dock does not come
 * along: a floating control over the footage is not part of the picture.
 */
export function SearchShell({ children }: { children: React.ReactNode }) {
  const quiet = cn(buttonVariants({ variant: "ghost", size: "lg" }), "rounded-full px-3 font-normal text-muted-foreground hover:text-foreground")
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
          <div className="flex min-w-0 items-center gap-1 sm:gap-4">
            {/* A full navigation, as the rail's New search was: it resets the
                page, so a search in progress is left rather than carried. */}
            <a href="/start" aria-label="Clipit — new search" className="mr-1 shrink-0 text-foreground">
              <Logo size={19} />
            </a>
            <nav aria-label="Clipit" className="flex items-center">
              <Link href="/clips" className={quiet}>
                Library
              </Link>
              <Link href="/shared" className={quiet}>
                Shared
              </Link>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a href="/start" className={cn(buttonVariants({ variant: "default", size: "lg" }), "rounded-full px-3 sm:px-4")}>
              <Plus className="size-[15px]" />
              <span className="max-sm:sr-only">New search</span>
            </a>
            <ProfileDropdown compact />
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
