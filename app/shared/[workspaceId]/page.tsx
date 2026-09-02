"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  FolderOpenIcon,
  SquareLock01Icon,
  UserAdd01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { api, ApiError } from "@/lib/api"
import type { WorkspaceDetail } from "@/lib/types"
import { WORKSPACES_CHANGED_EVENT } from "@/components/side-nav"
import { ClipCard, ClipViewer, type ClipAction } from "@/components/clip-card"
import { WorkspaceShell } from "@/components/workspace/shell"
import { useAuthConfigured, useWorkspaceSignInGate } from "@/components/workspace/sign-in-gate"
import { StatusButton, type StatusButtonState } from "@/components/workspace/uselayouts/status-button"
import { ConfirmDeleteButton } from "@/components/workspace/uselayouts/confirm-delete-button"

/**
 * One workspace, on the shadcn/uselayouts pilot stack.
 *
 * The room exists for its clips, so the clips ARE the page. Administration —
 * who is here, inviting, pending invitations, leaving — stays in two small
 * header controls (People, Invite), each a popover, exactly as before. The
 * clip cards themselves are unchanged: they carry the video, and video is the
 * one carve-out every stack decision has kept.
 *
 * Destructive actions wear uselayouts' two-press confirm: the first press
 * arms, the second removes, and an armed button disarms itself. Nobody loses
 * a teammate to a stray click.
 */

