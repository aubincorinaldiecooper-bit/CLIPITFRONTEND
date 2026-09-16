"use client"

import { useEffect, useRef, useState, type DragEvent } from "react"
import { Globe2, Paperclip } from "lucide-react"
import { toast } from "sonner"
import { VIDEO_ACCEPT, type UploadEntry } from "@/components/flow/upload-package"
import { Button } from "@/components/space/button"
import { ThumbFrame, UploadTray } from "@/components/start/composer-attachments"
import {
  askAboutVideoGate,
  askGate,
  askTarget,
  shouldRemindForMissingVideo,
  WEB_SEARCH_PARAM,
} from "@/components/start/ask-gate"
import { videoLabel } from "@/components/start/moments"
import { readSearchParam, writeSearchParams } from "@/lib/search-params"
import type { Video } from "@/lib/types"
import { AskComposer } from "./ask-composer"

export interface SearchHomeProps {
  entries: UploadEntry[]
  video?: Video | null
  promptValue: string
  onPromptChange: (value: string) => void
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onSubmit?: () => void
  onReplace?: () => void
  onDetach?: () => void
  disabled?: boolean
}

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
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)

  const attaching = entries.length > 0

  /**
   * Home owns the source choice. With no saved choice, footage is the
   * default. The small URL bit is deliberate: StartPage already asks
   * `askTarget` which backend to call, so the mode crosses that boundary
   * without teaching the page about this control.
   */
  useEffect(() => {
    if (video || attaching) {
      setWebSearchEnabled(false)
      writeSearchParams({ [WEB_SEARCH_PARAM]: null }, "replace")
      return
    }
    const saved = readSearchParam(WEB_SEARCH_PARAM)
    const enabled = saved === "1"
    setWebSearchEnabled(enabled)
    if (saved === null) writeSearchParams({ [WEB_SEARCH_PARAM]: "0" }, "replace")
  }, [video, attaching])

  const gate = askGate(video, { attaching })
  const target = askTarget(video, { attaching, internetEnabled: webSearchEnabled })
  const ready = gate.accepting && !disabled
  const onItsWay =
    Boolean(video) || entries.some((entry) => entry.phase === "queued" || entry.phase === "uploading")
  const attached = video && !entries.some((entry) => entry.videoId === video.id) ? video : null
  const waitingOn = !ready && onItsWay ? gate.waitingOn : null

  const placeholder = dragging
    ? "Drop the video to attach it…"
    : (onItsWay && gate.placeholder) ||
      (target === "internet" ? "Search the internet for a moment…" : "Ask for a moment…")

  const pick = (files: File[]) => {
    const file = files[0]
    if (!file) return
    setWebSearchEnabled(false)
    writeSearchParams({ [WEB_SEARCH_PARAM]: null }, "replace")
    if (entries.length > 0 || attached) onReplace?.()
    onAdd([file])
  }

  const toggleWebSearch = () => {
    if (disabled || video || attaching) return
    const next = !webSearchEnabled
    setWebSearchEnabled(next)
    writeSearchParams({ [WEB_SEARCH_PARAM]: next ? "1" : "0" }, "replace")
  }

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
            event.target.value = ""
            pick(files)
          }}
        />
        <AskComposer
          size="home"
          value={promptValue}
          onChange={onPromptChange}
          onSubmit={() => {
            if (!ready) return
            if (shouldRemindForMissingVideo(video, { attaching, internetEnabled: webSearchEnabled })) {
              toast("You forgot your video")
              return
            }
            onSubmit?.()
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
            <>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() => picker.current?.click()}
                className="h-9 rounded-full px-3 text-[13px] font-normal text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="size-[15px]" />
                {entries.length > 0 || attached ? "Replace video" : "Attach video"}
              </Button>
              <Button
                variant={webSearchEnabled ? "secondary" : "ghost"}
                disabled={disabled || Boolean(video) || attaching}
                aria-pressed={webSearchEnabled}
                onClick={toggleWebSearch}
                className="h-9 rounded-full px-3 text-[13px] font-normal"
              >
                <Globe2 className="size-[15px]" />
                Web search
              </Button>
            </>
          }
        />
      </div>

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
