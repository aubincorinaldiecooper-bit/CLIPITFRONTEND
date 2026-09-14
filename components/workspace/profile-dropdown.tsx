"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LogIn, LogOut, User } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { forgetApiSession } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useWorkspaceSignInGate } from "@/components/workspace/sign-in-gate"

/**
 * Who you are in the app frame.
 *
 * `compact` lets the same account control live in the bottom of a collapsible
 * side rail: the avatar remains available while the rail is closed, and the
 * name/email return with the open rail. The menu behavior and auth flow are
 * unchanged.
 */

export interface ProfileLink {
  label: string
  href: string
  icon: React.ReactNode
  value?: string
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "G"
}

export interface ProfileDropdownProps {
  compact?: boolean
  /**
   * Destinations the menu carries, for everyone — signed in or not. Inside
   * the workspace rail there are none: the rail is the navigation, and the
   * menu stays about the account. The search shell has no rail (the owner,
   * 2026-09-14: the mark and the account, nothing else), so it hands the
   * menu the library and the shared rooms.
   */
  links?: ProfileLink[]
  /** Which edge of the button the menu lines up with: the rail's menu opens rightward, a header's right-hand one leftward. */
  align?: "start" | "end"
}

export function ProfileDropdown({ compact = false, links = [], align = "start" }: ProfileDropdownProps) {
  const { data: session, isPending } = authClient.useSession()
  const { askToSignIn } = useWorkspaceSignInGate()
  const [configured, setConfigured] = useState<boolean | null>(null)

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

  if (isPending || configured === null) return null

  const user = session?.user
  const name = user?.name?.trim() || (user ? "Your account" : "Guest")
  const email = user?.email ?? "Not signed in"
  const avatar = user?.image ?? null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={compact ? `${name} account menu` : undefined}
          className={cn(
            "flex items-center text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact
              ? "mx-auto justify-center rounded-full p-1 hover:bg-shmuted"
              : "w-full gap-3 rounded-2xl border bg-card p-2 pr-2.5 hover:bg-shmuted",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : (
              initialsOf(name)
            )}
          </span>
          {!compact && (
            <span className="min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden sm:flex">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} sideOffset={6} className="shadcn-scope w-64 rounded-2xl p-2">
        {links.length > 0 && (
          <>
            {links.map((link) => (
              <DropdownMenuItem asChild key={link.label}>
                <Link href={link.href} className="cursor-pointer rounded-xl p-3">
                  {link.icon}
                  <span className="whitespace-nowrap text-sm font-medium">{link.label}</span>
                  {link.value ? (
                    <span className="ml-auto rounded-md border bg-shmuted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {link.value}
                    </span>
                  ) : null}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="my-2" />
          </>
        )}
        {user ? (
          <>
            <DropdownMenuItem
              className="cursor-pointer rounded-xl p-3 text-destructive focus:text-destructive"
              onClick={() => {
                void authClient.signOut().finally(() => {
                  forgetApiSession()
                  window.location.assign("/start")
                })
              }}
            >
              <LogOut className="size-4" />
              <span className="whitespace-nowrap text-sm font-medium">Sign out</span>
            </DropdownMenuItem>
          </>
        ) : configured ? (
          <DropdownMenuItem className="cursor-pointer rounded-xl p-3" onClick={askToSignIn}>
            <LogIn className="size-4" />
            <span className="whitespace-nowrap text-sm font-medium">Sign in</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="rounded-xl p-3">
            <User className="size-4" />
            <span className="whitespace-nowrap text-sm font-medium">Sign-in is off here</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
