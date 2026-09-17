"use client"

import { useEffect, useRef, useState, type DragEvent } from "react"
import { Globe2, Paperclip } from "lucide-react"
import { motion } from "motion/react"
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
    <div className="w-full max-w-[760px]" data-testid="search-home">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="mb-3 text-center text-[12px] font-medium tracking-[0.14em] text-[#7f91a4] uppercase">Clipit</p>
        <h1 className="mx-auto max-w-[680px] text-center text-[clamp(34px,5vw,54px)] font-medium leading-[1.05] tracking-[-0.035em] text-[#122033]">
          What do you want to find?
        </h1>
        <p className="mx-auto mt-4 max-w-[520px] text-center text-[15px] leading-relaxed text-[#718197]">
          Search what happens in video — from your footage or across the web.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mt-9"
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
                className="h-9 rounded-full px-3 text-[13px] font-normal text-[#718197] hover:bg-[#f1f7fc] hover:text-[#26374a]"
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
                    ? "h-9 rounded-full border border-[#c7e8ff] bg-[#eaf7ff] px-3 text-[13px] font-medium text-[#265476] hover:bg-[#e1f3ff]"
                    : "h-9 rounded-full px-3 text-[13px] font-normal text-[#718197] hover:bg-[#f1f7fc] hover:text-[#26374a]"
                }
              >
                <Globe2 className="size-[15px]" />
                Web search
              </Button>
            </>
          }
        />
      </motion.div>

      <p className="mt-3 min-h-5 text-center text-[13px] text-[#8797a8]" aria-live="polite">
        {waitingOn}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {EXAMPLES.map((example, index) => (
          <motion.div key={example} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + index * 0.04 }}>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onPromptChange(example)
                box.current?.focus()
              }}
              className="rounded-full border-[#dfe8f1] bg-white px-3.5 font-normal text-[#687b8f] shadow-[0_4px_14px_rgba(61,90,120,0.04)] hover:border-[#cbe5f8] hover:bg-[#f9fcff] hover:text-[#2e4157]"
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
