"use client"

import { Button } from "@astryxdesign/core/Button"
import { Heading } from "@astryxdesign/core/Heading"
import { VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { AppShell } from "@/components/app-shell"

/**
 * Where publishing will live — chrome on Astryx, promises unchanged.
 *
 * Deliberately a page and not a hidden roadmap item: connecting social
 * accounts is part of what this product is becoming, and the place for it
 * should exist before the plumbing does. Equally deliberately, there are no
 * disabled platform buttons here — a button that cannot work is an
 * advertisement for a broken action, and the honest state is a sentence.
 *
 * The heading was serif and is Geist now — serif is the wordmark's voice
 * only, per the AGENTS.md floors.
 */
export default function PublishingPage() {
  return (
    <AppShell active="publishing">
      <div className="mx-auto w-full max-w-2xl flex-1 py-8">
        <VStack gap={3} align="start">
          <Heading level={1}>Publishing</Heading>
          <Text as="p" type="body" color="secondary">
            This is where you'll connect the accounts you post to — TikTok, YouTube, Instagram — and
            send clips straight from your library.
          </Text>
          <Text as="p" type="body" color="secondary">
            None of those connections exist yet. Until they do, every clip in your library downloads
            as a ready-to-post MP4.
          </Text>
          <Button label="Go to your clips" variant="primary" size="sm" href="/clips" />
        </VStack>
      </div>
    </AppShell>
  )
}
