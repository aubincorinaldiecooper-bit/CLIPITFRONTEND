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
import { useToast } from "@astryxdesign/core/Toast"
import { api, ApiError } from "@/lib/api"
import type { TeamPage } from "@/lib/types"
import { AppShell } from "@/components/app-shell"

/**
 * The team: who is in this workspace, and who has been invited.
 *
 * A workspace shares everything — the same library, the same connected
 * accounts — so the page says that out loud before anyone sends an invite.
 * Only the owner sees the invite form, the pending list, and Remove; a member
 * sees the roster and nothing they cannot act on.
 *
 * When the deployment has no email service, an invitation still exists and
 * its link still works. The page says so and hands over the link rather than
 * claiming an email went out.
 */

function whenExpires(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return "expires today"
  if (days === 1) return "expires tomorrow"
  return `expires in ${days} days`
}

function TeamBody() {
  const [page, setPage] = useState<TeamPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [email, setEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  /** A link to pass on by hand when no email could be sent. */
  const [linkToShare, setLinkToShare] = useState<{ email: string; url: string } | null>(null)
  const toast = useToast()

  const load = () =>
    api
      .getTeam()
      .then(setPage)
      .catch((cause) => {
        // A backend without this endpoint yet is "teams aren't switched on
        // here", not a loading failure.
        if (cause instanceof ApiError && cause.status === 404) {
          setPage({ signInRequired: false, workspace: null, members: [], invites: [] })
        } else {
          setFailed(true)
        }
      })

  useEffect(() => {
    void load()
    // Loaded once on mount; every mutation below refreshes it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const invite = async (event: React.FormEvent) => {
    event.preventDefault()
    const address = email.trim()
    if (!address || inviting) return
    setFormError(null)
    setInviting(true)
    try {
      const result = await api.inviteToTeam(address)
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
              : "The invitation exists, but the email could not be sent. Share the link below instead.",
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

  const withdraw = async (inviteId: string) => {
    setBusyId(inviteId)
    try {
      await api.revokeInvite(inviteId)
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

  const remove = async (userId: string, label: string) => {
    setBusyId(userId)
    try {
      await api.removeTeamMember(userId)
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

  if (failed) {
    return <p className="text-sm text-error">Couldn't load your team. Refresh to try again.</p>
  }
  if (page === null) {
    return <Skeleton height={120} radius={3} />
  }
  if (page.signInRequired) {
    return (
      <Text as="p" type="body" color="secondary" display="block">
        A team belongs to you, not to a browser tab — sign in (top right) and your workspace will be here.
      </Text>
    )
  }
  if (!page.workspace) {
    return (
      <Text as="p" type="body" color="secondary" display="block">
        Teams aren't switched on for this deployment yet.
      </Text>
    )
  }

  const { isOwner } = page.workspace

  return (
    <VStack gap={5} align="stretch">
      {formError && <Banner status="error" title="That didn't work" description={formError} />}

      <VStack gap={2} align="stretch">
        <Heading level={2}>People</Heading>
        <List hasDividers>
          {page.members.map((member) => (
            <ListItem
              key={member.userId}
              label={member.email ?? "Teammate"}
              description={
                (member.role === "owner" ? "Owner" : "Member") + (member.isYou ? " — that's you" : "")
              }
              endContent={
                isOwner && !member.isYou ? (
                  <Button
                    label="Remove"
                    variant="secondary"
                    size="sm"
                    isLoading={busyId === member.userId}
                    onClick={() => void remove(member.userId, member.email ?? "That person")}
                  />
                ) : undefined
              }
            />
          ))}
        </List>
      </VStack>

      {isOwner ? (
        <VStack gap={2} align="stretch">
          <Heading level={2}>Invite someone</Heading>
          <Text as="p" type="supporting" display="block">
            Anyone you invite shares this workspace: the same videos, the same clips, and the same connected
            accounts to publish to.
          </Text>
          <form onSubmit={invite}>
            <HStack gap={2} align="end" wrap="wrap">
              <TextInput
                label="Email address"
                isLabelHidden
                type="email"
                value={email}
                onChange={(value) => setEmail(value)}
                placeholder="teammate@example.com"
              />
              <Button label="Send invitation" variant="primary" type="submit" isLoading={inviting} />
            </HStack>
          </form>

          {linkToShare && (
            <Banner
              status="warning"
              title={`Pass this link to ${linkToShare.email}`}
              description={linkToShare.url}
            />
          )}

        </VStack>
      ) : (
        <Text as="p" type="supporting" display="block">
          The workspace owner adds and removes people.
        </Text>
      )}

      {/* Its own section rather than a tail on the invite form: these are
          people who have been offered access and have not taken it yet. */}
      {isOwner && page.invites.length > 0 && (
        <VStack gap={2} align="stretch">
          <Heading level={2}>Waiting to be accepted</Heading>
          <List hasDividers>
            {page.invites.map((pending) => (
              <ListItem
                key={pending.id}
                label={pending.email}
                description={`Invited ${new Date(pending.invitedAt).toLocaleDateString()} — ${whenExpires(pending.expiresAt)}`}
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
  )
}

export default function TeamScreen() {
  return (
    <AppShell active="team">
      <Layout height="auto" contentWidth={672}>
        <LayoutContent padding={6}>
          <VStack gap={4} align="stretch">
            <VStack gap={1.5}>
              <Heading level={1}>Team</Heading>
              <Text as="p" type="supporting" display="block">
                Everyone here shares the same videos, clips, and connected accounts.
              </Text>
            </VStack>
            <TeamBody />
          </VStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
