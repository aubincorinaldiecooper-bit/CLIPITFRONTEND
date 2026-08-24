"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Center } from "@astryxdesign/core/Center"
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
import { EmptyState } from "@astryxdesign/core/EmptyState"
import { Heading } from "@astryxdesign/core/Heading"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { List, ListItem } from "@astryxdesign/core/List"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { TextInput } from "@astryxdesign/core/TextInput"
import { useToast } from "@astryxdesign/core/Toast"
import { api, ApiError } from "@/lib/api"
import type { WorkspacesPage } from "@/lib/types"
import { AppShell } from "@/components/app-shell"
import { WORKSPACES_CHANGED_EVENT } from "@/components/side-nav"
import { GhostRoom } from "@/components/empty-illustrations"

/**
 * Your workspaces, the traditional shape: the first one is where all your
 * clips live — you have it from the moment you sign in — and the ones after
 * it are rooms you share with people.
 *
 * "Create workspace" is a modal, and it is how sharing starts: name the room
 * and invite the first person in the same breath. The invitation is optional
 * — a room can exist before its people — but the modal asks, because a
 * workspace with only you in it is usually a step, not a destination.
 */

function WorkspacesBody() {
  const [page, setPage] = useState<WorkspacesPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  /**
   * Set when a workspace was created but its invitation email could not be
   * sent. The invitation itself is live — this holds the link so the owner
   * can pass it on by hand, because nothing else in the app can recover it.
   */
  const [handoff, setHandoff] = useState<{
    workspace: { id: string; name: string }
    email: string
    url: string
  } | null>(null)
  const router = useRouter()
  const toast = useToast()

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

  /** Close the handoff and go to the workspace that was made. */
  const finishHandoff = () => {
    const target = handoff?.workspace.id
    setHandoff(null)
    setCreateOpen(false)
    setName("")
    setInviteEmail("")
    if (target) router.push(`/workspaces/${target}`)
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    const email = inviteEmail.trim()
    if (!trimmed || creating) return
    setFormError(null)
    setCreating(true)
    try {
      const { workspace } = await api.createWorkspace(trimmed)
      window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT))

      if (email) {
        // The room exists either way; the invitation is its own step with its
        // own honest outcome.
        try {
          const result = await api.inviteToWorkspace(workspace.id, email)
          if (!result.emailed) {
            // The invitation is REAL and its link works — only the email
            // failed. Closing here would throw that link away, and nothing
            // else in the app can recover it, so the dialog stays open and
            // hands it over instead.
            setHandoff({ workspace, email, url: result.acceptUrl })
            return
          }
          toast({ body: `${workspace.name} created — invitation sent to ${email}.` })
        } catch (cause) {
          toast({
            type: "error",
            body:
              cause instanceof ApiError
                ? `${workspace.name} created, but: ${cause.message}`
                : `${workspace.name} created, but the invitation couldn't be sent.`,
          })
        }
      } else {
        toast({ body: `${workspace.name} created.` })
      }

      setCreateOpen(false)
      setName("")
      setInviteEmail("")
      router.push(`/workspaces/${workspace.id}`)
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : "Couldn't create that workspace. Try again.")
    } finally {
      setCreating(false)
    }
  }

  const header = (
    <VStack gap={1.5}>
      <Heading level={1}>Workspaces</Heading>
      <Text as="p" type="supporting" display="block">
        Your first workspace is where your clips live. Create another to share clips with people.
      </Text>
    </VStack>
  )

  if (failed) {
    return (
      <VStack gap={4} align="stretch">
        {header}
        <p className="text-sm text-error">Couldn't load your workspaces. Refresh to try again.</p>
      </VStack>
    )
  }
  if (page === null) {
    return (
      <VStack gap={4} align="stretch">
        {header}
        <Skeleton height={120} radius={3} />
      </VStack>
    )
  }
  if (page.signInRequired) {
    return (
      <VStack gap={4} align="stretch">
        {header}
        <Text as="p" type="body" color="secondary" display="block">
          Workspaces belong to you, not to a browser tab — sign in (top right) and yours will be here.
        </Text>
      </VStack>
    )
  }

  return (
    <VStack gap={5} align="stretch">
      <HStack justify="between" align="start" gap={4} wrap="wrap">
        <VStack gap={1.5}>
          <Heading level={1}>Workspaces</Heading>
          <Text as="p" type="supporting" display="block">
            Your first workspace is where your clips live. Create another to share clips with people.
          </Text>
        </VStack>
        {/* While the no-shared-workspaces empty state is on the page it owns
            this action; two identical primary buttons is one too many. */}
        {page.workspaces.some((room) => !room.isPersonal) && (
          <Button label="Create workspace" variant="primary" onClick={() => setCreateOpen(true)} />
        )}
      </HStack>

      {page.workspaces.length === 0 ? (
        // The backend without workspaces yet: an intentional room, not a
        // page that trails off into nothing.
        <Center minHeight="50vh">
          <EmptyState
            icon={<GhostRoom />}
            title="Workspaces aren't switched on here yet"
            description="Once they are, your first workspace — where every clip you cut lives — appears here, and you can create shared ones to send clips to people."
          />
        </Center>
      ) : (
        <List hasDividers>
          {page.workspaces.map((room) => (
            <ListItem
              key={room.id}
              label={room.name}
              href={`/workspaces/${room.id}`}
              description={
                room.isPersonal
                  ? `Your workspace — every clip you cut lives here · ${room.clipCount} ${room.clipCount === 1 ? "clip" : "clips"}`
                  : `${room.clipCount} ${room.clipCount === 1 ? "clip" : "clips"} · ` +
                    `${room.memberCount} ${room.memberCount === 1 ? "person" : "people"}` +
                    (room.isOwner ? " · yours" : "")
              }
            />
          ))}
        </List>
      )}

      {page.workspaces.length > 0 && !page.workspaces.some((room) => !room.isPersonal) && (
        // The library row exists above; what is missing is the SHARED kind,
        // so the empty state sells exactly that and its action opens the
        // create dialog.
        <Center minHeight="45vh">
          <EmptyState
            icon={<GhostRoom />}
            title="No shared workspaces yet"
            description="Create one, invite people into it, and send clips there from your library — everyone in the workspace sees what's sent."
            actions={<Button label="Create workspace" variant="primary" onClick={() => setCreateOpen(true)} />}
          />
        </Center>
      )}

      <Dialog
        isOpen={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          // Dismissing the handoff is the owner saying they have the link;
          // the workspace was made either way, so take them to it.
          if (!open && handoff) finishHandoff()
        }}
        purpose="form"
        width={420}
      >
        {handoff ? (
          <>
            <DialogHeader title={`${handoff.workspace.name} is ready`} />
            <VStack gap={3} align="stretch">
              <Banner
                status="warning"
                title={`The invitation for ${handoff.email} couldn't be emailed`}
                description="The invitation itself is live — send this link to them yourself. It works once and expires in seven days."
              />
              {/* The link is the whole point of this state: selectable, and
                  scrolling inside its own line rather than widening the
                  dialog. */}
              <Text
                as="p"
                type="supporting"
                display="block"
                className="select-all overflow-x-auto whitespace-nowrap rounded-md bg-black/30 p-2"
              >
                {handoff.url}
              </Text>
              <HStack gap={2} justify="end">
                <Button
                  label="Copy link"
                  variant="secondary"
                  onClick={() => {
                    // Optional chaining short-circuits the WHOLE chain when
                    // the clipboard API is absent (plain-HTTP origins), so
                    // the guard must be explicit or the button does nothing.
                    if (!navigator.clipboard) {
                      toast({ type: "error", body: "Couldn't copy here — select the link and copy it." })
                      return
                    }
                    void navigator.clipboard
                      .writeText(handoff.url)
                      .then(() => toast({ body: "Link copied." }))
                      .catch(() => toast({ type: "error", body: "Couldn't copy — select the link and copy it." }))
                  }}
                />
                <Button label="Done" variant="primary" onClick={finishHandoff} />
              </HStack>
            </VStack>
          </>
        ) : (
          <>
            <DialogHeader title="Create a workspace" />
            <form onSubmit={create}>
              <VStack gap={3} align="stretch">
                {formError && <Banner status="error" title="That didn't work" description={formError} />}
                <TextInput
                  label="Workspace name"
                  isRequired
                  value={name}
                  onChange={(value) => setName(value)}
                  placeholder="e.g. Northside Films"
                  hasAutoFocus
                />
                <TextInput
                  label="Invite someone (optional)"
                  type="email"
                  value={inviteEmail}
                  onChange={(value) => setInviteEmail(value)}
                  placeholder="teammate@example.com"
                  description="They'll get an email link that works once and expires in seven days."
                />
                <Text as="p" type="supporting" display="block">
                  You'll own the workspace. Everyone in it sees the clips sent there; your own library
                  stays yours.
                </Text>
                <HStack gap={2} justify="end">
                  <Button label="Cancel" variant="ghost" onClick={() => setCreateOpen(false)} />
                  <Button label="Create workspace" variant="primary" type="submit" isLoading={creating} />
                </HStack>
              </VStack>
            </form>
          </>
        )}
      </Dialog>
    </VStack>
  )
}

export default function WorkspacesScreen() {
  return (
    <AppShell active="workspaces">
      <Layout height="auto" contentWidth={672}>
        <LayoutContent padding={6}>
          <WorkspacesBody />
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
