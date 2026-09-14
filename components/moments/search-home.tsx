"use client"

import { useRef, useState, type DragEvent } from "react"
import { Paperclip } from "lucide-react"
import { VIDEO_ACCEPT, type UploadEntry } from "@/components/flow/upload-package"
import { Button } from "@/components/space/button"
import { UploadTray } from "@/components/start/composer-attachments"
import { askGate } from "@/components/start/ask-gate"
import type { Video } from "@/lib/types"
import { AskComposer } from "./ask-composer"

/**
 * Search home — the first of the three screens in the owner's prototype
 * (2026-09-14): one statement, one composer, a few ways of asking.
 *
 * The composer is the whole screen. A video is attached to it — through
 * the paperclip, or dropped onto the card — and becomes what the question
 * is asked of. There is no upload panel and no wizard: the thumbnails of
 * the files on their way sit inside the card, so a large file in flight,
 * or one that failed, is never out of sight (the owner's call of
 * 2026-09-10, kept).
 *
 * The rule the box keeps, whatever it looks like: you can type before the
 * video has landed, and only the SEND waits — for the bytes, and then for
 * the server to say it takes questions. A search already running is never
 * on this screen: its results are, with their own box.
 */
export interface SearchHomeProps {
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
 * Ways of asking, to show the range — a thing seen, words spoken, a place.
 * They fill the box rather than send: an example is a way of phrasing,
 * and there is nothing to search until a video is attached.
 */
const EXAMPLES = [
  "Find the moment the crowd realises what happened",
  "Every time someone says “let’s go”",
  "Where the car pulls out of the driveway",
]

export function SearchHome({
  entries,
  video,
  promptValue,
  onPromptChange,
  onAdd,
  onRemove,
  onRetry,
  onSubmit,
  disabled,
}: SearchHomeProps) {
  const picker = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const [dragging, setDragging] = useState(false)

  const gate = askGate(video)
  const ready = gate.accepting && !disabled
  // "Still uploading" is only true of a file that IS uploading: with nothing
  // picked yet, or only a refused pick in the tray, nothing is promised.
  const onItsWay = Boolean(video) || entries.some((entry) => entry.phase === "queued" || entry.phase === "uploading")
  const waitingOn = !ready && onItsWay ? gate.waitingOn : null

  const placeholder = dragging ? "Drop the video to attach it…" : (onItsWay && gate.placeholder) || "Ask for a moment…"

  const pick = (files: File[]) => {
    if (files.length > 0) onAdd(files)
  }

  // Drop-to-attach on the card itself, with no container to speak of: the
  // hidden input owns the click path, the card owns the drag surface.
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    if (!Array.from(event.dataTransfer.types).includes("Files")) return
    event.preventDefault()
    setDragging(true)
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    setDragging(false)
    if (disabled) return
    event.preventDefault()
    pick(Array.from(event.dataTransfer.files))
  }

  return (
    <div className="w-full max-w-[640px]" data-testid="search-home">
      <h1 className="mb-9 text-center text-[clamp(30px,4.5vw,44px)] font-medium leading-[1.15] tracking-[-0.02em] text-foreground">
        We&rsquo;re teaching search to watch video.
      </h1>

      <div onDragOver={onDragOver} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <input
          ref={picker}
          type="file"
          accept={VIDEO_ACCEPT}
          multiple
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            // So picking the same file twice still fires a change — a retry
            // after a failed upload is exactly that.
            event.target.value = ""
            pick(files)
          }}
        />
        <AskComposer
          size="home"
          value={promptValue}
          onChange={onPromptChange}
          onSubmit={() => {
            if (ready) onSubmit?.()
          }}
          placeholder={placeholder}
          label="Search your footage"
          sendLabel="Search"
          disabled={disabled}
          canSend={ready}
          dragging={dragging}
          textareaRef={box}
          drawer={
            entries.length > 0 ? (
              <div className="px-2.5 pt-2.5" data-testid="attached-videos">
                <UploadTray entries={entries} onRemove={onRemove} onRetry={onRetry} />
              </div>
            ) : undefined
          }
          actions={
            <Button
              variant="ghost"
              disabled={disabled}
              onClick={() => picker.current?.click()}
              className="h-9 rounded-full px-3 text-[13px] font-normal text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="size-[15px]" />
              {entries.length > 0 ? "Attach another" : "Attach video"}
            </Button>
          }
        />
      </div>

      {/* Reserved height, so the line arriving does not move the examples. */}
      <p className="mt-3 min-h-5 text-center text-[13px] text-muted-foreground" aria-live="polite">
        {waitingOn}
      </p>

      <div className="mt-3 flex flex-col items-center gap-0.5">
        {EXAMPLES.map((example) => (
          <Button
            key={example}
            variant="link"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onPromptChange(example)
              box.current?.focus()
            }}
            className="font-normal text-muted-foreground no-underline hover:text-foreground hover:no-underline"
          >
            {example}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * The same box under the results, for the next question of the same video.
 * A search already running takes no second question; the box says so and
 * waits, rather than queueing one the server would refuse.
 */
export function FollowUpComposer({
  video,
  promptValue,
  onPromptChange,
  onSubmit,
  disabled,
  searching,
}: {
  video: Video | null
  promptValue: string
  onPromptChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  searching: boolean
}) {
  const gate = askGate(video)
  const ready = gate.accepting && !disabled && !searching
  return (
    <AskComposer
      size="thread"
      value={promptValue}
      onChange={onPromptChange}
      onSubmit={() => {
        if (ready) onSubmit()
      }}
      placeholder={searching ? "Still looking…" : (gate.placeholder ?? "Ask for another moment…")}
      label="Ask for another moment"
      sendLabel="Search"
      disabled={disabled || searching}
      canSend={ready}
    />
  )
}
