"use client"

import { useRef, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
import { Icon } from "@astryxdesign/core/Icon"
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { LockGlyph, UploadGlyph } from "@/components/glyphs"
import { ProgressBar } from "./step-shell"

interface SourceStepProps {
  onUpload: (file: File) => void
  onYoutube: (url: string) => void
  busy: boolean
  uploadFraction: number | null
}

/** Choose the source: a local file, or a public YouTube URL. */
export function SourceStep({ onUpload, onYoutube, busy, uploadFraction }: SourceStepProps) {
  const [tab, setTab] = useState<"upload" | "youtube">("upload")
  const [url, setUrl] = useState("")
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (uploadFraction !== null) {
    return (
      <div className="space-y-3">
        <ProgressBar percent={uploadFraction * 100} />
        <Text as="p" type="body" color="secondary">
          Uploading — {Math.round(uploadFraction * 100)}%
        </Text>
        <Text as="p" type="supporting">
          The file goes straight to storage, not through the API.
        </Text>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Centred under a centred heading. Left-aligned it read as the start of
          a form the rest of the page had not been told about. */}
      <HStack justify="center">
        <SegmentedControl value={tab} onChange={(value) => setTab(value as "upload" | "youtube")} label="Video source">
          <SegmentedControlItem value="upload" label="Upload a file" />
          <SegmentedControlItem value="youtube" label="YouTube URL" />
        </SegmentedControl>
      </HStack>

      {tab === "upload" ? (
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
          className={`flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-14 text-center transition-colors ${
            dragging ? "border-foreground/50 bg-white/[0.04]" : "border-white/15"
          }`}
        >
          {/* The mark first, then the words. An empty dashed rectangle with
              text in it reads as a form field; the arrow is what says a file
              goes here. */}
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-border">
            <Icon icon={UploadGlyph} size="lg" />
          </span>
          <VStack gap={1}>
            <Text as="p" type="body">Drop a video here</Text>
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
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (url.trim()) onYoutube(url.trim())
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            className="flex-1 rounded-full border border-white/15 bg-transparent px-5 py-2.5 text-sm outline-none placeholder:text-foreground/30 focus:border-foreground/40"
          />
          <Button
            type="submit"
            label={busy ? "Starting…" : "Fetch video"}
            variant="primary"
            isLoading={busy}
            isDisabled={!url.trim()}
          />
        </form>
      )}

      {/* The reassurance the mockup puts under the zone. It belongs to both
          tabs: a YouTube link is read into the same private library a file is,
          and someone weighing whether to hand over footage is asking the same
          question either way. */}
      <HStack gap={1.5} justify="center" align="center">
        <Icon icon={LockGlyph} size="sm" />
        <Text as="span" type="supporting">
          Your video is private and secure.
        </Text>
      </HStack>
    </div>
  )
}
