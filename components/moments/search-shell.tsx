"use client"

import { Plus } from "lucide-react"
import { motion } from "motion/react"
import { Logo } from "@/components/brand/logo"
import { buttonVariants } from "@/components/space/button"
import { Toaster } from "@/components/ui/sonner"
import { ProfileDropdown } from "@/components/workspace/profile-dropdown"
import { WorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
import { cn } from "@/lib/utils"

const primaryGradient =
  "bg-[linear-gradient(135deg,#d8f6ff_0%,#a9e3ff_48%,#bfcbff_100%)] text-[#102033] shadow-[0_6px_18px_rgba(121,199,255,0.18)] hover:brightness-[0.985]"

export function SearchShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceSignInGate>
      <div className="shadcn-scope min-h-dvh w-full bg-white text-[#111827]" data-testid="search-shell">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-30 flex h-14 w-full items-center border-b border-[#eef0f2] bg-white/92 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <a href="/start" aria-label="Clipit — new chat" className="flex shrink-0 items-center text-foreground">
              <Logo size={18} className="max-[860px]:hidden" />
              <Logo variant="mark" size={18} className="hidden max-[860px]:inline-flex" />
            </a>

            <motion.a
              href="/start"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                primaryGradient,
                "h-8 rounded-xl border-0 px-3 text-[13px] font-medium max-[860px]:hidden",
              )}
            >
              <Plus className="size-3.5" />
              New chat
            </motion.a>
          </div>

          <div className="ml-auto flex w-12 shrink-0 items-center justify-end" data-testid="account-slot">
            <ProfileDropdown compact align="end" links={[]} />
          </div>
        </header>

        <main id="content" className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col overflow-x-hidden">
          {children}
        </main>

        <Toaster />
      </div>
    </WorkspaceSignInGate>
  )
}
