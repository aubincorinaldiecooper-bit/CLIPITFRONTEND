"use client"

import { useRef, useState, type DragEvent } from "react"
import { Paperclip } from "lucide-react"
import { VIDEO_ACCEPT, type UploadEntry } from "@/components/flow/upload-package"
import { Button } from "@/components/space/button"
import { ThumbFrame, UploadTray } from "@/components/start/composer-attachments"
import { askAboutVideoGate, askGate, askTarget } from "@/components/start/ask-gate"
import { videoLabel } from "@/components/start/moments"
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
 *
 * One video at a time. A question is asked of one video, so the box holds
 * one: picking or dropping another replaces it — the old row leaves the
 * tray and its transfer is stopped — rather than sitting beside it with no
 * way to be the one searched (Codex's finding on #95). Replacing is not
 * starting over: the words already typed stay (Devin's finding on #96).
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
  /** Another video is about to take the place of what is attached: let the old one go, rows and all, and keep the question. */
  onReplace?: () => void
  /** Take the video off the box and start again: the question goes with it. */
  onDetach?: () => void
  disabled?: boolean
}

/**
 * The video the question is asked of, when it did not arrive through the
 * tray — opened from the library, or come back to with Back — drawn from
 * its own watchable proxy, with the same frame and remove control as a
 * file on its way up. Without it the box would take a question about a
 * video nobody can see.
 */
function AttachedVideo({ video, onDetach }: { video: Video; onDetach?: () => void }) {
  const name = videoLabel(video)
  const source = video.playback?.proxyUrl ?? video.playback?.url ?? null
  return (
    <span className="flex items-start gap-2" data-testid="attached-video">
      <ThumbFrame index={0} label={`${name} — attached`} removeLabel={`Remove ${name}`} onRemove={() => onDetach?.()}>
        {source ? (
          <video src={source} preload="metadata" muted playsInline disablePictureInPicture aria-hidden className="size-full object-cover" />
        ) : (
          <span aria-hidden className="flex size-full items-center justify-center bg-shmuted px-1 text-center text-[9px] leading-tight text-muted-foreground">
            {name}
          </span>
        )}
      </ThumbFrame>
    </span>
  )
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
  onReplace,
  onDetach,
  disabled,
}: SearchHomeProps) {
  const picker = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const [dragging, setDragging] = useState(false)

  // Anything in the tray — on its way, or a pick that failed — means someone
  // meant to ask about a video. The box waits for it rather than quietly
  // searching the web with the words that were meant for their footage.
  const attaching = entries.length > 0
  const gate = askGate(video, { attaching })
  const target = askTarget(video, { attaching })
  const ready = gate.accepting && !disabled
  // "Still uploading" is only true of a file that IS uploading: with nothing
  // picked yet, or only a refused pick in the tray, nothing is promised.
  const onItsWay =
    Boolean(video) || entries.some((entry) => entry.phase === "queued" || entry.phase === "uploading")
  // A video in the tray is shown by its row; one that is not — opened from
  // the library, or the row taken away — is shown as itself.
  const attached = video && !entries.some((entry) => entry.videoId === video.id) ? video : null
  const waitingOn = !ready && onItsWay ? gate.waitingOn : null

  // With nothing attached there is no toggle to read, so the box itself says
  // what the question will be asked of.
  const placeholder = dragging
    ? "Drop the video to attach it…"
    : (onItsWay && gate.placeholder) ||
      (target === "internet" ? "Search the internet for a moment…" : "Ask for a moment…")

  // One video: the first file picked or dropped takes the place of whatever
  // was attached — the page lets the old one go, rows and all, and keeps the
  // question — and then the new one starts.
  const pick = (files: File[]) => {
    const file = files[0]
    if (!file) return
    if (entries.length > 0 || attached) onReplace?.()
    onAdd([file])
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
          label={target === "internet" ? "Search the internet" : "Search your footage"}
          sendLabel="Search"
          disabled={disabled}
          canSend={ready}
          dragging={dragging}
          textareaRef={box}
          drawer={
            entries.length > 0 || attached ? (
              <div className="flex items-start gap-2 px-2.5 pt-2.5" data-testid="attached-videos">
                {attached && <AttachedVideo video={attached} onDetach={onDetach} />}
                {entries.length > 0 && <UploadTray entries={entries} onRemove={onRemove} onRetry={onRetry} />}
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
              {entries.length > 0 || attached ? "Replace video" : "Attach video"}
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
  const gate = askAboutVideoGate(video)
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
