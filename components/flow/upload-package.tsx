"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  RefreshIcon,
  SquareLock01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/**
 * Dropping several videos in at once — on the app's light look now.
 *
 * Modelled on the block the owner linked (beui.dev's file-upload), in its
 * Centered layout: one target, then a row per file underneath carrying its
 * name, what it is, and how it is getting on.
 *
 * The behaviour it keeps, because each piece earns its place:
 *
 *   - every file gets its OWN outcome. Uploading five and reporting one
 *     verdict would have to be wrong about at least one of them.
 *   - a failure is a row that says what went wrong and offers to try again,
 *     not a file that quietly vanishes.
 *   - remove works at any point, including mid-upload.
 *   - a file too large, or one over the limit, is refused with a reason on
 *     the row rather than dropped in silence.
 */

/** Where one file has got to. */
export type UploadPhase = "queued" | "uploading" | "ready" | "failed"

export type UploadEntry = {
  /** Stable per pick, so React keeps the row identity across re-renders. */
  id: string
  file: File
  phase: UploadPhase
  /** 0–1 while uploading; absent otherwise. */
  progress?: number
  /** Why it failed, in words a person can act on. */
  error?: string
  /** Set once the server has a video for this file. */
  videoId?: string
}

/**
 * The most files one drop will take.
 *
 * A guard against a folder of two hundred clips being dropped by accident,
 * not a considered product limit. Anything past it is refused with a reason
 * rather than silently ignored.
 */
export const MAX_FILES = 12

/**
 * The largest file this screen will start an upload for.
 *
 * A client-side guard and nothing more: the API issues a presigned PUT with no
 * size condition on it, so the server does not enforce a ceiling of its own.
 * Refusing here means a five-hour mistake fails in a second with a reason on
 * the row, instead of after a long upload. If a real server-side limit is
 * added, this should be made to match it rather than guessing again.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024

export function formatBytes(bytes: number | undefined): string | null {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return null
  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`
}

/** "MOV", from a filename. Falls back to the mime type, then to "Video". */
function fileKind(file: File): string {
  const dot = file.name.lastIndexOf(".")
  if (dot > 0 && dot < file.name.length - 1) return file.name.slice(dot + 1).toUpperCase()
  if (file.type.startsWith("video/")) return file.type.slice(6).toUpperCase()
  return "Video"
}

/** The line under a file's name: what it is, how big, and how it is doing. */
function statusLine(entry: UploadEntry): string {
  const parts = [fileKind(entry.file), formatBytes(entry.file.size)].filter(Boolean)
  if (entry.phase === "failed") parts.push(entry.error ?? "Upload failed")
  if (entry.phase === "queued") parts.push("Waiting")
  return parts.join(" · ")
}

/** A page in a frame with a play mark — the mark on every row. */
function FileGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M10.4 12.6v3.4l3-1.7-3-1.7Z" />
    </svg>
  )
}

/** How many are done, for the line under the heading. */
function readyCount(entries: UploadEntry[]): number {
  return entries.filter((entry) => entry.phase === "ready").length
}

export function UploadPackage({
  entries,
  onAdd,
  onRemove,
  onRetry,
  onOpen,
}: {
  entries: UploadEntry[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  /** Opening one that is ready. Absent while only one file is in flight. */
  onOpen?: (entry: UploadEntry) => void
}) {
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const full = entries.length >= MAX_FILES

  const take = (list: FileList | null) => {
    if (!list) return
    onAdd(Array.from(list))
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.length > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold">Upload package</h2>
          <span className="text-sm text-muted-foreground">
            {readyCount(entries)} of {entries.length} {entries.length === 1 ? "file" : "files"} ready
          </span>
        </div>
      )}

      <div
        onDragOver={(event) => {
          if (full) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (full) return
          take(event.dataTransfer.files)
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-shborder bg-shcard px-6 py-[4.75rem] text-center transition-colors",
          dragging && "border-ring bg-shaccent",
          full && "opacity-55",
        )}
      >
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-shmuted text-muted-foreground ring-1 ring-shborder">
          <HugeiconsIcon icon={Upload01Icon} className="size-9" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">
            {full ? "That's as many as one go takes" : "Drop videos to upload"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {full
              ? `${entries.length} of ${MAX_FILES} added — upload these, then add more`
              : "MP4, MOV, MKV, WebM — up to 6 hours each"}
          </p>
        </div>
        <Button
          size="lg"
          // Full is the only gate. It used to also disable while uploads ran,
          // which quietly disagreed with drag-and-drop — a drop mid-batch was
          // accepted while Browse refused. Adding to a running batch is fine:
          // every file runs its own upload and reports on its own row.
          disabled={full}
          onClick={() => fileInput.current?.click()}
        >
          Browse
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          // The whole point of this change: more than one at a time.
          multiple
          className="hidden"
          onChange={(event) => {
            take(event.target.files)
            // Cleared so picking the same file twice still fires a change.
            event.currentTarget.value = ""
          }}
        />
      </div>

      {entries.length > 0 ? (
        <ul className="flex list-none flex-col gap-2 p-0">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "rounded-[14px] bg-shcard px-4 py-3 ring-1 ring-shborder",
                entry.phase === "failed" && "ring-destructive/40",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-shmuted text-muted-foreground ring-1 ring-shborder"
                >
                  <FileGlyph className="h-5 w-5" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-medium">{entry.file.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {statusLine(entry)}
                  </span>
                  {/* The bar stays on a finished row, full and green, as the
                      reference keeps it — the owner's call. The colour is what
                      says "done", and a row that keeps its bar keeps the whole
                      list the same shape as it fills up rather than having
                      rows change height one by one. */}
                  {entry.phase !== "queued" && entry.phase !== "failed" && (
                    <span
                      role="progressbar"
                      aria-label={
                        entry.phase === "ready"
                          ? `${entry.file.name} uploaded`
                          : `Uploading ${entry.file.name}`
                      }
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round((entry.progress ?? 0) * 100)}
                      className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-shmuted"
                    >
                      <span
                        className={cn(
                          "block h-full rounded-full transition-[width] duration-200",
                          entry.phase === "ready" ? "w-full bg-emerald-600" : "bg-shprimary",
                        )}
                        style={
                          entry.phase === "ready"
                            ? undefined
                            : { width: `${Math.round((entry.progress ?? 0) * 100)}%` }
                        }
                      />
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {entry.phase === "ready" && (
                    <>
                      <span
                        aria-label={`${entry.file.name} is ready`}
                        role="status"
                        className="text-emerald-600"
                      >
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" />
                      </span>
                      {onOpen && (
                        <Button variant="secondary" size="sm" onClick={() => onOpen(entry)}>
                          Open
                        </Button>
                      )}
                    </>
                  )}
                  {entry.phase === "failed" && (
                    <>
                      <span
                        aria-label={`${entry.file.name} failed`}
                        role="status"
                        className="text-destructive"
                      >
                        <HugeiconsIcon icon={Alert02Icon} className="size-5" />
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Try ${entry.file.name} again`}
                        title="Try again"
                        onClick={() => onRetry(entry.id)}
                      >
                        <HugeiconsIcon icon={RefreshIcon} />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${entry.file.name}`}
                    title="Remove"
                    onClick={() => onRemove(entry.id)}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <HugeiconsIcon icon={SquareLock01Icon} className="size-4" />
          Your video is private and secure.
        </p>
      )}
    </div>
  )
}
