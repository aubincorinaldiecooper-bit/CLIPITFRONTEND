"use client"

import { useEffect, useRef, useState, type DragEvent } from "react"
import { Globe2, Paperclip } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
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
          <span aria-hidden className="flex size-full items-center justify-center bg-[#eef6fc] px-1 text-center text-[9px] leading-tight text-[#718197]">
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
  const onItsWay = Boolean(video) || entries.some((entry) => entry.phase === "queued" || entry.phase === "uploading")
  const attached = video && !entries.some((entry) => entry.videoId === video.id) ? video : null
  const waitingOn = !ready && onItsWay ? gate.waitingOn : null

  const placeholder = dragging
    ? "Drop the video to attach it…"
    : (onItsWay && gate.placeholder) || (target === "internet" ? "Search the internet for a moment…" : "Ask for a moment…")

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
    if (disabled || !Array.from(event.dataTransfer.types).includes("Files")) return
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
    <div className="w-full max-w-[660px] px-4 sm:px-0" data-testid="search-home">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="mb-6 flex flex-col items-center text-center"
      >
        <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-[#f1f4f6] text-[#111827] ring-1 ring-[#e5e7eb]">
          <Logo variant="mark" size={16} />
        </div>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.025em] text-[#111827] sm:text-[26px]">
          What do you want to find?
        </h1>
        <p className="mt-1.5 text-[14px] text-[#667085]">Ask a question about your footage or search across the web.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.03 }}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
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
                className="h-8 rounded-lg px-2.5 text-[13px] font-normal text-[#596579] hover:bg-[#f1f3f5] hover:text-[#1f2937]"
              >
                <Paperclip className="size-[15px]" />
                {entries.length > 0 || attached ? "Replace video" : "Attach video"}
              </Button>
              <Button
                variant={webSearchEnabled ? "secondary" : "ghost"}
                disabled={disabled || Boolean(video) || attaching}
                aria-pressed={webSearchEnabled}
                onClick={toggleWebSearch}
                className={
                  webSearchEnabled
                    ? "h-8 rounded-lg border border-[#dbe4ec] bg-white px-2.5 text-[13px] font-medium text-[#344054] hover:bg-[#f8fafc]"
                    : "h-8 rounded-lg px-2.5 text-[13px] font-normal text-[#596579] hover:bg-[#f1f3f5] hover:text-[#1f2937]"
                }
              >
                <Globe2 className="size-[15px]" />
                Web search
              </Button>
            </>
          }
        />
      </motion.div>

      <p className="mt-2 min-h-5 text-center text-[12px] text-[#8a94a3]" aria-live="polite">
        {waitingOn}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {EXAMPLES.map((example, index) => (
          <motion.div key={example} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 + index * 0.035 }}>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onPromptChange(example)
                box.current?.focus()
              }}
              className="h-8 rounded-full border-[#e2e5e9] bg-white px-3.5 text-[12.5px] font-normal text-[#4b5565] shadow-none hover:bg-[#f7f8fa] hover:text-[#1f2937]"
            >
              {example}
            </Button>
          </motion.div>
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
