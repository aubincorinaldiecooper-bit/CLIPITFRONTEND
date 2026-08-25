"use client"

import { useRef, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
import { Heading } from "@astryxdesign/core/Heading"
import { Icon } from "@astryxdesign/core/Icon"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { LockGlyph, UploadGlyph } from "@/components/glyphs"
import { ProgressBar } from "./step-shell"

interface SourceStepProps {
  onUpload: (file: File) => void
  busy: boolean
  uploadFraction: number | null
}

/**
 * Where a video comes from: a file, dropped or chosen.
 *
 * There was a second way in — paste a public YouTube URL — behind a pair of
 * tabs above this zone. The owner removed it: the mockup has one way in, and
 * that is the direction. The tabs are gone and the zone is the whole screen's
 * business, which is what makes it worth this much room.
 *
 * The route that fetched a YouTube video is untouched on the server. Taking
 * the button away is a design decision; deleting the machinery behind it is a
 * separate one, and not something to do on the way past.
 */
export function SourceStep({ onUpload, busy, uploadFraction }: SourceStepProps) {
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (uploadFraction !== null) {
    return (
      <VStack gap={3} align="stretch">
        <ProgressBar percent={uploadFraction * 100} />
        <Text as="p" type="body" color="secondary">
          Uploading — {Math.round(uploadFraction * 100)}%
        </Text>
        <Text as="p" type="supporting">
          The file goes straight to storage, not through the API.
        </Text>
      </VStack>
    )
  }

  return (
    <VStack gap={4} align="stretch">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files?.[0]
          if (file) onUpload(file)
        }}
        className={`flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed px-6 py-16 text-center transition-colors ${
          dragging ? "border-foreground/50 bg-white/[0.04]" : "border-white/15"
        }`}
      >
        {/* The mark first, then the words. An empty dashed rectangle with text
            in it reads as a form field; the arrow is what says a file goes
            here. */}
        <span className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-surface text-primary ring-1 ring-border">
          <Icon icon={UploadGlyph} size="lg" />
        </span>
        <VStack gap={1}>
          {/* A heading, not body text — in the mockup this line is the second
              biggest thing on the screen after the page title. */}
          <Heading level={3} accessibilityLevel={2}>
            Drop a video here
          </Heading>
          <Text as="p" type="supporting">MP4, MOV, MKV, WebM — up to 6 hours</Text>
        </VStack>
        <Button label="Choose a file" variant="primary" isDisabled={busy} onClick={() => fileInput.current?.click()} />
        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
          }}
        />
      </div>

      <HStack gap={1.5} justify="center" align="center">
        <Icon icon={LockGlyph} size="sm" />
        <Text as="span" type="supporting">
          Your video is private and secure.
        </Text>
      </HStack>
    </VStack>
  )
}
