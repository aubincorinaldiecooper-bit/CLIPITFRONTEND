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
 * The Clipit empty state is the conversation itself.
 *
 * A video is attached through the composer's plus button and becomes context
 * for the question. There is no separate upload panel or pre-search wizard to
 * walk through. Upload progress and failures remain in the composer's drawer
 * so the user never loses feedback about a large file in flight.
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
  const gate = askGate(video)
  const ready = (gate.accepting && !disabled) || isSearching

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
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
        isDisabled={disabled || isSearching}
        canSend={ready}
        placeholder="What do you want to find?"
        label="Search your footage"
        attach={{
          label: "Add a video",
          accept: VIDEO_ACCEPT,
          isDisabled: disabled || isSearching,
          onPick: onAdd,
        }}
        drawer={
          entries.length > 0 ? (
            <ChatComposerDrawer
              count={entries.length}
              label={entries.length === 1 ? "Video" : "Videos"}
              className="rounded-t-[28px] border border-b-0 border-border bg-muted"
            >
              <UploadTray entries={entries} onRemove={onRemove} onRetry={onRetry} />
            </ChatComposerDrawer>
          ) : undefined
        }
      />
    </div>
  )
}
