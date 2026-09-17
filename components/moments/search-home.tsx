"use client"

import { useEffect, useRef, useState, type DragEvent } from "react"
import { Globe2, Plus } from "lucide-react"
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
  "Show me when the speaker points at the screen",
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
    <div className="w-full max-w-[900px]" data-testid="search-home">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="text-center">
        <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-full bg-[#ffd24a] text-[13px] font-semibold text-[#111827]">
          ci
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[#111318]">
          What do you want to find?
        </h1>
        <p className="mt-2 text-[15px] text-[#667085]">Ask about a video.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mt-8"
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
                size="icon"
                disabled={disabled}
                aria-label={entries.length > 0 || attached ? "Replace video" : "Attach video"}
                onClick={() => picker.current?.click()}
                className="size-9 rounded-full text-[#4b5563] hover:bg-[#eef0f2] hover:text-[#111318]"
              >
                <Plus className="size-[17px]" />
              </Button>
              <Button
                variant={webSearchEnabled ? "secondary" : "ghost"}
                disabled={disabled || Boolean(video) || attaching}
                aria-pressed={webSearchEnabled}
                onClick={toggleWebSearch}
                className={
                  webSearchEnabled
                    ? "h-9 rounded-xl border border-[#111318] bg-[#111318] px-3 text-[13px] font-medium text-white hover:bg-[#111318]/90"
                    : "h-9 rounded-xl border border-[#dfe2e6] bg-white px-3 text-[13px] font-medium text-[#333944] hover:bg-[#f6f7f8]"
                }
              >
                <Globe2 className="size-[15px]" />
                Web
              </Button>
            </>
          }
        />
      </motion.div>

      <p className="mt-3 min-h-5 text-center text-[13px] text-[#7a828d]" aria-live="polite">
        {waitingOn}
      </p>

      <div className="mx-auto mt-6 grid w-fit grid-cols-1 gap-2 sm:grid-cols-2">
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
              className="h-9 rounded-full border-[#dfe2e6] bg-white px-4 font-normal text-[#20242b] shadow-none hover:bg-[#f7f7f8]"
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
