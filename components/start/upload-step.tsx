"use client"

import { Send, Video as VideoIcon } from "lucide-react"
import { UploadPackage, type UploadEntry } from "@/components/flow/upload-package"
import type { Video } from "@/lib/types"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  "Find me 3 moments I can post on TikTok",
  "Clip every time the energy peaks",
  "Find the part where they introduce themselves",
]

export interface UploadStepProps {
  entries: UploadEntry[]
  video?: Video | null
  promptValue: string
  onPromptChange: (value: string) => void
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onSubmit?: () => void
  disabled?: boolean
}

/**
 * Step 01: upload a video and ask for moments. The upload container shows a
 * preview of the video once it lands; the prompt input sits below it and stays
 * inactive until the video is ready for search.
 */
export function UploadStep({
  entries,
  video,
  promptValue,
  onPromptChange,
  onAdd,
  onRemove,
  onRetry,
  onSubmit,
  disabled,
}: UploadStepProps) {
  const ready = video?.readyForSearch === true && !disabled
  const trimmed = promptValue.trim()

  return (
    <div className="w-full max-w-md">
      <UploadPackage
        entries={entries}
        onAdd={onAdd}
        onRemove={onRemove}
        onRetry={onRetry}
        single
      />

      <div className="mt-6 flex flex-col gap-3">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (ready && trimmed) onSubmit?.()
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-full border-2 border-foreground bg-card px-4 py-3.5",
            !ready && "opacity-70",
          )}
        >
          <VideoIcon aria-hidden size={20} className="shrink-0 text-foreground" />
          <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
          <input
            value={promptValue}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && ready && trimmed) {
                event.preventDefault()
                onSubmit?.()
              }
            }}
            disabled={!ready}
            placeholder={video ? "Tell Clipit what to look for..." : "Upload a video first..."}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!ready || trimmed === ""}
            aria-label="Search"
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition active:scale-95",
              ready && trimmed !== ""
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Send size={17} />
          </button>
        </form>

        {video && !video.readyForSearch && (
          <p className="text-center text-xs text-muted-foreground">
            Your video is still being prepared — you can type now, then send once it&apos;s ready.
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              disabled={!ready}
              onClick={() => onPromptChange(text)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
