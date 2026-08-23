"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@astryxdesign/core/Button"
import { Grid } from "@astryxdesign/core/Grid"
import { Heading } from "@astryxdesign/core/Heading"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { Popover } from "@astryxdesign/core/Popover"
import { List, ListItem } from "@astryxdesign/core/List"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { TextInput } from "@astryxdesign/core/TextInput"
import { useToast } from "@astryxdesign/core/Toast"
import { api, ApiError } from "@/lib/api"
import type { WorkspaceDetail } from "@/lib/types"
import { AppShell } from "@/components/app-shell"
import { WORKSPACES_CHANGED_EVENT } from "@/components/side-nav"
import { ClipCard, ClipDownloadAction } from "@/components/clip-card"

/**
 * One workspace: the clips people have sent here.
 *
 * The room exists for its clips, so the clips ARE the page. Everything
 * administrative — who is here, inviting, pending invitations, leaving —
 * lives in two small controls in the header (People, Invite), each opening a
 * popover. Management is a visit, not a resident: it stops fighting the
 * clips for space.
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
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
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
      window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT))
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

  const peopleContent = (
    <VStack gap={2} align="stretch">
      <List hasDividers density="compact">
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
  )

  const inviteContent = (
    <VStack gap={2} align="stretch">
      <form onSubmit={invite}>
        <VStack gap={2} align="stretch">
          <TextInput
            label="Email address"
            isLabelHidden
            type="email"
            isRequired
            value={email}
            onChange={(value) => setEmail(value)}
            placeholder="teammate@example.com"
            hasAutoFocus
          />
          <Button label="Send invitation" variant="primary" size="sm" type="submit" isLoading={inviting} />
        </VStack>
      </form>
      {formError ? (
        <Text as="p" type="supporting" display="block" className="text-error">
          {formError}
        </Text>
      ) : linkToShare ? (
        <VStack gap={0.5} align="stretch">
          <Text as="p" type="supporting" display="block" className="text-warning">
            Email couldn't be sent — pass this link to {linkToShare.email}:
          </Text>
          {/* A long URL scrolls inside its own line rather than widening the popover. */}
          <Text as="p" type="supporting" display="block" className="overflow-x-auto whitespace-nowrap">
            {linkToShare.url}
          </Text>
        </VStack>
      ) : (
        <Text as="p" type="supporting" display="block">
          The link works once and expires in seven days. Everyone here sees the clips sent to this
          workspace.
        </Text>
      )}
      {page.invites.length > 0 && (
        <VStack gap={1} align="stretch">
          <Text as="p" type="supporting" display="block" weight="medium">
            Waiting to be accepted
          </Text>
          <List hasDividers density="compact">
            {page.invites.map((pending) => (
              <ListItem
                key={pending.id}
                label={pending.email}
                description={`Invited ${new Date(pending.invitedAt).toLocaleDateString()}`}
                endContent={
                  <Button
                    label="Withdraw"
                    variant="ghost"
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
  )

  return (
    <VStack gap={5} align="stretch">
      {/* The header owns the administration: the room's name, and two small
          doors — People and Invite. The page below is the clips, uncontested. */}
      <HStack justify="between" align="start" gap={4} wrap="wrap">
        <VStack gap={1.5}>
          <Heading level={1}>{page.workspace.name}</Heading>
          <Text as="p" type="supporting" display="block">
            {page.workspace.isPersonal
              ? "Your workspace — every clip you cut lives here. Create a workspace to share clips with people."
              : "Clips people have sent here."}
          </Text>
        </VStack>
        {!page.workspace.isPersonal && (
        <HStack gap={2} align="center">
          <Popover
            isOpen={peopleOpen}
            onOpenChange={setPeopleOpen}
            placement="below"
            alignment="end"
            width={340}
            label="People in this workspace"
            content={peopleContent}
          >
            <Button label={`People · ${page.members.length}`} variant="secondary" size="sm" />
          </Popover>
          {isOwner && (
            <Popover
              isOpen={inviteOpen}
              onOpenChange={setInviteOpen}
              placement="below"
              alignment="end"
              width={340}
              label="Invite someone to this workspace"
              content={inviteContent}
            >
              <Button label="Invite" variant="primary" size="sm" />
            </Popover>
          )}
        </HStack>
        )}
      </HStack>

      {page.clips.length === 0 ? (
        <Text as="p" type="supporting" display="block">
          {page.workspace.isPersonal
            ? "Nothing here yet — cut a moment from a video and it lands here."
            : 'Nothing here yet. In Your clips, every ready clip has a "Send to workspace" option — what you send lands here for everyone in the room.'}
        </Text>
      ) : (
        <Grid columns={{ minWidth: 280, max: 3 }} gap={3}>
          {page.clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              isPlaying={playingId === clip.id}
              onPlay={() => setPlayingId(clip.id)}
              actions={
                <>
                  {clip.downloadUrl && <ClipDownloadAction href={clip.downloadUrl} />}
                  <Button
                    label="Take out"
                    variant="secondary"
                    size="sm"
                    isLoading={busyId === clip.id}
                    onClick={() => void takeOut(clip.id)}
                  />
                </>
              }
            />
          ))}
        </Grid>
      )}
    </VStack>
  )
}

export default function WorkspaceScreen({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params)

  return (
    <AppShell active="workspaces" activeWorkspaceId={workspaceId}>
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
