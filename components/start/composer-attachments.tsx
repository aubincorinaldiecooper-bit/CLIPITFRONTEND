"use client"

import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { UploadEntry } from "@/components/flow/upload-package"
import { cn } from "@/lib/utils"

/**
 * The videos on their way up, as thumbnails inside the search composer —
 * ported from the composer the owner drafted for a new home page
 * (9 September) and kept through the search screens of 2026-09-14.
 *
 * The look is theirs: 48px rounded thumbnails that arrive one after
 * another, and a remove control that fades in under the cursor. The spring
 * curve is theirs too — cubic-bezier(0.175, 0.885, 0.32, 1.275).
 *
 * The remove control is a sibling of the thumbnail button rather than a
 * span inside it: a button cannot contain a button, and a `tabIndex={-1}`
 * span could not be reached by keyboard at all.
 *
 * The picture tray and viewer that shared this file went with the dialogue
 * they were drafted for: pictures never reached a search (createClipRequest
 * posts the words alone), so nothing on the migrated screens offers them.
 *
 * Motion is not special-cased for reduced-motion visitors: the guard in
 * globals.css sets transition-duration and animation-duration with
 * `!important`, which overrides the inline durations below.
 */

const SPRING = "cubic-bezier(0.175, 0.885, 0.32, 1.275)"

function ThumbFrame({
  index,
  label,
  removeLabel,
  onOpen,
  onRemove,
  children,
}: {
  index: number
  label: string
  removeLabel: string
  /** Absent for something that cannot be opened yet, such as a file still uploading. */
  onOpen?: (from: DOMRect) => void
  onRemove: () => void
  children: React.ReactNode
}) {
  const thumb = useRef<HTMLButtonElement>(null)
  const openable = onOpen !== undefined

  return (
    <span
      className="group relative inline-flex shrink-0 animate-in fade-in zoom-in-90 slide-in-from-top-3"
      style={{ animationDelay: `${index * 35}ms`, animationFillMode: "backwards", animationDuration: "400ms" }}
    >
      <button
        ref={thumb}
        type="button"
        disabled={!openable}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (thumb.current && onOpen) onOpen(thumb.current.getBoundingClientRect())
        }}
        className={cn(
          "relative size-12 overflow-hidden border border-border bg-muted outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-ring",
          openable && "hover:scale-[1.04] active:scale-[0.96]",
          !openable && "cursor-default",
        )}
        // Set here, not as a class: the drawer rounds buttons to a circle, and
        // the draft's thumbnails are rounded squares.
        style={{ transitionTimingFunction: SPRING, borderRadius: 12 }}
        aria-label={label}
      >
        {children}
      </button>

      {/* Sibling, not a child: a button inside a button is invalid, and the
          draft's version could not be reached by keyboard. */}
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRemove}
        className={cn(
          "absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-background/90 text-foreground/70 shadow-sm outline-none transition-all duration-200",
          "opacity-0 scale-50 pointer-events-none",
          "group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto",
          "focus-visible:opacity-100 focus-visible:scale-100 focus-visible:pointer-events-auto focus-visible:ring-2 focus-visible:ring-ring",
          "hover:bg-background hover:text-foreground hover:scale-110",
        )}
        style={{ transitionTimingFunction: SPRING }}
        aria-label={removeLabel}
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-2.5" />
      </button>
    </span>
  )
}

/**
 * A file on its way up, drawn as itself.
 *
 * What was here before was two lines of grey text under the box — a filename,
 * a percentage, and a sentence explaining that you could type while you
 * waited. The owner's call of 2026-09-10: that is a log line, not feedback.
 * A person who has just handed over a two-gigabyte film wants to see the
 * film.
 *
 * So the video draws its own first frame, at the same 48px the draft's
 * picture thumbnails use, with a spinner over it while the bytes are moving.
 *
 * The frame comes from the file itself — a `<video>` with `preload="metadata"`
 * paints frame one and nothing is fetched beyond the header. No canvas, no
 * poster to generate, and it works before a single byte has reached the
 * server, which is the entire window this thing exists to cover.
 */
function UploadThumb({
  entry,
  index,
  onRemove,
  onRetry,
}: {
  entry: UploadEntry
  index: number
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}) {
  /**
   * One URL per file, released when this thumbnail goes.
   *
   * Keyed on the file rather than the entry: a retry keeps the same File and
   * should keep the same frame rather than flicker through a fresh decode.
   */
  const [source, setSource] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(entry.file)
    setSource(url)
    return () => URL.revokeObjectURL(url)
  }, [entry.file])

  const failed = entry.phase === "failed"
  const done = entry.phase === "ready"
  const percent = Math.round((entry.progress ?? 0) * 100)

  // The percentage is not drawn — the owner asked for a spinner — but it is
  // the one fact a screen reader cannot get from a spinning circle, so it
  // goes in the label rather than being thrown away with the text line.
  const said = failed
    ? `${entry.file.name} — ${entry.error ?? "upload failed"}`
    : done
      ? `${entry.file.name} — uploaded`
      : `${entry.file.name} — uploading, ${percent}%`

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <ThumbFrame
        index={index}
        label={said}
        removeLabel={`Remove ${entry.file.name}`}
        onRemove={() => onRemove(entry.id)}
      >
        {source ? (
          <video
            src={source}
            preload="metadata"
            muted
            playsInline
            disablePictureInPicture
            aria-hidden
            className={cn("size-full object-cover", failed && "opacity-40")}
          />
        ) : null}

        {/* Dimmed while it is still going, so the spinner reads against any
            frame — a bright sky and a night shot both sit under this. */}
        {!done && !failed && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="size-5 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin" />
          </span>
        )}

        {failed && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-destructive/25 text-destructive">
            <HugeiconsIcon icon={Alert02Icon} className="size-5" />
          </span>
        )}
      </ThumbFrame>

      {/* A failure still needs a way out. It is the one case the thumbnail
          cannot carry on its own: "it broke" is visible, "why, and what now"
          is not. */}
      {failed && (
        <button
          type="button"
          onClick={() => onRetry(entry.id)}
          className="rounded-md px-1 text-[11px] text-destructive underline underline-offset-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
      )}
    </span>
  )
}

/**
 * Everything on its way up, in the composer's drawer slot.
 *
 * Same row, same spacing and same thumbnails as the picture tray beside the
 * moments — one vocabulary for "a file is attached to this box", whichever
 * screen you are on.
 */
export function UploadTray({
  entries,
  onRemove,
  onRetry,
}: {
  entries: UploadEntry[]
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}) {
  return (
    <span className="flex items-start gap-2 overflow-x-auto">
      {entries.map((entry, index) => (
        <UploadThumb key={entry.id} entry={entry} index={index} onRemove={onRemove} onRetry={onRetry} />
      ))}
    </span>
  )
}
