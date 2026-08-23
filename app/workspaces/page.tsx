"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
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
        // The room exists either way; the invitation is its own step and its
        // own honest outcome.
        try {
          const result = await api.inviteToWorkspace(workspace.id, email)
          toast(
            result.emailed
              ? { body: `${workspace.name} created — invitation sent to ${email}.` }
              : {
                  type: "error",
                  body: `${workspace.name} created, but the invitation email couldn't be sent. Invite again from the workspace page.`,
                },
          )
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
        <Button label="Create workspace" variant="primary" onClick={() => setCreateOpen(true)} />
      </HStack>

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

      <Dialog isOpen={createOpen} onOpenChange={setCreateOpen} purpose="form" width={420}>
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