function WorkspaceBody({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = useState<WorkspaceDetail | null>(null)
  const [failed, setFailed] = useState<"missing" | "signin" | "error" | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [inviting, setInviting] = useState<StatusButtonState>("idle")
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  /** A link to pass on by hand when no email could be sent. */
  const [linkToShare, setLinkToShare] = useState<{ email: string; url: string } | null>(null)
  const router = useRouter()
  const { askToSignIn } = useWorkspaceSignInGate()
  const authConfigured = useAuthConfigured()

  const load = () =>
    api
      .getWorkspace(workspaceId)
      .then(setPage)
      .catch((cause) => {
        if (cause instanceof ApiError && cause.status === 404) setFailed("missing")
        // Signed out: telling someone to refresh would be a lie — no number
        // of refreshes signs them in.
        else if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) setFailed("signin")
        else setFailed("error")
      })

  /**
   * Refresh AFTER an action that already succeeded. A blip here must not
   * replace the page with a failure screen — the action worked, and the page
   * may be holding something unrecoverable (the one-time invite link shown
   * when email couldn't be sent). Keep what's on screen and say so.
   */
  const refresh = () =>
    api
      .getWorkspace(workspaceId)
      .then(setPage)
      .catch(() => {
        toast.error("Couldn't refresh the room — showing the last loaded view.")
      })

  useEffect(() => {
    void load()
    // Loaded once per room; every mutation below refreshes it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  /* Your own room and "Your clips" are one place, so a kept URL for it lands
     on the page that place actually has. Fired from here rather than during
     render: React is free to run a render twice, and a navigation is a side
     effect, not a rendering. */
  useEffect(() => {
    if (page?.workspace.isPersonal) router.replace("/clips")
  }, [page, router])

  const invite = async (event: React.FormEvent) => {
    event.preventDefault()
    const address = email.trim()
    if (!address || inviting !== "idle") return
    setFormError(null)
    setInviting("loading")
    try {
      const result = await api.inviteToWorkspace(workspaceId, address)
      setEmail("")
      if (result.emailed) {
        toast.success(`Invitation sent to ${address}.`)
        setLinkToShare(null)
        setInviting("success")
      } else {
        // Never claim an email arrived that did not.
        toast.error(
          result.emailProblem === "email_domain_unverified"
            ? "The invitation exists, but email could not be sent — the sending domain isn't verified yet."
            : "The invitation exists, but the email could not be sent. Pass the link on instead.",
        )
        setLinkToShare({ email: address, url: result.acceptUrl })
        setInviting("idle")
      }
      await refresh()
      setTimeout(() => setInviting("idle"), 1200)
    } catch (cause) {
      setInviting("idle")
      setFormError(cause instanceof ApiError ? cause.message : "Couldn't send that invitation. Try again.")
    }
  }

  const takeOut = async (clipId: string) => {
    setBusyId(clipId)
    try {
      await api.removeClipFromWorkspace(workspaceId, clipId)
      toast.success("Taken out of this room. The clip itself is untouched.")
      // Drop the card in place rather than refetching: a refetch re-signs
      // every clip's URL, which restarts whatever video is playing.
      setPage((current) =>
        current ? { ...current, clips: current.clips.filter((clip) => clip.id !== clipId) } : current,
      )
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Couldn't take that clip out.")
    } finally {
      setBusyId(null)
    }
  }

  const withdraw = async (inviteId: string) => {
    setBusyId(inviteId)
    try {
      await api.revokeInvite(workspaceId, inviteId)
      await refresh()
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Couldn't withdraw that invitation.")
    } finally {
      setBusyId(null)
    }
  }

  const removePerson = async (userId: string, label: string) => {
    setBusyId(userId)
    try {
      await api.removeWorkspaceMember(workspaceId, userId)
      toast.success(`${label} no longer has access.`)
      await refresh()
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Couldn't remove that person.")
    } finally {
      setBusyId(null)
    }
  }

  const leave = async () => {
    setBusyId("leave")
    try {
      await api.leaveWorkspace(workspaceId)
      window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT))
      router.push("/shared")
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Couldn't leave this room.")
      setBusyId(null)
    }
  }

  if (failed === "missing") {
    return (
      <p className="text-sm text-muted-foreground">
        This workspace doesn&apos;t exist, or you&apos;re not in it. Sign in (top right) if you haven&apos;t.
      </p>
    )
  }
  if (failed === "signin") {
    return (
      <Card className="flex flex-1 items-center justify-center border-dashed">
        <CardContent className="flex max-w-md flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-shmuted text-muted-foreground">
            <HugeiconsIcon icon={SquareLock01Icon} className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">This room is waiting</h2>
          <p className="text-sm text-muted-foreground">
            Workspaces belong to you, not to a browser tab.{" "}
            {authConfigured === false
              ? "Sign-in isn't switched on for this deployment yet."
              : "Sign in and this page will open."}
          </p>
          {authConfigured && (
            <Button className="mt-2" onClick={askToSignIn}>
              Sign in
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }
  if (failed === "error") {
    return <p className="text-sm text-destructive">Couldn&apos;t load this room. Refresh to try again.</p>
  }
  if (page === null) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="aspect-video rounded-xl" />
          <Skeleton className="aspect-video rounded-xl" />
          <Skeleton className="aspect-video rounded-xl" />
        </div>
      </div>
    )
  }

  // The personal room and "Your clips" are one place; a kept URL lands on the
  // page that place actually has. Rendering still shows the skeleton — the
  // navigation itself is fired from the effect above, because React is free to
  // run a render twice and a redirect is not something to do during one.
  if (page.workspace.isPersonal) {
    return <Skeleton className="h-40 w-full rounded-xl" />
  }

  const { isOwner } = page.workspace

  const openClip = page?.clips.find((clip) => clip.id === openId) ?? null

  /** The card's menu and the viewer's row: Download, and Take out. */
  const roomActions = (clip: NonNullable<typeof page>["clips"][number]): ClipAction[] => [
    ...(clip.downloadUrl ? [{ label: "Download", href: clip.downloadUrl }] : []),
    // "Take out" removes a SHARE — the clip itself is untouched, so a plain
    // action is honest; the two-press confirm is reserved for taking away
    // people.
    {
      label: busyId === clip.id ? "Taking out…" : "Take out",
      disabled: busyId === clip.id,
      onClick: () => void takeOut(clip.id),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{page.workspace.name}</h1>
          <p className="text-sm text-muted-foreground">Clips people have sent here.</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm">
                <HugeiconsIcon icon={UserGroupIcon} />
                People · {page.members.length}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="shadcn-scope w-[340px]">
              <div className="flex flex-col gap-1">
                {page.members.map((member, index) => (
                  <div key={member.userId} className="flex flex-col">
                    {index > 0 && <Separator className="my-1" />}
                    <div className="flex items-center justify-between gap-3 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{member.email ?? "Teammate"}</p>
                        <p className="text-xs text-muted-foreground">
                          {(member.role === "owner" ? "Owner" : "Member") +
                            (member.isYou ? " — that's you" : "")}
                        </p>
                      </div>
                      {isOwner && !member.isYou ? (
                        <ConfirmDeleteButton
                          id={`remove-${member.userId}`}
                          label="Remove"
                          confirmLabel="Confirm"
                          busyLabel="Removing…"
                          busy={busyId === member.userId}
                          onConfirm={() => void removePerson(member.userId, member.email ?? "That person")}
                        />
                      ) : member.isYou && !isOwner ? (
                        <ConfirmDeleteButton
                          id="leave"
                          label="Leave"
                          confirmLabel="Confirm"
                          busyLabel="Leaving…"
                          busy={busyId === "leave"}
                          onConfirm={() => void leave()}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {isOwner && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm">
                  <HugeiconsIcon icon={UserAdd01Icon} />
                  Invite
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="shadcn-scope w-[340px]">
                <form onSubmit={invite} className="flex flex-col gap-2">
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="teammate@example.com"
                    aria-label="Email address"
                    autoFocus
                  />
                  <StatusButton
                    state={inviting}
                    idleLabel="Send invitation"
                    loadingLabel="Sending"
                    successLabel="Sent"
                    type="submit"
                    className="h-9 min-w-[120px] text-sm"
                  />
                </form>
                <div className="mt-2 flex flex-col gap-2">
                  {formError ? (
                    <p className="text-xs text-destructive">{formError}</p>
                  ) : linkToShare ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-amber-600">
                        Email couldn&apos;t be sent — pass this link to {linkToShare.email}:
                      </p>
                      <p className="select-all overflow-x-auto whitespace-nowrap rounded-md bg-shmuted px-2 py-1.5 font-mono text-xs">
                        {linkToShare.url}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      The link works once and expires in seven days. Everyone here sees the clips
                      sent to this workspace.
                    </p>
                  )}
                  {page.invites.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium">Waiting to be accepted</p>
                      {page.invites.map((pending) => (
                        <div key={pending.id} className="flex items-center justify-between gap-3 py-1">
                          <div className="min-w-0">
                            <p className="truncate text-sm">{pending.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Invited {new Date(pending.invitedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === pending.id}
                            onClick={() => void withdraw(pending.id)}
                          >
                            Withdraw
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {page.hasMoreClips && (
        <p className="text-sm text-muted-foreground">Showing the newest 60 clips sent here.</p>
      )}

      {page.clips.length === 0 ? (
        <Card className="flex flex-1 items-center justify-center border-dashed">
          <CardContent className="flex max-w-md flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-shmuted text-muted-foreground">
              <HugeiconsIcon icon={FolderOpenIcon} className="size-6" />
            </span>
            <h2 className="text-lg font-semibold">Nothing sent here yet</h2>
            <p className="text-sm text-muted-foreground">
              In Your clips, every ready clip has a &quot;Send to a room&quot; option — what you
              send lands here for everyone in the workspace.
            </p>
            <Button variant="secondary" className="mt-2" onClick={() => router.push("/clips")}>
              Open Your clips
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {page.clips.map((clip) => (
            <ClipCard
              surface="light"
              key={clip.id}
              clip={clip}
              onOpen={() => setOpenId(clip.id)}
              actions={roomActions(clip)}
            />
          ))}
        </div>
      )}
      <ClipViewer
        clip={openClip}
        onClose={() => setOpenId(null)}
        actions={openClip ? roomActions(openClip) : undefined}
      />
    </div>
  )
}

export default function WorkspaceScreen({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params)

  return (
    <WorkspaceShell active="workspaces" activeWorkspaceId={workspaceId}>
      {/* The heading lives inside the body: one fetch names the room and
          fills it, so the title is never a guess. */}
      <WorkspaceBody workspaceId={workspaceId} />
    </WorkspaceShell>
  )
}
