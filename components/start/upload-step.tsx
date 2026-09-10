"use client"

import { ChatComposerDrawer } from "@astryxdesign/core/Chat"
import { VIDEO_ACCEPT, type UploadEntry } from "@/components/flow/upload-package"
import { UploadTray } from "./composer-attachments"
import type { Video } from "@/lib/types"
import { AskComposer } from "./ask-composer"
import { askGate } from "./ask-gate"

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
 * Home: one box, and nothing else.
 *
 * The owner's call of 2026-09-10 — "the ONLY thing present on our home
 * screen is the same search input bar i shared". Two things had to change
 * for that sentence to be true, and the first attempt only did one of them:
 *
 *   1. **the drop container above the box is gone.** It was.
 *   2. **the box is the owner's box.** It was not. Home had a bar of its
 *      own — an outlined pill with a video glyph and a paper-plane — that
 *      predates the reference they shared, and stripping the container off
 *      it left the wrong bar looking tidier. It renders `AskComposer` now,
 *      the same component the moments screen asks in.
 *
 * **Uploading did not go with the container.** The bar takes video files
 * itself, by the owner's words in the same message: "the bar can hold video
 * files so 'upload' still exists, we're just removing the container". The
 * plus opens the same picker the container had and hands the files to the
 * same uploader.
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
  const isSearching = searchInstruction !== undefined
  // A question can be sent as soon as the upload has landed: the answer
  // waits, inside the search, for the video to be prepared, and the
  // dialogue says so. The gate and its words are decided in one place.
  const gate = askGate(video)
  const ready = (gate.accepting && !disabled) || isSearching
  /** Preparation failed: nothing here will ever become sendable, so no promise is made. */
  const failed = video?.status === "failed"

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <AskComposer
        value={isSearching ? searchInstruction : promptValue}
        onChange={onPromptChange}
        onSubmit={() => {
          if (isSearching) {
            onResume?.()
            return
          }
          if (ready) onSubmit?.()
        }}
        // The question can be written before a video is picked. Only SENDING
        // waits for an uploaded video; disabling the editor here made the
        // compact prompt open into a search bar nobody could type in.
        isDisabled={disabled || isSearching}
        // Typing and sending are two different gates here, and always were.
        canSend={ready}
        placeholder="Ask anything..."
        label="Search your footage"
        attach={{
          label: "Add a video",
          accept: VIDEO_ACCEPT,
          isDisabled: disabled || isSearching,
          onPick: onAdd,
        }}
        drawer={
          entries.length > 0 ? (
            <ChatComposerDrawer count={entries.length} label={entries.length === 1 ? "Video" : "Videos"}>
              <UploadTray entries={entries} onRemove={onRemove} onRetry={onRetry} />
            </ChatComposerDrawer>
          ) : undefined
        }
      />
    </div>
  )
}
