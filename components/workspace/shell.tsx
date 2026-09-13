"use client"

import { AppShell } from "@astryxdesign/core/AppShell"
import { Toaster } from "@/components/ui/sonner"
import { SideNav, type NavDestination } from "@/components/side-nav"
import { WorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
import { ReportDock } from "@/components/workspace/report-dock"

/**
 * The workspace frame for Clipit's conversational UI.
 *
 * The product now uses a persistent side rail rather than a floating header:
 * video is context, while the conversation owns the main canvas. AppShell
 * provides the responsive mobile drawer and the page's main/skip landmarks;
 * the existing Clipit SideNav provides the actual destinations and collapse
 * behavior.
 */

export type AppDestination = "home" | "start" | "clips" | "publishing" | "workspaces" | "join"

/**
 * Retained as a compatibility helper for older tests/imports while the notch
 * header is no longer rendered by the workspace shell.
 */
export function notchActiveId(active: AppDestination): string | null {
  if (active === "start" || active === "home") return "upload"
  if (active === "clips") return "library"
  return null
}

function navDestination(active: AppDestination): NavDestination {
  if (active === "join") return "workspaces"
  return active
}

export function WorkspaceShell({
  active,
  activeWorkspaceId,
  children,
}: {
  active: AppDestination
  activeWorkspaceId?: string
  children: React.ReactNode
}) {
  return (
    <WorkspaceSignInGate>
      <AppShell
        contentPadding={0}
        height="fill"
        variant="section"
        sideNav={<SideNav active={navDestination(active)} activeWorkspaceId={activeWorkspaceId} />}
      >
        <section className="shadcn-scope flex min-h-full w-full flex-col bg-background p-6 text-foreground">
          {children}
        </section>
        <Toaster />
        <ReportDock />
      </AppShell>
    </WorkspaceSignInGate>
  )
}
