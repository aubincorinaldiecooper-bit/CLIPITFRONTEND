"use client"

import { ArrowRight, Send, Video as VideoIcon } from "lucide-react"
import { UploadPackage, type UploadEntry } from "@/components/flow/upload-package"
import type { Video } from "@/lib/types"
import { askGate } from "./ask-gate"
import { cn } from "@/lib/utils"

export interface UploadStepProps {
  entries: UploadEntry[]
  video?: Video | null
  promptValue: string
  onPromptChange: (value: string) => void
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onSubmit?: () => void
  onResume?: () => void
  disabled?: boolean
  /** A search is already running for this instruction; the prompt becomes read-only and the action resumes watching. */
  searchInstruction?: string
}

/**
 * Step 01: upload a video and ask for moments. The upload container shows a
 * preview of the video once it lands; the prompt input sits below it and stays
 * inactive until the video is ready for search. Nothing else: the owner's
 * call (2026-09-02) is a clean landing page — no suggested questions under
 * the box, no step rail above it.
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
  onResume,
  disabled,
  searchInstruction,
}: UploadStepProps) {
  const isSearching = searchInstruction !== undefined
  // A question can be sent as soon as the upload has landed: the answer
  // waits, inside the search, for the video to be prepared, and the
  // dialogue says so. The gate and its words are decided in one place.
  const gate = askGate(video)
  const ready = (gate.accepting && !disabled) || isSearching
  /** Preparation failed: nothing here will ever become sendable, so no promise is made. */
  const failed = video?.status === "failed"
  // A file that has been picked is a video that is coming. The row for it
  // only exists once the bytes have landed, which for a long film is minutes
  // — and those minutes are exactly when a person wants to type. A pick that
  // FAILED is not coming: it needs a retry or removal, and promising that it
  // will be ready is the same false promise a failed video makes.
  const somethingToAskAbout = !failed && (video != null || entries.some((entry) => entry.phase !== "failed"))
  const trimmed = promptValue.trim()
  const displayValue = isSearching ? searchInstruction : promptValue

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
            if (isSearching) {
              onResume?.()
              return
            }
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
            value={displayValue}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && ready && (trimmed || isSearching)) {
                event.preventDefault()
                if (isSearching) onResume?.()
                else onSubmit?.()
              }
            }}
            // Typing is allowed the moment there is a video, even while it is
            // still uploading or being read. Only SENDING waits for ready — the
            // line below the box has promised exactly that, and the field used
            // to contradict it.
            disabled={!somethingToAskAbout || disabled || isSearching}
            placeholder={somethingToAskAbout ? "Tell Clipit what to look for..." : "Upload a video first..."}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!ready || (trimmed === "" && !isSearching)}
            aria-label={isSearching ? "Resume search" : "Search"}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition active:scale-95",
              ready && (trimmed !== "" || isSearching)
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isSearching ? <ArrowRight size={17} /> : <Send size={17} />}
          </button>
        </form>

        {somethingToAskAbout && gate.waitingOn && (
          <p className="text-center text-xs text-muted-foreground">{gate.waitingOn}</p>
        )}
      </div>
    </div>
  )
}
