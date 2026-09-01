"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HugeiconsIcon } from "@hugeicons/react"
import { Logout01Icon } from "@hugeicons/core-free-icons"
import { authClient } from "@/lib/auth-client"
import { forgetApiSession } from "@/lib/api"
import { useWorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
import { cn } from "@/lib/utils"

/**
 * Who you are, in the workspace header — the pilot's version of
 * components/account-control.tsx, on shadcn primitives.
 *
 * Same decisions, restated rather than re-decided:
 * - Where sign-in is not configured, this renders nothing: a guest-only
 *   deployment is a supported setup, not one with a broken button.
 * - Nothing renders until both answers are in, so "Sign in" never flashes at
 *   somebody who is signed in.
 * - Signing out forgets the API session too, then lands on /start.
 *
 * Signed out it offers one button that opens the same sign-in dialog every
 * gated action here uses — one dialog, not two ways to sign in.
 */
export function WorkspaceAccount({ variant = "default" }: { variant?: "default" | "notch" } = {}) {
  const { data: session, isPending } = authClient.useSession()
  const { askToSignIn } = useWorkspaceSignInGate()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const isNotch = variant === "notch"

  useEffect(() => {
    let cancelled = false
    void fetch("/api/auth-configured")
      .then((response) => response.json() as Promise<{ configured: boolean }>)
      .then((body) => {
        if (!cancelled) setConfigured(body.configured)
      })
      .catch(() => {
        if (!cancelled) setConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!configured || isPending) return null

  if (!session?.user) {
    return (
      <Button
        variant={isNotch ? "ghost" : "secondary"}
        size="sm"
        onClick={askToSignIn}
        className={isNotch ? "text-white/90 hover:bg-white/10 hover:text-white" : undefined}
      >
        Sign in
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("max-w-[16rem]", isNotch && "text-white/80 hover:bg-white/10 hover:text-white")}
        >
          <span className="truncate">{session.user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="shadcn-scope">
        <DropdownMenuLabel className="max-w-[16rem] truncate font-normal text-muted-foreground">
          {session.user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void authClient.signOut().finally(() => {
              forgetApiSession()
              window.location.assign("/start")
            })
          }}
        >
          <HugeiconsIcon icon={Logout01Icon} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
