"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Center } from "@astryxdesign/core/Center"
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
import { EmptyState } from "@astryxdesign/core/EmptyState"
import { Heading } from "@astryxdesign/core/Heading"
import { Icon } from "@astryxdesign/core/Icon"
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
import { personName } from "@/components/side-nav"
import { useResumeIntent, useSignInGate } from "@/components/sign-in-gate"
import { WORKSPACES_CHANGED_EVENT } from "@/components/side-nav"
import { GhostRoom } from "@/components/empty-illustrations"
import { ArrowRightGlyph, PlusGlyph } from "@/components/glyphs"
import { SplitModal } from "@/components/split-modal"

/** Ties the footer's submit button back to the form it sits outside of. */
const CREATE_FORM_ID = "create-workspace-form"

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
  /**
   * The addresses to invite, one per row. Starts as a single empty row so the
   * field is there to type into without anybody having to ask for it.
   */
  const [inviteEmails, setInviteEmails] = useState<string[]>([""])
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  /**
   * Set when a workspace was created but one or more invitation emails could
   * not be sent. Those invitations are live — this holds their links so the
   * owner can pass them on by hand, because nothing else in the app can
   * recover them.
   */
  const [handoff, setHandoff] = useState<{
    workspace: { id: string; name: string }
    links: Array<{ email: string; url: string }>
  } | null>(null)
  const router = useRouter()
  const toast = useToast()
  const { requireSignIn } = useSignInGate()

  /**
   * Making a room is inviting people into it — the modal asks for the first
   * address in the same breath — so it needs a person, not a browser tab.
   */
  const askToCreate = () =>
    // A workspace has no id yet, so the intent carries the page instead: the
    // dialog reopens and the name they typed is theirs to type again. Better
    // than losing the whole errand.
    requireSignIn({ action: "invite", workspaceId: "new" }, () => setCreateOpen(true))

  useResumeIntent(
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

  /** Put the form back to a single blank invite row. */
  const resetForm = () => {
    setName("")
    setInviteEmails([""])
  }

  /** Close the handoff and go to the workspace that was made. */
  const finishHandoff = () => {
    const target = handoff?.workspace.id
    setHandoff(null)
    setCreateOpen(false)
    resetForm()
    if (target) router.push(`/workspaces/${target}`)
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    // Blank rows are somebody who added one and thought better of it, and the
    // same address typed twice is one invitation, not two.
    const addresses = [...new Set(inviteEmails.map((address) => address.trim()).filter(Boolean))]
    if (!trimmed || creating) return
    setFormError(null)
    setCreating(true)
    try {
      const { workspace } = await api.createWorkspace(trimmed)
      window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT))

      // The room exists either way; each invitation is its own step with its
      // own honest outcome, and one failing must not stop the rest.
      const emailed: string[] = []
      const links: Array<{ email: string; url: string }> = []
      const refused: string[] = []

      for (const email of addresses) {
        try {
          const result = await api.inviteToWorkspace(workspace.id, email)
          if (result.emailed) {
            emailed.push(email)
          } else {
            // The invitation is REAL and its link works — only the email
            // failed. Closing here would throw that link away, and nothing
            // else in the app can recover it.
            links.push({ email, url: result.acceptUrl })
          }
        } catch {
          refused.push(email)
        }
      }

      // Say what actually happened to each one, rather than a single verdict
      // that would have to be wrong about somebody.
      if (refused.length > 0) {
        toast({
          type: "error",
          body: `${workspace.name} created, but no invitation could be made for ${refused.join(", ")}.`,
        })
      } else if (emailed.length > 0 && links.length === 0) {
        toast({
          body: `${workspace.name} created — ${
            emailed.length === 1 ? `invitation sent to ${emailed[0]}` : `${emailed.length} invitations sent`
          }.`,
        })
      } else if (links.length === 0) {
        toast({ body: `${workspace.name} created.` })
      }

      if (links.length > 0) {
        // The dialog stays open and hands the links over instead of closing.
        setHandoff({ workspace, links })
        return
      }

      setCreateOpen(false)
      resetForm()
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
        Rooms you share with other people. Your own clips live under Your clips.
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

  // The rooms this page is about. The personal one is deliberately excluded:
  // it is the same place "Your clips" opens, and listing it here as well made
  // one room look like two.
  const shared = page.workspaces.filter((room) => !room.isPersonal)

  return (
    <VStack gap={5} align="stretch">
      <HStack justify="between" align="start" gap={4} wrap="wrap">
        <VStack gap={1.5}>
          <Heading level={1}>Workspaces</Heading>
          <Text as="p" type="supporting" display="block">
            Rooms you share with other people. Your own clips live under Your clips.
          </Text>
        </VStack>
        {/* While the no-shared-workspaces empty state is on the page it owns
            this action; two identical primary buttons is one too many. */}
        {shared.length > 0 && (
          <Button label="Create workspace" variant="primary" onClick={askToCreate} />
        )}
      </HStack>

      {/* The personal room is not listed. It is the same place "Your clips"
          already opens, and showing it here as well made one room look like
          two. This page is the shared ones. */}
      {shared.length > 0 && (
        <List hasDividers>
          {shared.map((room) => (
            <ListItem
              key={room.id}
              label={room.isOwner ? room.name : `${personName(room.ownerEmail) ?? "Shared"} · ${room.name}`}
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

      {shared.length === 0 && (
        // The library row exists above; what is missing is the SHARED kind,
        // so the empty state sells exactly that and its action opens the
        // create dialog.
        <Center minHeight="45vh">
          <EmptyState
            icon={<GhostRoom />}
            title="No shared workspaces yet"
            description="Create one, invite people into it, and send clips there from your library — everyone in the workspace sees what's sent."
            actions={<Button label="Create workspace" variant="primary" onClick={askToCreate} />}
          />
        </Center>
      )}

      {/* Making the room, and handing over a link that could not be emailed,
          are two different moments and now two different dialogs. They used to
          share one, which meant the picture and the failure banner had to take
          turns inside the same frame. */}
      <SplitModal
        isOpen={createOpen && !handoff}
        onOpenChange={setCreateOpen}
        photo="workspace"
        title="Create a workspace"
        subtitle="Share clips with your team."
        footer={
          <>
            <Button label="Cancel" variant="ghost" onClick={() => setCreateOpen(false)} />
            <Button
              label="Create workspace"
              variant="primary"
              type="submit"
              // The button lives in the footer, outside the form element, so
              // it is tied back to it by id rather than by nesting.
              form={CREATE_FORM_ID}
              endContent={<Icon icon={ArrowRightGlyph} />}
              isLoading={creating}
            />
          </>
        }
      >
        <form id={CREATE_FORM_ID} onSubmit={create}>
          <VStack gap={4} align="stretch">
            {formError && <Banner status="error" title="That didn't work" description={formError} />}
            <TextInput
              label="Workspace name"
              isRequired
              value={name}
              onChange={(value) => setName(value)}
              placeholder="Northside Films"
              hasAutoFocus
            />

            {/* One address per row, and a way to add another. The mockup shows
                the "+ Add another" affordance, and it is the difference
                between starting a room with your team in it and starting one
                with a single person and a chore for later. */}
            <VStack gap={2} align="stretch">
              {inviteEmails.map((address, index) => (
                <TextInput
                  key={index}
                  label={index === 0 ? "Invite someone (optional)" : `Invite someone else (${index + 1})`}
                  isLabelHidden={index > 0}
                  type="email"
                  value={address}
                  onChange={(value) =>
                    setInviteEmails((current) =>
                      current.map((entry, position) => (position === index ? value : entry)),
                    )
                  }
                  placeholder="teammate@example.com"
                />
              ))}
              <HStack justify="start">
                <Button
                  label="Add another"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={PlusGlyph} size="sm" />}
                  // A row that is still blank is not a row anybody needs a
                  // second of. Guarding here rather than letting empties pile
                  // up keeps the modal honest about how much it is asking for.
                  isDisabled={inviteEmails.some((address) => address.trim() === "")}
                  onClick={() => setInviteEmails((current) => [...current, ""])}
                />
              </HStack>
            </VStack>
          </VStack>
        </form>
      </SplitModal>

      <Dialog
        isOpen={Boolean(handoff)}
        onOpenChange={(open) => {
          // Dismissing the handoff is the owner saying they have the link;
          // the workspace was made either way, so take them to it.
          if (!open) finishHandoff()
        }}
        purpose="form"
        width={420}
      >
        {handoff && (
          <>
            <DialogHeader title={`${handoff.workspace.name} is ready`} />
            <VStack gap={3} align="stretch">
              <Banner
                status="warning"
                title={
                  handoff.links.length === 1
                    ? `The invitation for ${handoff.links[0]!.email} couldn't be emailed`
                    : `${handoff.links.length} invitations couldn't be emailed`
                }
                description="The invitations themselves are live — send these links on yourself. Each works once and expires in seven days."
              />
              {/* The links are the whole point of this state: selectable, and
                  scrolling inside their own line rather than widening the
                  dialog. Each is labelled with who it belongs to, because
                  handing the wrong person the wrong link lets them into the
                  room under somebody else's invitation. */}
              {handoff.links.map((link) => (
                <VStack key={link.email} gap={1} align="stretch">
                  <Text as="p" type="supporting" display="block">
                    {link.email}
                  </Text>
                  <HStack gap={2} align="center">
                    <Text
                      as="p"
                      type="supporting"
                      display="block"
                      className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-md bg-black/30 p-2"
                    >
                      {link.url}
                    </Text>
                    <Button
                      label="Copy"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        // Optional chaining short-circuits the WHOLE chain when
                        // the clipboard API is absent (plain-HTTP origins), so
                        // the guard must be explicit or the button does nothing.
                        if (!navigator.clipboard) {
                          toast({ type: "error", body: "Couldn't copy here — select the link and copy it." })
                          return
                        }
                        void navigator.clipboard
                          .writeText(link.url)
                          .then(() => toast({ body: `Link for ${link.email} copied.` }))
                          .catch(() =>
                            toast({ type: "error", body: "Couldn't copy — select the link and copy it." }),
                          )
                      }}
                    />
                  </HStack>
                </VStack>
              ))}
              <HStack gap={2} justify="end">
                <Button label="Done" variant="primary" onClick={finishHandoff} />
              </HStack>
            </VStack>
          </>
        )}
      </Dialog>
    </VStack>
  )
}

export default function WorkspacesScreen() {
  return (
    <AppShell active="workspaces">
      <Layout height="auto" contentWidth={880}>
        <LayoutContent padding={6}>
          <WorkspacesBody />
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
