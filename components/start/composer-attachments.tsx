"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { UploadEntry } from "@/components/flow/upload-package"
import { cn } from "@/lib/utils"

/**
 * The attachment tray and its picture viewer, ported from the composer the
 * owner drafted for a new home page (9 September).
 *
 * The look is theirs and is kept: 48px rounded thumbnails that arrive one
 * after another, a remove control that fades in under the cursor, and a
 * viewer that grows out of the thumbnail you clicked rather than appearing
 * over it. The spring curve is theirs too — cubic-bezier(0.175, 0.885, 0.32,
 * 1.275), the same one the rest of their draft used.
 *
 * Three things did not survive the port, each for a reason:
 *
 *  - The draft revoked every attachment's object URL inside an effect that
 *    re-ran whenever the attachment list changed, so adding a second picture
 *    ran the first effect's cleanup and broke the first thumbnail. The URLs
 *    are now released when an attachment is actually removed, and the rest on
 *    unmount only.
 *  - Its remove control was a `role="button"` span INSIDE the thumbnail
 *    button. A button cannot contain a button, and the span was
 *    `tabIndex={-1}`, so it could not be reached by keyboard at all. The two
 *    are siblings now, which looks identical and can be tabbed to.
 *  - Its viewer called `onClose` from `onTransitionEnd`, which fires once per
 *    property — five times here. It is guarded.
 *
 * Motion is not special-cased for reduced-motion visitors: the guard in
 * globals.css sets transition-duration and animation-duration with
 * `!important`, which overrides the inline durations below.
 */

export interface Attachment {
  id: string
  file: File
  url: string
  name: string
  width: number
  height: number
}

/** The owner's curve, kept from the draft. */
const SPRING = "cubic-bezier(0.175, 0.885, 0.32, 1.275)"

/**
 * Holds the picked pictures and their object URLs.
 *
 * A URL is released the moment its attachment goes, and whatever is left is
 * released on unmount — read from a ref so this effect never re-runs and
 * never revokes a URL a live thumbnail is still drawing.
 */
export function useAttachments(max: number) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  /**
   * The list itself, kept here and updated the moment anything changes.
   *
   * This used to be a copy of the rendered state, which made every operation
   * depend on React having caught up: two picks in one tick both saw the same
   * room left, and removing the same picture twice counted it gone twice.
   * Holding the real list here instead makes each of those a no-op the second
   * time — Devin's findings on #90, three rounds of them, all the same shape.
   */
  const live = useRef<Attachment[]>([])
  /** Rises once per picture kept, so two copies of one file differ. */
  const picked = useRef(0)

  /**
   * The only way the list changes: the ref and the render move together.
   *
   * Devin's fourth finding on #90, and the one that says most about the last
   * three. Making the ref authoritative fixed a family of races and left
   * `measure` still writing to the render alone, so the next add or remove
   * rebuilt from the ref and put the placeholder shape back over dimensions
   * the browser had already reported. One writer of four was wrong, which is
   * the sort of thing a rule cannot catch and a single door can.
   */
  const commit = useCallback((next: Attachment[]) => {
    live.current = next
    setAttachments(next)
  }, [])

  useEffect(() => {
    return () => {
      for (const attachment of live.current) URL.revokeObjectURL(attachment.url)
    }
  }, [])

  const add = useCallback(
    (files: File[]) => {
      const pictures = files.filter((file) => file.type.startsWith("image/"))
      if (pictures.length === 0) return

      const room = Math.max(0, max - live.current.length)
      const taken = pictures.slice(0, room)
      if (taken.length === 0) return

      const made = taken.map((file) => ({
        // A counter, not the file's own details. Devin's finding on #90: the
        // picker deliberately allows the same file twice, and keying on
        // name + date + size gave both copies one id — duplicate React keys,
        // removing either removed both, and one object URL was left behind.
        id: `picture-${(picked.current += 1)}`,
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        // Replaced once the picture reports its own size; the viewer needs a
        // shape to open into before the bytes have decoded.
        width: 4,
        height: 3,
      }))
      commit([...live.current, ...made])
    },
    [max, commit],
  )

  /** The picture decoded, so the viewer can open at its real proportions. */
  const measure = useCallback(
    (id: string, width: number, height: number) => {
      commit(live.current.map((attachment) => (attachment.id === id ? { ...attachment, width, height } : attachment)))
    },
    [commit],
  )

  const remove = useCallback((id: string) => {
    const going = live.current.find((attachment) => attachment.id === id)
    // Already gone. Asking twice does nothing the second time.
    if (!going) return
    URL.revokeObjectURL(going.url)
    commit(live.current.filter((attachment) => attachment.id !== id))
  }, [commit])

  const clear = useCallback(() => {
    for (const attachment of live.current) URL.revokeObjectURL(attachment.url)
    commit([])
  }, [commit])

  return { attachments, add, measure, remove, clear }
}

