"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Grid } from "@astryxdesign/core/Grid"
import { Heading } from "@astryxdesign/core/Heading"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { List, ListItem } from "@astryxdesign/core/List"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { TextInput } from "@astryxdesign/core/TextInput"
import { useToast } from "@astryxdesign/core/Toast"
import { api, ApiError } from "@/lib/api"
import type { WorkspaceDetail } from "@/lib/types"
import { AppShell } from "@/components/app-shell"

/**
 * One workspace: the clips people have sent here, and who is here.
 *
 * Clips come first — the room exists for them. Each card plays in place,
 * exactly like the library, and "Take out" removes the clip from the room
 * without touching the clip itself. People and invitations follow below;
 * only the owner sees the invite form, the pending list, and Remove.
 */

function WorkspaceBody({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = useState<WorkspaceDetail | null>(null)
  const [failed, setFailed] = useState<"missing" | "error" | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  /** A link to pass on by hand when no email could be sent. */
  const [linkToShare, setLinkToShare] = useState<{ email: string; url: string } | null>(null)
  const router = useRouter()
  const toast = useToast()

  const load = () =>
    api
      .getWorkspace(workspaceId)
      .then(setPage)
      .catch((cause) => {
        setFailed(cause instanceof ApiError && cause.status === 404 ? "missing" : "error")
      })

  useEffect(() => {
    void load()
    // Loaded once per room; every mutation below refreshes it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const invite = async (event: React.FormEvent) => {
    event.preventDefault()
    const address = email.trim()
    if (!address || inviting) return
    setFormError(null)
    setInviting(true)
    try {
      const result = await api.inviteToWorkspace(workspaceId, address)
      setEmail("")
      if (result.emailed) {
        toast({ body: `Invitation sent to ${address}.` })
        setLinkToShare(null)
      } else {
        // Never claim an email arrived that did not.
        toast({
          type: "error",
          body:
            result.emailProblem === "email_domain_unverified"
              ? "The invitation exists, but email could not be sent — the sending domain isn't verified yet."
              : "The invitation exists, but the email could not be sent. Pass the link on instead.",
        })
        setLinkToShare({ email: address, url: result.acceptUrl })
      }
      await load()
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : "Couldn't send that invitation. Try again.")
    } finally {
      setInviting(false)
    }
  }

  const takeOut = async (clipId: string) => {
    setBusyId(clipId)
    try {
      await api.removeClipFromWorkspace(workspaceId, clipId)
      toast({ body: "Taken out of this workspace. The clip itself is untouched." })
      await load()
    } catch (cause) {
      toast({
        type: "error",
        body: cause instanceof ApiError ? cause.message : "Couldn't take that clip out.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const withdraw = async (inviteId: string) => {
    setBusyId(inviteId)
    try {
      await api.revokeInvite(workspaceId, inviteId)
      await load()
    } catch (cause) {
      toast({
        type: "error",
        body: cause instanceof ApiError ? cause.message : "Couldn't withdraw that invitation.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const removePerson = async (userId: string, label: string) => {
    setBusyId(userId)
    try {
      await api.removeWorkspaceMember(workspaceId, userId)
      toast({ body: `${label} no longer has access.` })
      await load()
    } catch (cause) {
      toast({
        type: "error",
        body: cause instanceof ApiError ? cause.message : "Couldn't remove that person.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const leave = async () => {
    setBusyId("leave")
    try {
      await api.leaveWorkspace(workspaceId)
      router.push("/workspaces")
    } catch (cause) {
      toast({
        type: "error",
        body: cause instanceof ApiError ? cause.message : "Couldn't leave this workspace.",
      })
      setBusyId(null)
    }
  }

  if (failed === "missing") {
    return (
      <Text as="p" type="body" color="secondary" display="block">
        This workspace doesn't exist, or you're not in it. Sign in (top right) if you haven't.
      </Text>
    )
  }
  if (failed === "error") {
    return <p className="text-sm text-error">Couldn't load this workspace. Refresh to try again.</p>
  }
  if (page === null) {
    return <Skeleton height={160} radius={3} />
  }

  const { isOwner } = page.workspace

  return (
    <VStack gap={5} align="stretch">
      <VStack gap={1.5}>
        <Heading level={1}>{page.workspace.name}</Heading>
        <Text as="p" type="supporting" display="block">
          Clips people have sent here, and who's in the room.
        </Text>
      </VStack>

      {formError && <Banner status="error" title="That didn't work" description={formError} />}

      <VStack gap={2} align="stretch">
        <Heading level={2}>Clips</Heading>
        {page.clips.length === 0 ? (
          <Text as="p" type="supporting" display="block">
            Nothing here yet. In Your clips, every ready clip has a "Send to workspace" option — what
            you send lands here for everyone in the room.
          </Text>
        ) : (
          <Grid columns={{ minWidth: 280, max: 3 }} gap={3}>
            {page.clips.map((clip) => (
              <div key={clip.id} className="overflow-hidden rounded-xl bg-black/35 ring-1 ring-white/10">
                {playingId === clip.id && clip.url ? (
                  <video src={clip.url} controls autoPlay playsInline className="aspect-video w-full bg-black" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlayingId(clip.id)}
                    disabled={!clip.url}
                    aria-label={`Play: ${clip.description}`}
                    className="group relative block aspect-video w-full bg-black/60 disabled:cursor-default"
                  >
                    {clip.thumbnailUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={clip.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                    {clip.url && (
                      <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 transition-transform group-hover:scale-105">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
                        </svg>
                      </span>
                    )}
                  </button>
                )}
                <div className="flex flex-col gap-2 p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-[13.5px] leading-snug text-foreground/85">
                    {clip.description || "A moment from a video"}
                  </p>
                  <p className="truncate text-[12px] text-foreground/40">
                    <span className="font-mono tabular-nums">
                      {clip.startTimecode} – {clip.endTimecode}
                    </span>
                    {clip.videoTitle ? ` · ${clip.videoTitle}` : ""}
                  </p>
                  <HStack gap={2} align="center" wrap="wrap">
                    {clip.downloadUrl && (
                      /* A plain anchor with `download`: the browser saves the
                         signed file directly. */
                      <a
                        href={clip.downloadUrl}
                        download
                        className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-black transition-transform active:scale-[0.97]"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
                        </svg>
                        Download
                      </a>
                    )}
                    <Button
                      label="Take out"
                      variant="secondary"
                      size="sm"
                      isLoading={busyId === clip.id}
                      onClick={() => void takeOut(clip.id)}
                    />
                  </HStack>
                </div>
              </div>
            ))}
          </Grid>
        )}
      </VStack>

      <VStack gap={2} align="stretch">
        <Heading level={2}>People</Heading>
        <List hasDividers>
          {page.members.map((member) => (
            <ListItem
              key={member.userId}
              label={member.email ?? "Teammate"}
              description={(member.role === "owner" ? "Owner" : "Member") + (member.isYou ? " — that's you" : "")}
              endContent={
                isOwner && !member.isYou ? (
                  <Button
                    label="Remove"
                    variant="secondary"
                    size="sm"
                    isLoading={busyId === member.userId}
                    onClick={() => void removePerson(member.userId, member.email ?? "That person")}
                  />
                ) : member.isYou && !isOwner ? (
                  <Button
                    label="Leave"
                    variant="ghost"
                    size="sm"
                    isLoading={busyId === "leave"}
                    onClick={() => void leave()}
                  />
                ) : undefined
              }
            />
          ))}
        </List>
      </VStack>

      {isOwner && (
        <VStack gap={2} align="stretch">
          <Heading level={2}>Invite someone</Heading>
          <form onSubmit={invite}>
            <HStack gap={2} align="end" wrap="wrap">
              <TextInput
                label="Email address"
                isLabelHidden
                type="email"
                isRequired
                value={email}
                onChange={(value) => setEmail(value)}
                placeholder="teammate@example.com"
              />
              <Button label="Send invitation" variant="primary" type="submit" isLoading={inviting} />
            </HStack>
          </form>
          {/* Both states are the same two lines tall, so pressing Send never
              pushes the rows below down — and the space is never dead. */}
          <VStack gap={0.5} align="stretch" className="min-h-[3.25rem]">
            {linkToShare ? (
              <>
                <Text as="p" type="supporting" display="block" className="text-warning">
                  Email couldn't be sent — pass this link to {linkToShare.email}:
                </Text>
                <Text as="p" type="supporting" display="block" className="overflow-x-auto whitespace-nowrap">
                  {linkToShare.url}
                </Text>
              </>
            ) : (
              <Text as="p" type="supporting" display="block">
                They'll get an email with a link that works once and expires in seven days. Everyone here
                sees the clips sent to this workspace.
              </Text>
            )}
          </VStack>

          {page.invites.length > 0 && (
            <VStack gap={2} align="stretch">
              <Heading level={3}>Waiting to be accepted</Heading>
              <List hasDividers>
                {page.invites.map((pending) => (
                  <ListItem
                    key={pending.id}
                    label={pending.email}
                    description={`Invited ${new Date(pending.invitedAt).toLocaleDateString()}`}
                    endContent={
                      <Button
                        label="Withdraw"
                        variant="secondary"
                        size="sm"
                        isLoading={busyId === pending.id}
                        onClick={() => void withdraw(pending.id)}
                      />
                    }
                  />
                ))}
              </List>
            </VStack>
          )}
        </VStack>
      )}
    </VStack>
  )
}

export default function WorkspaceScreen({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params)

  return (
    <AppShell active="workspaces">
      <Layout height="auto" contentWidth={1152}>
        <LayoutContent padding={6}>
          {/* The heading lives inside the body: one fetch names the room and
              fills it, so the title is never a guess. */}
          <WorkspaceBody workspaceId={workspaceId} />
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
