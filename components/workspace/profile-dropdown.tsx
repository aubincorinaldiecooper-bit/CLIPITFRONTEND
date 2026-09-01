"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Library, LogIn, LogOut, User } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { forgetApiSession } from "@/lib/api"
import { useWorkspaceSignInGate } from "@/components/workspace/sign-in-gate"

/**
 * Who you are, in the top-right corner — the account control as a profile
 * card: name, email, avatar, and the places that belong to you.
 *
 * It renders for a guest too. A guest-only deployment still has a corner, and
 * the corner is where you go looking for your account; showing nothing there
 * reads as a missing control rather than a supported setup. Signed out it
 * offers the same sign-in dialog every gated action uses, and only when
 * sign-in is configured.
 */

interface ProfileLink {
  label: string
  href: string
  icon: React.ReactNode
  value?: string
}

const LINKS: ProfileLink[] = [
  { label: "Library", href: "/clips", icon: <Library className="size-4" /> },
]

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "G"
}

export function ProfileDropdown() {
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
          className="flex max-w-[15rem] items-center gap-3 rounded-2xl border bg-card p-2 pr-2.5 text-left transition-colors hover:bg-shmuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : (
              initialsOf(name)
            )}
          </span>
          <span className="hidden min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden sm:flex">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="shadcn-scope w-64 rounded-2xl p-2">
        {user ? (
          <>
            {LINKS.map((link) => (
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