/**
 * The 48px rounded square and its hover-reveal remove control.
 *
 * Shared, because two things wear it now: a picture attached beside the
 * moments, and a video uploading from home. Everything about the shape is
 * the owner's draft — the size, the 12px radius, the staggered arrival, the
 * remove circle that fades in under the cursor, and their spring curve.
 */
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

function AttachmentThumb({
  attachment,
  index,
  onRemove,
  onOpen,
  onMeasured,
}: {
  attachment: Attachment
  index: number
  onRemove: (id: string) => void
  onOpen: (attachment: Attachment, from: DOMRect) => void
  onMeasured: (id: string, width: number, height: number) => void
}) {
  return (
    <ThumbFrame
      index={index}
      label={`Open ${attachment.name}`}
      removeLabel={`Remove ${attachment.name}`}
      onOpen={(from) => onOpen(attachment, from)}
      onRemove={() => onRemove(attachment.id)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.url}
        alt={attachment.name}
        draggable={false}
        className="size-full object-cover"
        onLoad={(event) => {
          const picture = event.currentTarget
          if (picture.naturalWidth > 0) onMeasured(attachment.id, picture.naturalWidth, picture.naturalHeight)
        }}
      />
    </ThumbFrame>
  )
}

/**
 * The viewer, opening out of the thumbnail rather than over it.
 *
 * It draws itself at the thumbnail's exact position and size, then moves to
 * the middle in one transition, so the picture appears to grow from where it
 * was clicked. Closing runs it backwards.
 */
