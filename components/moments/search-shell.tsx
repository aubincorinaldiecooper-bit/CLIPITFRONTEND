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
  "bg-[linear-gradient(135deg,#d8f6ff_0%,#a9e3ff_48%,#bfcbff_100%)] text-[#102033] shadow-[0_8px_24px_rgba(121,199,255,0.20)] hover:brightness-[0.985]"

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

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#edf1f5] bg-white/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <a href="/start" aria-label="Clipit home" className="flex items-center text-foreground">
              <Logo size={19} />
            </a>
            <motion.a
              href="/start"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                primaryGradient,
                "h-9 rounded-xl border-0 px-3 font-medium",
              )}
            >
              <Plus className="size-3.5" />
              New chat
            </motion.a>
          </div>

          <ProfileDropdown compact align="end" links={[]} />
        </header>

        <main id="content" className="flex min-h-[calc(100dvh-4rem)] w-full flex-col overflow-x-hidden">
          {children}
        </main>

        <Toaster />
      </div>
    </WorkspaceSignInGate>
  )
}
