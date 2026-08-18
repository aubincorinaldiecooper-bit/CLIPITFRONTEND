"use client"

import { useRef, useState } from "react"
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
        <p className="text-sm text-foreground/60">
          Uploading — {Math.round(uploadFraction * 100)}%
        </p>
        <p className="text-xs text-foreground/40">
          The file goes straight to storage, not through the API.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-white/10 p-0.5 text-sm">
        {(["upload", "youtube"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              tab === value ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {value === "upload" ? "Upload a file" : "YouTube URL"}
          </button>
        ))}
      </div>

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
          <p className="text-sm text-foreground/70">Drop a video here</p>
          <p className="mt-1 text-xs text-foreground/40">MP4, MOV, MKV, WebM — up to 6 hours</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="mt-5 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-transform hover:scale-[1.03] disabled:opacity-50"
          >
            Choose a file
          </button>
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
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-transform hover:scale-[1.03] disabled:opacity-50"
          >
            {busy ? "Starting…" : "Fetch video"}
          </button>
        </form>
      )}
    </div>
  )
}
