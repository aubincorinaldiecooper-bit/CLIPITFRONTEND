"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Clock01Icon,
  Folder01Icon,
  FolderOpenIcon,
  InboxIcon,
  PlusSignIcon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons"
import { api, ApiError } from "@/lib/api"
import type { WorkspacesPage } from "@/lib/types"
import { personName, WORKSPACES_CHANGED_EVENT } from "@/components/side-nav"
import { WorkspaceShell } from "@/components/workspace/shell"
import {
  useAuthConfigured,
  useWorkspaceResumeIntent,
  useWorkspaceSignInGate,
} from "@/components/workspace/sign-in-gate"
import { StatusButton, type StatusButtonState } from "@/components/workspace/uselayouts/status-button"

/**
 * The Workspaces overview, on the shadcn/uselayouts pilot stack.
 *
 * Everything the Astryx version did, restated on the new furniture: the rooms
 * you share as a list of rows, creating a room with its first invitations in
 * the same breath, the honest per-address outcome of those invitations, and
 * the handoff of any invitation link that could not be emailed — those links
 * exist and work, and closing the dialog without handing them over would throw
 * them away.
 */

const CREATE_FORM_ID = "create-workspace-form"

function WorkspacesBody() {
  const [page, setPage] = useState<WorkspacesPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  /** One address per row; a blank row is there to type into from the start. */
  const [inviteEmails, setInviteEmails] = useState<string[]>([""])
  const [creating, setCreating] = useState<StatusButtonState>("idle")
  const [formError, setFormError] = useState<string | null>(null)
  /** Invitations that were created but could not be emailed — their links are
   *  live, and this dialog is the only place that can hand them over. */
  const [handoff, setHandoff] = useState<{
    workspace: { id: string; name: string }
    links: Array<{ email: string; url: string }>
  } | null>(null)
  const router = useRouter()
  const { requireSignIn, askToSignIn } = useWorkspaceSignInGate()
  const authConfigured = useAuthConfigured()

  /** Making a room is inviting people into it, so it needs a person. */
  const askToCreate = () =>
    requireSignIn({ action: "invite", workspaceId: "new" }, () => setCreateOpen(true))

  useWorkspaceResumeIntent(
    (intent) => intent.action === "invite" && intent.workspaceId === "new",
    () => setCreateOpen(true),
  )

  const load = () =>
    api
      .listWorkspaces()
      .then(setPage)
      .catch((cause) => {
        // A backend without this endpoint yet is "workspaces aren't switched
        // on here", not a loading failure.
        if (cause instanceof ApiError && cause.status === 404) {
          setPage({ signInRequired: false, workspaces: [] })
        } else {
          setFailed(true)
        }
      })

  useEffect(() => {
    void load()
    // Loaded once on mount; creation refreshes it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setName("")
    setInviteEmails([""])
    setCreating("idle")
  }

  /** Close the handoff and go to the workspace that was made. */
  const finishHandoff = () => {
    const target = handoff?.workspace.id
    setHandoff(null)
    setCreateOpen(false)
    resetForm()
    if (target) router.push(`/shared/${target}`)
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    // Blank rows are somebody who thought better of it; a duplicate address
    // is one invitation, not two.
    const addresses = [...new Set(inviteEmails.map((address) => address.trim()).filter(Boolean))]
    if (!trimmed || creating !== "idle") return
    setFormError(null)
    setCreating("loading")
    try {
      const { workspace } = await api.createWorkspace(trimmed)
      window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT))

      // Each invitation is its own step with its own honest outcome; one
      // failing must not stop the rest.
      const emailed: string[] = []
      const links: Array<{ email: string; url: string }> = []
      const refused: string[] = []

      for (const email of addresses) {
        try {
          const result = await api.inviteToWorkspace(workspace.id, email)
          if (result.emailed) {
            emailed.push(email)
          } else {
            links.push({ email, url: result.acceptUrl })
          }
        } catch {
          refused.push(email)
        }
      }

      // Say what happened to each one, never a single verdict that would
      // have to be wrong about somebody.
      if (refused.length > 0) {
        toast.error(
          `${workspace.name} created, but no invitation could be made for ${refused.join(", ")}.`,
        )
      } else if (emailed.length > 0 && links.length === 0) {
        toast.success(
          `${workspace.name} created — ${
            emailed.length === 1 ? `invitation sent to ${emailed[0]}` : `${emailed.length} invitations sent`
          }.`,
        )
      } else if (links.length === 0) {
        toast.success(`${workspace.name} created.`)
      }

      if (links.length > 0) {
        // The dialog stays open and hands the links over instead of closing.
        setHandoff({ workspace, links })
        return
      }

      setCreating("success")
      setTimeout(() => {
        setCreateOpen(false)
        resetForm()
        router.push(`/shared/${workspace.id}`)
      }, 650)
    } catch (cause) {
      setCreating("idle")
      setFormError(cause instanceof ApiError ? cause.message : "Couldn't create that room. Try again.")
    }
  }

  const header = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Shared</h1>
      <p className="text-sm text-muted-foreground">
        Rooms you share with other people. Your own clips live under Your clips.
      </p>
    </div>
  )

  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p className="text-sm text-destructive">Couldn&apos;t load your shared rooms. Refresh to try again.</p>
      </div>
    )
  }
  if (page === null) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {/* The same shape the rows will be, so nothing jumps when they land. */}
        <Skeleton className="h-[212px] w-full rounded-xl" />
      </div>
    )
  }
  if (page.signInRequired) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        {header}
        <Card className="flex flex-1 items-center justify-center border-dashed">
          <CardContent className="flex max-w-md flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-shmuted text-muted-foreground">
              <HugeiconsIcon icon={SquareLock01Icon} className="size-6" />
            </span>
            <h2 className="text-lg font-semibold">Your shared rooms are waiting</h2>
            <p className="text-sm text-muted-foreground">
              Workspaces belong to you, not to a browser tab.{" "}
              {authConfigured === false
                ? "Sign-in isn't switched on for this deployment yet."
                : "Sign in and yours will be here every time you come back."}
            </p>
            {/* Only where sign-in can actually work — on a guest-only
                deployment the button would open a form whose send must fail. */}
            {authConfigured && (
              <Button className="mt-2" onClick={askToSignIn}>
                Sign in
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // The personal room is deliberately excluded: it is the same place "Your
  // clips" opens, and listing it here made one room look like two.
  const shared = page.workspaces.filter((room) => !room.isPersonal)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {header}
        <Button onClick={askToCreate}>
          <HugeiconsIcon icon={PlusSignIcon} />
          Create a room
        </Button>
      </div>

      {shared.length > 0 ? (
        /* Rows, not cards — the shape this page had before the pilot, and what
           a list of places to go into wants: one line each, the whole row a
           real link so it can be opened in a new tab, middle-clicked and
           copied. The animated folder that stood here briefly was never asked
           for; it also drew three sheets of paper for a room holding nothing,
           and threw them over the heading above on hover. */
        <Card className="overflow-hidden py-0">
          <ul>
            {shared.map((room, index) => (
              <li key={room.id}>
                <Link
                  href={`/shared/${room.id}`}
                  className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-shaccent focus-visible:bg-shaccent focus-visible:outline-none ${
                    index > 0 ? "border-t border-shborder" : ""
                  }`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-shmuted text-muted-foreground">
                    <HugeiconsIcon icon={Folder01Icon} className="size-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {room.isOwner
                        ? room.name
                        : `${personName(room.ownerEmail) ?? "Shared"} · ${room.name}`}
                    </span>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {`${room.clipCount} ${room.clipCount === 1 ? "clip" : "clips"} · ` +
                        `${room.memberCount} ${room.memberCount === 1 ? "person" : "people"}` +
                        (room.isOwner ? " · yours" : "")}
                    </span>
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="ml-auto size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-shmuted text-muted-foreground">
              <HugeiconsIcon icon={FolderOpenIcon} className="size-6" />
            </span>
            <h2 className="text-lg font-semibold">No shared rooms yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create a room to share clips with other people. Invite them, send selected
              clips, and keep your own library separate.
            </p>
            <Button className="mt-2" onClick={askToCreate}>
              <HugeiconsIcon icon={PlusSignIcon} />
              Create a room
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Clock01Icon} className="size-4 text-muted-foreground" />
            Recent activity
          </CardTitle>
          <CardDescription>What happens in your shared rooms shows up here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-shmuted text-muted-foreground">
              <HugeiconsIcon icon={InboxIcon} className="size-5" />
            </span>
            <p className="text-sm font-medium">Nothing here yet.</p>
            <p className="text-sm text-muted-foreground">
              Activity from your shared rooms will appear here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Creating a room, and handing over links that could not be emailed,
          are two moments and two dialogs. */}
      <Dialog
        open={createOpen && !handoff}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="shadcn-scope sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a room</DialogTitle>
            <DialogDescription>Share clips with your team.</DialogDescription>
          </DialogHeader>
          <form id={CREATE_FORM_ID} onSubmit={create} className="flex flex-col gap-4">
            {formError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-name">Room name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Northside Films"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-invite-0">Invite someone (optional)</Label>
              {inviteEmails.map((address, index) => (
                <Input
                  key={index}
                  id={`ws-invite-${index}`}
                  type="email"
                  value={address}
                  onChange={(event) =>
                    setInviteEmails((current) =>
                      current.map((entry, position) => (position === index ? event.target.value : entry)),
                    )
                  }
                  placeholder="teammate@example.com"
                />
              ))}
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={inviteEmails.some((address) => address.trim() === "")}
                  onClick={() => setInviteEmails((current) => [...current, ""])}
                >
                  <HugeiconsIcon icon={PlusSignIcon} />
                  Add another
                </Button>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <StatusButton
              state={creating}
              idleLabel="Create a room"
              loadingLabel="Creating"
              successLabel="Created"
              type="submit"
              onClick={() => {
                const form = document.getElementById(CREATE_FORM_ID) as HTMLFormElement | null
                form?.requestSubmit()
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(handoff)}
        onOpenChange={(open) => {
          // Dismissing the handoff means "I have the links" — the workspace
          // was made either way, so go to it.
          if (!open) finishHandoff()
        }}
      >
        <DialogContent className="shadcn-scope sm:max-w-md">
          {handoff && (
            <>
              <DialogHeader>
                <DialogTitle>{handoff.workspace.name} is ready</DialogTitle>
                <DialogDescription>
                  {handoff.links.length === 1
                    ? `The invitation for ${handoff.links[0]!.email} couldn't be emailed.`
                    : `${handoff.links.length} invitations couldn't be emailed.`}{" "}
                  The invitations themselves are live — send these links on yourself. Each works
                  once and expires in seven days.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                {handoff.links.map((link) => (
                  <div key={link.email} className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">{link.email}</p>
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-md bg-shmuted px-2 py-1.5 font-mono text-xs">
                        {link.url}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (!navigator.clipboard) {
                            toast.error("Couldn't copy here — select the link and copy it.")
                            return
                          }
                          void navigator.clipboard
                            .writeText(link.url)
                            .then(() => toast.success(`Link for ${link.email} copied.`))
                            .catch(() => toast.error("Couldn't copy — select the link and copy it."))
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={finishHandoff}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function WorkspacesScreen() {
  return (
    <WorkspaceShell active="workspaces">
      <WorkspacesBody />
    </WorkspaceShell>
  )
}