function AttachmentViewer({
  attachment,
  from,
  onClose,
}: {
  attachment: Attachment
  from: DOMRect
  onClose: () => void
}) {
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening")
  const [target, setTarget] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const closed = useRef(false)

  // Recomputed whenever the picture's real shape arrives, so one opened
  // before it had decoded grows to the right size rather than staying at the
  // placeholder's.
  useEffect(() => {
    const widest = Math.min(window.innerWidth * 0.86, 560)
    const tallest = Math.min(window.innerHeight * 0.78, 720)
    const scale = Math.min(widest / attachment.width, tallest / attachment.height, 1.6)
    const width = attachment.width * scale
    const height = attachment.height * scale
    setTarget({ top: (window.innerHeight - height) / 2, left: (window.innerWidth - width) / 2, width, height })
  }, [attachment.width, attachment.height])

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhase("open"))
    return () => cancelAnimationFrame(frame)
  }, [])

  const finish = useCallback(() => {
    if (closed.current) return
    closed.current = true
    onClose()
  }, [onClose])

  /**
   * Devin's finding on #90: closing before the opening frame had run left the
   * geometry untouched, so no transition ever ended and the viewer sat over
   * the screen for ever. Nothing has moved yet at that point, so there is
   * nothing to play backwards — it just goes.
   */
  const startClosing = useCallback(() => {
    if (phase === "opening") {
      finish()
      return
    }
    setPhase("closing")
  }, [phase, finish])

  // And a floor under the animation, in case no transition reports back.
  useEffect(() => {
    if (phase !== "closing") return
    const timer = setTimeout(finish, 400)
    return () => clearTimeout(timer)
  }, [phase, finish])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") startClosing()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [startClosing])

  const isOpen = phase === "open" && target !== null
  const geometry = isOpen && target ? target : { top: from.top, left: from.left, width: from.width, height: from.height }
  const seconds = phase === "closing" ? "0.3s" : "0.45s"
  const easing = phase === "closing" ? "ease-out" : SPRING
  const move = ["top", "left", "width", "height", "border-radius"].map((p) => `${p} ${seconds} ${easing}`).join(", ")

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={attachment.name} onClick={startClosing}>
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-md transition-opacity duration-300"
        style={{ opacity: isOpen ? 1 : 0 }}
      />
      <div
        className="fixed overflow-hidden bg-muted"
        style={{
          top: geometry.top,
          left: geometry.left,
          width: geometry.width,
          height: geometry.height,
          borderRadius: isOpen ? 20 : 12,
          transition: move,
          boxShadow: isOpen ? "0 24px 60px -12px rgb(0 0 0 / 0.35)" : "none",
        }}
        onClick={(event) => event.stopPropagation()}
        onTransitionEnd={(event) => {
          // Fires once per property — five of them here. Only the last leg of
          // a close should unmount, and `finish` makes sure that is once.
          if (phase !== "closing" || event.propertyName !== "width") return
          finish()
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.url} alt={attachment.name} draggable={false} className="size-full object-cover" />
      </div>

      <button
        type="button"
        onClick={startClosing}
        style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? "scale(1)" : "scale(0.7)", transitionTimingFunction: SPRING }}
        className={cn(
          "fixed right-4 top-4 flex size-9 items-center justify-center rounded-full bg-card/90 text-foreground/70 shadow-md backdrop-blur-sm transition-all duration-300 hover:bg-card hover:text-foreground",
          !isOpen && "pointer-events-none",
        )}
        aria-label="Close picture"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
      </button>
    </div>
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

/** The row of thumbnails, for the composer's drawer slot. */
export function AttachmentTray({
  attachments,
  onRemove,
  onMeasured,
}: {
  attachments: Attachment[]
  onRemove: (id: string) => void
  onMeasured: (id: string, width: number, height: number) => void
}) {
  /**
   * Which picture is open, by id — not a copy of it.
   *
   * Devin's finding on #90: holding a copy froze whatever the attachment
   * looked like at the moment of the click. Open one before the browser had
   * decoded it and the copy still carried the 4x3 placeholder, so it grew to
   * about six pixels across and the real dimensions, measured a moment later,
   * never reached it. Reading it out of the list each render means the viewer
   * sees the picture as it is now.
   */
  const [viewing, setViewing] = useState<{ id: string; from: DOMRect } | null>(null)
  const shown = viewing ? (attachments.find((attachment) => attachment.id === viewing.id) ?? null) : null

  // A picture removed while open should not leave the viewer drawing a URL
  // that has been revoked.
  useEffect(() => {
    if (viewing && !attachments.some((attachment) => attachment.id === viewing.id)) setViewing(null)
  }, [attachments, viewing])

  return (
    <>
      <span className="flex items-start gap-2 overflow-x-auto">
        {attachments.map((attachment, index) => (
          <AttachmentThumb
            key={attachment.id}
            attachment={attachment}
            index={index}
            onRemove={onRemove}
            onMeasured={onMeasured}
            onOpen={(opened, from) => setViewing({ id: opened.id, from })}
          />
        ))}
      </span>
      {shown && viewing ? (
        <AttachmentViewer attachment={shown} from={viewing.from} onClose={() => setViewing(null)} />
      ) : null}
    </>
  )
}
