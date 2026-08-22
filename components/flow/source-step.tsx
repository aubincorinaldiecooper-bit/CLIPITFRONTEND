"use client"

import { useRef, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl"
import { Text } from "@astryxdesign/core/Text"
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
      <SegmentedControl value={tab} onChange={(value) => setTab(value as "upload" | "youtube")} label="Video source">
        <SegmentedControlItem value="upload" label="Upload a file" />
        <SegmentedControlItem value="youtube" label="YouTube URL" />
      </SegmentedControl>

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
          className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? "border-foreground/50 bg-white/[0.04]" : "border-white/15"
          }`}
        >
          <Text as="p" type="body">Drop a video here</Text>
          <Text as="p" type="supporting">MP4, MOV, MKV, WebM — up to 6 hours</Text>
          <span className="mt-5">
            <Button label="Choose a file" variant="primary" isDisabled={busy} onClick={() => fileInput.current?.click()} />
          </span>
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
    </div>
  )
}
