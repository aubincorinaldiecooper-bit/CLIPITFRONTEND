"use client"

import type { ReactNode } from "react"
import { Button } from "@astryxdesign/core/Button"
import { Card } from "@astryxdesign/core/Card"
import { Center } from "@astryxdesign/core/Center"
import { Heading } from "@astryxdesign/core/Heading"
import { Text } from "@astryxdesign/core/Text"
import { VStack } from "@astryxdesign/core/Stack"
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
 * The corner it pointed at isn't even guaranteed: on a deployment without
 * sign-in configured, the header renders no button there at all.
 *
 * So: the same furniture as the app's other empty states, with the action in
 * it. The button opens the same sign-in dialog every gated action uses —
 * email in, link back to this exact page, signed in.
 */
export function SignedOutState({
  icon,
  title,
  line,
}: {
  /** The mark for the round well — same glyph components the pages already use. */
  icon: (props: { className?: string }) => ReactNode
  title: string
  /** One sentence on why this page needs a person. */
  line: string
}) {
  const { askToSignIn } = useSignInGate()
  const Glyph = icon

  return (
    <Card variant="muted" padding={6}>
      <Center minHeight={280}>
        <VStack gap={2} align="center">
          {/* The same 72px well the Recent-activity empty state stands its
              mark in, so the app's quiet moments all look related. */}
          <span
            aria-hidden
            className="mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-surface text-primary ring-1 ring-border"
          >
            <Glyph className="h-7 w-7" />
          </span>
          <Heading level={2} accessibilityLevel={2}>
            {title}
          </Heading>
          <Text as="p" type="body" color="secondary" display="block" className="max-w-[44ch] text-center">
            {line}
          </Text>
          <span className="mt-3">
            <Button label="Sign in" variant="primary" onClick={askToSignIn} />
          </span>
        </VStack>
      </Center>
    </Card>
  )
}
