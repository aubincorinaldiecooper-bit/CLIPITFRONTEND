"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@astryxdesign/core/Button"
import { Card } from "@astryxdesign/core/Card"
import { Center } from "@astryxdesign/core/Center"
import { EmptyState } from "@astryxdesign/core/EmptyState"
import { IconWell } from "@/components/section-card"
import { useSignInGate } from "@/components/sign-in-gate"

/**
 * A page that belongs to a person, shown to a browser tab.
 *
 * Workspaces and Publishing both have this moment: the backend answers
 * "sign in required", and until now each page put up one grey sentence ending
 * in "sign in (top right)" and left the rest of the screen empty. That fails
 * the app's own empty-state standard twice over — every other empty moment
 * here gets the centred card, the mark on its own ground and an action, and
 * this one pointed at a control in a far corner instead of carrying one.
 *
 * So: Astryx's EmptyState inside the same muted card the app's other quiet
 * moments use, with the action in it. The button opens the same sign-in
 * dialog every gated action uses — email in, link back to this exact page,
 * signed in.
 *
 * On a deployment where sign-in is not configured, there is no button — the
 * same rule AccountControl follows, because a Sign in that opens a form
 * whose send can only fail is a broken promise, not an action. The page
 * still says plainly why it is empty.
 */
export function SignedOutState({
  icon,
  title,
  line,
}: {
  /** The mark for the well — same glyph components the pages already use. */
  icon: (props: { className?: string }) => ReactNode
  title: string
  /** One sentence on why this page needs a person. */
  line: string
}) {
  const { askToSignIn } = useSignInGate()
  /**
   * Whether this deployment can sign anyone in. Null while unknown — the
   * words render immediately either way; only the button waits for a yes,
   * so nothing flashes and nothing broken is ever offered.
   */
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/auth-configured")
      .then((response) => response.json() as Promise<{ configured: boolean }>)
      .then((body) => {
        if (!cancelled) setConfigured(body.configured)
      })
      .catch(() => {
        if (!cancelled) setConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card variant="muted" padding={6}>
      <Center minHeight={280}>
        <EmptyState
          icon={<IconWell icon={icon} />}
          title={title}
          description={
            configured === false
              ? `${line} Sign-in isn't switched on for this deployment yet.`
              : line
          }
          headingLevel={2}
          actions={configured ? <Button label="Sign in" variant="primary" onClick={askToSignIn} /> : undefined}
        />
      </Center>
    </Card>
  )
}
