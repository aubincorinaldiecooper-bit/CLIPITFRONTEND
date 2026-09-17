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
  "bg-[linear-gradient(135deg,#d8f6ff_0%,#a9e3ff_48%,#bfcbff_100%)] text-[#102033] shadow-[0_10px_30px_rgba(121,199,255,0.22)] hover:brightness-[0.985]"

export function SearchShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceSignInGate>
      <div
        className="shadcn-scope min-h-dvh w-full bg-[#f7fbff] text-[#111827]"
        data-testid="search-shell"
      >
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>

        <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)]">
          <aside className="hidden border-r border-[#e7eef6] bg-white/80 p-3 backdrop-blur-xl md:flex md:flex-col">
            <a href="/start" aria-label="Clipit — new chat" className="flex h-12 items-center px-2 text-foreground">
              <Logo size={19} />
            </a>

            <motion.a
              href="/start"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                primaryGradient,
                "mt-3 h-11 justify-start rounded-2xl border-0 px-3.5 font-medium",
              )}
            >
              <Plus className="size-4" />
              New chat
            </motion.a>

            <div className="mt-7 px-2">
              <p className="text-[11px] font-medium tracking-[0.12em] text-[#8a98a8] uppercase">Chats</p>
              <p className="mt-3 text-sm leading-relaxed text-[#8a98a8]">
                Your current search stays here while you explore its moments.
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-[#edf2f7] px-1 pt-3">
              <span className="text-xs text-[#91a0b1]">Clipit</span>
              <ProfileDropdown compact align="end" links={[]} />
            </div>
          </aside>

          <div className="flex min-w-0 flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e8eff6] bg-white/75 px-4 backdrop-blur-xl md:hidden">
              <a href="/start" aria-label="Clipit — new chat" className="text-foreground">
                <Logo variant="mark" size={22} />
              </a>
              <div className="flex items-center gap-2">
                <a
                  href="/start"
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    primaryGradient,
                    "rounded-full border-0 px-3",
                  )}
                >
                  <Plus className="size-3.5" />
                  New chat
                </a>
                <ProfileDropdown compact align="end" links={[]} />
              </div>
            </header>

            <main id="content" className="flex min-h-0 w-full flex-1 flex-col overflow-x-hidden">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </div>
    </WorkspaceSignInGate>
  )
}
