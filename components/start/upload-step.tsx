"use client"

import { useRef } from "react"
import { ArrowRight, Paperclip, Send, Video as VideoIcon } from "lucide-react"
import { formatBytes, VIDEO_ACCEPT, type UploadEntry } from "@/components/flow/upload-package"
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

/** How far along, as a percentage, for the line under the box. */
const percent = (entry: UploadEntry) => Math.round((entry.progress ?? 0) * 100)

/**
 * Home: one box, and nothing else.
 *
 * The owner's call of 2026-09-10 — "the ONLY thing present on our home
 * screen is the same search input bar". The drop container that used to
 * stand above it is gone.
 *
 * **Uploading did not go with it.** The bar takes video files itself, by the
 * owner's words in the same message: "the bar can hold video files so
 * 'upload' still exists, we're just removing the container". The paperclip
 * opens the same picker the container had and hands the files to the same
 * uploader.
 *
 * What the container WAS carrying had to move here rather than disappear:
 *
 *   - **a file on its way.** The container drew a progress bar. Without one,
 *     picking a two-gigabyte film looked like pressing a button that did
 *     nothing, so the line under the box names the file and its percentage.
 *   - **a file that failed.** The container's row said why and offered to
 *     try again. A failure with nowhere to appear is the worse half of this:
 *     the person is left waiting for an upload that stopped. It gets the
 *     line under the box, with Try again and Remove.
 *
 * Both are one line, not a card. The owner asked for the box alone, and a
 * transient line under it is not a second container.
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
  const picker = useRef<HTMLInputElement>(null)
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
  const broken = entries.filter((entry) => entry.phase === "failed")
  const arriving = entries.find((entry) => entry.phase === "uploading" || entry.phase === "queued")

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col gap-3">
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
          {/*
            Decoration, and it stands down on a phone. With the container
            gone the placeholder is the ONLY instruction on an empty home
            screen — there is no line under the box until there is a video
            — and at 390px the glyph and its rule took 33 of the 166px the
            words had, cutting "Add a video, then ask" to "Add a video, th".
            Both carry aria-hidden, so nothing is lost but the ornament.
          */}
          <VideoIcon aria-hidden size={20} className="hidden shrink-0 text-foreground sm:block" />
          <span aria-hidden className="hidden h-6 w-px shrink-0 bg-border sm:block" />
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
            // The old words were "Upload a video first…", which named a
            // container that is no longer on the screen. These name the
            // paperclip beside them instead — and they are SHORT, because
            // the box is now the whole screen and the whole screen is
            // sometimes 390px wide: the first wording ran to "Add a video,
            // ther" on a phone, which tells nobody anything.
            placeholder={somethingToAskAbout ? "Tell Clipit what to look for..." : "Add a video, then ask"}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
          />
          <input
            ref={picker}
            type="file"
            accept={VIDEO_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])]
              // Cleared so picking the SAME file twice still fires change —
              // a retry after a failure is exactly that.
              event.target.value = ""
              if (files.length > 0) onAdd(files)
            }}
          />
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={disabled || isSearching}
            aria-label="Add a video"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground outline-none transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <Paperclip size={17} />
          </button>
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

        {arriving && (
          <p className="truncate text-center text-xs text-muted-foreground" data-testid="upload-progress">
            {arriving.phase === "queued"
              ? `${arriving.file.name} — waiting to upload`
              : `${arriving.file.name} — ${percent(arriving)}%${formatBytes(arriving.file.size) ? ` of ${formatBytes(arriving.file.size)}` : ""}`}
          </p>
        )}

        {broken.map((entry) => (
          <p key={entry.id} className="text-center text-xs text-destructive" data-testid="upload-failure">
            <span className="mr-2">
              {entry.file.name} — {entry.error ?? "Upload failed"}
            </span>
            <button
              type="button"
              onClick={() => onRetry(entry.id)}
              className="rounded-md px-2 py-1 underline underline-offset-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              className="rounded-md px-2 py-1 underline underline-offset-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              Remove
            </button>
          </p>
        ))}

        {somethingToAskAbout && gate.waitingOn && (
          <p className="text-center text-xs text-muted-foreground">{gate.waitingOn}</p>
        )}
      </div>
    </div>
  )
}
