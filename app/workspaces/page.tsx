"use client"

import { useEffect, useState } from "react"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Heading } from "@astryxdesign/core/Heading"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { List, ListItem } from "@astryxdesign/core/List"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { TextInput } from "@astryxdesign/core/TextInput"
import { api, ApiError } from "@/lib/api"
import type { WorkspacesPage } from "@/lib/types"
import { AppShell } from "@/components/app-shell"

/**
 * The rooms you share with people. Your own library is not one of them —
 * that is "Your clips" — so this page is exactly the list of places a clip
 * can be sent to, and each row is a door.
 */

function WorkspacesBody() {
  const [page, setPage] = useState<WorkspacesPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
    if (!trimmed || creating) return
    setFormError(null)
    setCreating(true)
    try {
      await api.createWorkspace(trimmed)
      setName("")
      await load()
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : "Couldn't create that workspace. Try again.")
    } finally {
      setCreating(false)
    }
  }

  if (failed) {
    return <p className="text-sm text-error">Couldn't load your workspaces. Refresh to try again.</p>
  }
  if (page === null) {
    return <Skeleton height={120} radius={3} />
  }
  if (page.signInRequired) {
    return (
      <Text as="p" type="body" color="secondary" display="block">
        Workspaces belong to you, not to a browser tab — sign in (top right) and yours will be here.
      </Text>
    )
  }

  return (
    <VStack gap={5} align="stretch">
      {formError && <Banner status="error" title="That didn't work" description={formError} />}

      {page.workspaces.length === 0 ? (
        <Text as="p" type="supporting" display="block">
          No shared workspaces yet. Make one below, invite people into it, and send clips there from
          your library.
        </Text>
      ) : (
        <List hasDividers>
          {page.workspaces.map((room) => (
            <ListItem
              key={room.id}
              label={room.name}
              href={`/workspaces/${room.id}`}
              description={
                `${room.clipCount} ${room.clipCount === 1 ? "clip" : "clips"} · ` +
                `${room.memberCount} ${room.memberCount === 1 ? "person" : "people"}` +
                (room.isOwner ? " · yours" : "")
              }
            />
          ))}
        </List>
      )}

      <VStack gap={2} align="stretch">
        <Heading level={2}>New workspace</Heading>
        <form onSubmit={create}>
          <HStack gap={2} align="end" wrap="wrap">
            <TextInput
              label="Workspace name"
              isLabelHidden
              isRequired
              value={name}
              onChange={(value) => setName(value)}
              placeholder="e.g. Northside Films"
            />
            <Button label="Create workspace" variant="primary" type="submit" isLoading={creating} />
          </HStack>
        </form>
        <Text as="p" type="supporting" display="block">
          You'll own it: you invite people, and everyone in it sees the clips sent there.
        </Text>
      </VStack>
    </VStack>
  )
}

export default function WorkspacesScreen() {
  return (
    <AppShell active="workspaces">
      <Layout height="auto" contentWidth={672}>
        <LayoutContent padding={6}>
          <VStack gap={4} align="stretch">
            <VStack gap={1.5}>
              <Heading level={1}>Workspaces</Heading>
              <Text as="p" type="supporting" display="block">
                Shared rooms for clips. Send a clip from your library and everyone in the workspace can
                see it.
              </Text>
            </VStack>
            <WorkspacesBody />
          </VStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
