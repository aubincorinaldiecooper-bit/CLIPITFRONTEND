"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Notice } from "@/components/workspace/notice"
import { api, ApiError } from "@/lib/api"
import { charWidthFactor, LINE_HEIGHT_RATIO, maxCharsPerLine, usableWidthFraction, wrapCaptionText } from "@/lib/captions"
import type { Clip, ClipCaption } from "@/lib/types"

/**
 * The caption editor: text on the footage, moved by hand.
 *
 * The canvas IS the editor. Click a caption to select it, drag it anywhere on
 * the frame, drag a corner to size it, double-click to type into it — the way
 * a design tool works, and the way the owner asked for it. There is no
 * position slider, because position is where you put it.
 *
 * The canvas and the text on it are the media carve-out: hand-built, because
 * their styles ARE the user's data — the colour, the face and the size being
 * previewed are the ones about to be burned in. Everything around them is
 * Astryx: the contextual Toolbar, the font Selector (each option drawn in its
 * own face), the size NumberInput, the colour Popover, the outline toggle.
 *
 * Positions and sizes are percentages of the frame, so the preview means the
 * same thing at any resolution, and the wrap is computed with the SAME budget
 * the renderer uses (lib/captions.ts mirrors the backend) — including the
 * fact that text near an edge has less room than text in the middle.
 */

const FONT_STACKS: Record<ClipCaption["font"], { family: string; weight: number }> = {
  // Liberation faces are metrically Arial/Times-compatible, so these
  // stand-ins preview honestly.
  sans: { family: "Arial, Helvetica, sans-serif", weight: 400 },
  bold: { family: "Arial, Helvetica, sans-serif", weight: 700 },
  serif: { family: "Georgia, 'Times New Roman', serif", weight: 400 },
  mono: { family: "'Courier New', Courier, monospace", weight: 400 },
}

const FONT_CHOICES: Array<{ value: ClipCaption["font"]; label: string }> = [
  { value: "sans", label: "Clean" },
  { value: "bold", label: "Bold" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
]

const COLORS: Array<{ value: string; label: string }> = [
  { value: "#ffffff", label: "White" },
  { value: "#111113", label: "Black" },
  { value: "#fcd34d", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#60a5fa", label: "Blue" },
  { value: "#4ade80", label: "Green" },
]

/** How close to the centre line a drag snaps, in % of the frame. */
const SNAP_TOLERANCE = 1.2
/** Movement under this many pixels is a click, not a drag. */
const DRAG_THRESHOLD = 3
/** The widest a text column may be — the renderer's own budget. */
const MAX_COLUMN_PCT = 92
const MIN_COLUMN_PCT = 5

function freshCaption(): ClipCaption {
  return {
    text: "Your caption",
    font: "bold",
    sizePct: 6,
    color: "#ffffff",
    yPct: 85,
    xPct: 50,
    // Narrower than the frame on purpose: a box that starts at full width
    // has nowhere to grow, so dragging a corner could only ever re-wrap the
    // text instead of scaling it.
    widthPct: 60,
    outline: true,
  }
}

/** Where a caption sits and how big its box is, all in % of the frame. */
function measure(caption: ClipCaption, aspectRatio: number) {
  const xPct = caption.xPct ?? 50
  const column = caption.widthPct ?? MAX_COLUMN_PCT
  const maxChars = maxCharsPerLine(caption.font, caption.sizePct, aspectRatio, xPct, column)
  const lines = wrapCaptionText(caption.text, maxChars)
  // The box IS the column, full stop. It does NOT narrow near the frame's
  // edge: position clamping keeps the whole box inside instead, the way a
  // design tool stops a box at the canvas edge. (Narrowing here once made
  // the edge stop collapse — text could slide to the very edge, re-wrapped
  // into a sliver of vertical words.) A box wider than the frame allows
  // simply cannot leave the middle; narrow it with a side handle to move it.
  const widthPct = column
  const heightPct = Math.min(98, lines.length * caption.sizePct * LINE_HEIGHT_RATIO)
  return { lines, widthPct, heightPct, xPct, column }
}

/**
 * Keep a caption inside the frame, the same way the renderer's clamp does —
 * so a caption can be dragged to the edge but never off it, and the preview
 * never shows a position the render would quietly correct.
 */
function clampIntoFrame(caption: ClipCaption, aspectRatio: number): ClipCaption {
  const bound = (value: number, half: number) =>
    half >= 48 ? 50 : Math.min(98, Math.max(2, Math.min(99 - half, Math.max(1 + half, value))))
  // The column alone decides how far sideways the box can go — bound x
  // FIRST, then measure the wrapped height at that legal x. Measuring at
  // the requested x instead let a far-off-frame drag shrink the wrap budget
  // to a sliver for one frame, so the block's height ballooned and the
  // vertical clamp yanked the caption to the middle.
  const halfWidth = (caption.widthPct ?? MAX_COLUMN_PCT) / 2
  const xPct = bound(caption.xPct ?? 50, halfWidth)
  const { heightPct } = measure({ ...caption, xPct }, aspectRatio)
  return { ...caption, xPct, yPct: bound(caption.yPct, heightPct / 2) }
}

const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * A caption saved before boxes had a width arrives with none. Give it the
 * width its text actually uses — the box hugs the words, Canva's shape — so
 * it can be dragged sideways. Renders identically: the budget covers the
 * widest line it already wraps to, with a whisker of margin so rounding
 * can't cut a character.
 */
function withNaturalColumn(caption: ClipCaption, aspectRatio: number): ClipCaption {
  if (caption.widthPct !== undefined) return caption
  const lines = wrapCaptionText(
    caption.text,
    maxCharsPerLine(caption.font, caption.sizePct, aspectRatio, caption.xPct ?? 50, MAX_COLUMN_PCT),
  )
  const widest = Math.max(1, ...lines.map((line) => line.length))
  const natural = (widest * charWidthFactor(caption.font) * caption.sizePct) / aspectRatio
  return {
    ...caption,
    widthPct: Math.min(MAX_COLUMN_PCT, Math.max(MIN_COLUMN_PCT, Math.ceil(natural * 10) / 10 + 0.1)),
  }
}

export function CaptionEditor({
  clipId,
  onDone,
  onRenderStarted,
  isBusyElsewhere = false,
}: {
  clipId: string
  onDone: (outcome: { mode: "new" | "replace"; clipId: string }) => void
  /** A render was accepted; the page follows it even if this closes. */
  onRenderStarted?: (targetClipId: string) => void
  /** A render started here earlier is still running. */
  isBusyElsewhere?: boolean
}) {
  const [clip, setClip] = useState<Clip | null>(null)
  const [failed, setFailed] = useState(false)
  const [captions, setCaptions] = useState<ClipCaption[]>([])
  const captionsRef = useRef<ClipCaption[]>([])
  captionsRef.current = captions
  const [selected, setSelected] = useState<number | null>(0)
  const [editing, setEditing] = useState<number | null>(null)
  const [guides, setGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false })
  /** True mid-drag/mid-resize; the selection's action pill hides then. */
  const [interacting, setInteracting] = useState(false)
  const [saving, setSaving] = useState<"new" | "replace" | null>(null)
  const [rendering, setRendering] = useState<string | null>(null)
  /** The source's real shape, learned from the video itself; 16:9 until known. */
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  /**
   * Put keyboard focus back on a caption box. Selecting one by pointer has
   * to do this explicitly (the drag suppresses the browser's own focus), and
   * so does leaving typing — otherwise arrows and Delete would go nowhere
   * after the very interactions that make you want them.
   */
  const focusCaption = (index: number) => {
    requestAnimationFrame(() => {
      // Never pull focus out of a caret: by the time this frame runs, the
      // same click may already have opened typing on this caption.
      if (document.activeElement instanceof HTMLTextAreaElement) return
      const box = canvasRef.current?.querySelector<HTMLElement>(`[data-caption="${index}"]`)
      box?.focus()
    })
  }
  /**
   * Undo (Cmd/Ctrl+Z): snapshots of the caption list, taken at the start of
   * every gesture that changes it — a drag, a resize, a delete, an add, a
   * style change, entering typing. Direct manipulation without undo means
   * one slip of Backspace destroys a caption someone placed and styled.
   */
  const historyRef = useRef<ClipCaption[][]>([])
  const redoRef = useRef<ClipCaption[][]>([])
  // The stacks live in refs (pointer handlers need the live values), and
  // these mirror their depths so the Undo/Redo buttons know when to dim.
  const [historyDepth, setHistoryDepth] = useState(0)
  const [redoDepth, setRedoDepth] = useState(0)
  const syncDepths = () => {
    setHistoryDepth(historyRef.current.length)
    setRedoDepth(redoRef.current.length)
  }
  const snapshot = () => captionsRef.current.map((caption) => ({ ...caption }))
  const pushHistory = () => {
    historyRef.current.push(snapshot())
    if (historyRef.current.length > 50) historyRef.current.shift()
    // A new gesture forks the timeline: what was undone stays undone.
    redoRef.current = []
    syncDepths()
  }
  const restore = (state: ClipCaption[]) => {
    setCaptions(state)
    setEditing(null)
    setSelected((index) => (index !== null && index < state.length ? index : state.length ? 0 : null))
  }
  const undo = () => {
    const previous = historyRef.current.pop()
    if (!previous) return
    redoRef.current.push(snapshot())
    restore(previous)
    syncDepths()
  }
  const redo = () => {
    const next = redoRef.current.pop()
    if (!next) return
    historyRef.current.push(snapshot())
    restore(next)
    syncDepths()
  }
  /** True while the editor is open; the render poll checks it so a finished
   *  render never acts on a modal that was closed mid-wait. */
  const aliveRef = useRef(true)

  const frame = aspectRatio ?? 16 / 9

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  /**
   * Escape steps back one layer at a time — out of typing, then out of the
   * selection — and only closes the modal once there is nothing left to step
   * out of. Without this, one Escape while typing threw away every caption
   * on the clip, because the Dialog took it as "close".
   *
   * It listens on window in the capture phase so it runs before the Dialog's
   * own handler, which is registered on the document beneath it.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+Z undoes the last gesture; add Shift to redo it. While
      // typing, the browser's own text undo applies instead.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (editing !== null || document.activeElement instanceof HTMLTextAreaElement) return
        if (document.activeElement instanceof HTMLInputElement) return
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      // Canva's T: add a text box, as long as nothing is being typed into.
      if (
        (event.key === "t" || event.key === "T") &&
        !event.metaKey && !event.ctrlKey && !event.altKey &&
        editing === null &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement) &&
        !(document.activeElement instanceof HTMLSelectElement)
      ) {
        event.preventDefault()
        addCaptionAt(50, 50)
        return
      }
      if (event.key !== "Escape") return
      if (editing !== null) {
        event.preventDefault()
        event.stopPropagation()
        setEditing(null)
        const caption = captions[editing]
        if (caption && caption.text.trim().length === 0) remove(editing)
        else focusCaption(editing)
      } else if (selected !== null) {
        event.preventDefault()
        event.stopPropagation()
        setSelected(null)
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, selected, captions])

  useEffect(() => {
    let cancelled = false
    void api
      .getClip(clipId)
      .then(({ clip: loaded }) => {
        if (cancelled) return
        setClip(loaded)
        // The source's true shape, from the backend's probe: the layout is
        // right from the first paint, file loaded or not.
        if (loaded.sourceWidth && loaded.sourceHeight) {
          setAspectRatio(loaded.sourceWidth / loaded.sourceHeight)
        }
        // Start from what the clip already carries, so "change the colour"
        // of an existing caption is editing, not retyping.
        const shape =
          loaded.sourceWidth && loaded.sourceHeight ? loaded.sourceWidth / loaded.sourceHeight : 16 / 9
        setCaptions(
          Array.isArray(loaded.captions) && loaded.captions.length > 0
            ? loaded.captions.map((caption) => withNaturalColumn(caption, shape))
            : [freshCaption()],
        )
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [clipId])

  /** Poll the render until it is ready or honestly failed. */
  const waitForRender = async (targetId: string, mode: "new" | "replace") => {
    for (let attempt = 0; attempt < 48; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      if (!aliveRef.current) return
      try {
        const { clip: current } = await api.getClip(targetId)
        if (!aliveRef.current) return
        if (current.status === "ready" && !current.error) {
          toast.success(
            mode === "new"
              ? "Saved — the captioned clip is in your library."
              : "Replaced — the clip now carries these captions.",
          )
          onDone({ mode, clipId: targetId })
          return
        }
        // A replace that fails hands the working clip back as 'ready' with the
        // error recorded, so "ready with an error" is a failure, not a success.
        if (current.status === "failed" || (current.status === "ready" && current.error)) {
          setRendering(null)
          setSaving(null)
          toast.error(
            mode === "replace" && current.status === "ready"
              ? `The render failed and your clip is unchanged. ${current.error ?? ""}`.trim()
              : current.error ?? "The render failed. Try again.",
          )
          return
        }
      } catch {
        // A dropped poll is not a failed render; keep waiting.
      }
    }
    setRendering(null)
    setSaving(null)
    toast.error("The render is taking unusually long. Check your library in a minute.")
  }

  const save = async (mode: "new" | "replace") => {
    if (saving || isBusyElsewhere) return
    setSaving(mode)
    try {
      const { clip: target } = await api.captionClip(clipId, { mode, captions })
      // The page takes ownership of the wait from here, so closing this
      // modal never loses the clip that is being made.
      onRenderStarted?.(target.id)
      setRendering(mode === "new" ? "Rendering your new clip…" : "Re-rendering this clip…")
      await waitForRender(target.id, mode)
    } catch (cause) {
      setSaving(null)
      toast.error(cause instanceof ApiError ? cause.message : "Couldn't start the render. Try again.")
    }
  }

  /** A toolbar change is its own gesture: snapshot, then apply. */
  const styleUpdate = (index: number, change: Partial<ClipCaption>) => {
    pushHistory()
    update(index, change)
  }

  const update = (index: number, change: Partial<ClipCaption>) => {
    setCaptions((current) =>
      current.map((caption, i) => (i === index ? clampIntoFrame({ ...caption, ...change }, frame) : caption)),
    )
  }

  const duplicate = (index: number) => {
    const caption = captions[index]
    if (!caption || captions.length >= 6) return
    pushHistory()
    // The copy lands slightly below, so it is visibly its own thing.
    const copy = clampIntoFrame({ ...caption, yPct: caption.yPct + 6 }, frame)
    setCaptions((current) => [...current, copy])
    setSelected(captions.length)
    focusCaption(captions.length)
  }

  const remove = (index: number) => {
    pushHistory()
    setCaptions((current) => current.filter((_, i) => i !== index))
    setSelected(null)
    setEditing(null)
  }

  /**
   * Double-clicking empty frame adds text right there — the canvas is the
   * "add" affordance, since a modal has no side panel to offer one. The new
   * box opens straight into typing; abandoning it empty removes it again
   * (commitEdit), so a stray double-click costs nothing.
   */
  const addCaptionAt = (xPct: number, yPct: number) => {
    if (captions.length >= 6) {
      toast.info("Six pieces of text is the most one clip can carry.")
      return
    }
    pushHistory()
    let next = clampIntoFrame({ ...freshCaption(), text: "", xPct: round1(xPct), yPct: round1(yPct) }, frame)
    // Never land exactly on an existing box (pressing T twice would stack
    // twins) — step down until the spot is free.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const covered = captions.some(
        (existing) =>
          Math.abs((existing.xPct ?? 50) - (next.xPct ?? 50)) < 3 && Math.abs(existing.yPct - next.yPct) < 3,
      )
      if (!covered) break
      next = clampIntoFrame({ ...next, yPct: next.yPct + 7 }, frame)
    }
    setCaptions((current) => [...current, next])
    setSelected(captions.length)
    setEditing(captions.length)
  }

  /**
   * Drag the caption itself: both axes, snapping to the centre lines.
   *
   * Nothing moves until the pointer has travelled a few pixels, so clicking
   * a caption to select it cannot nudge it — and a press on an unselected
   * caption both selects it and starts the move, in one gesture.
   */
  const beginDrag = (index: number) => (event: React.PointerEvent<HTMLElement>) => {
    if (editing === index) return
    event.preventDefault()
    event.stopPropagation()
    const wasSelected = selected === index
    setSelected(index)
    // Only a NEW selection takes focus. A press on the caption that already
    // had it is either a drag or the click that opens typing, and stealing
    // focus back would close the caret the same frame it appeared.
    if (!wasSelected) focusCaption(index)
    const canvas = canvasRef.current?.getBoundingClientRect()
    const caption = captions[index]
    if (!canvas || !caption) return

    const startX = event.clientX
    const startY = event.clientY
    const originX = caption.xPct ?? 50
    const originY = caption.yPct
    const element = event.currentTarget
    let moving = false
    element.setPointerCapture(event.pointerId)

    const move = (pointer: PointerEvent) => {
      const dx = pointer.clientX - startX
      const dy = pointer.clientY - startY
      if (!moving) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        // The drag is real, starting now: one snapshot for the whole
        // gesture (per-move snapshots made undo pop invisible micro-steps).
        moving = true
        setInteracting(true)
        pushHistory()
      }
      // Shift locks the drag to whichever axis it has travelled furthest on.
      const lockY = pointer.shiftKey && Math.abs(dx) < Math.abs(dy)
      const lockX = pointer.shiftKey && !lockY
      let x = lockY ? originX : originX + (dx / canvas.width) * 100
      let y = lockX ? originY : originY + (dy / canvas.height) * 100
      const snapX = Math.abs(x - 50) < SNAP_TOLERANCE
      const snapY = Math.abs(y - 50) < SNAP_TOLERANCE
      if (snapX) x = 50
      if (snapY) y = 50
      setGuides({ x: snapX, y: snapY })
      update(index, { xPct: round1(x), yPct: round1(y) })
    }
    const stop = (pointer: PointerEvent) => {
      element.releasePointerCapture?.(pointer.pointerId)
      element.removeEventListener("pointermove", move)
      element.removeEventListener("pointerup", stop)
      element.removeEventListener("pointercancel", stop)
      setGuides({ x: false, y: false })
      setInteracting(false)
      // A click on a caption that was ALREADY selected puts the caret in it,
      // the way a second click does in a design tool.
      if (!moving && wasSelected) {
        pushHistory()
        setEditing(index)
      }
    }
    element.addEventListener("pointermove", move)
    element.addEventListener("pointerup", stop)
    element.addEventListener("pointercancel", stop)
  }

  /**
   * Handles, and the two kinds do different jobs — the distinction a design
   * tool makes:
   *
   * - a CORNER scales the text: the size and the column grow together, so
   *   the same words stay on the same lines and only get bigger;
   * - a SIDE narrows or widens the column alone, so the text re-wraps.
   */
  const beginResize =
    (index: number, kind: "scale" | "column") => (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      setSelected(index)
      const canvas = canvasRef.current?.getBoundingClientRect()
      const caption = captions[index]
      if (!canvas || !caption) return

      const centreX = canvas.left + ((caption.xPct ?? 50) / 100) * canvas.width
      const centreY = canvas.top + (caption.yPct / 100) * canvas.height
      const startSize = caption.sizePct
      // The column the box is actually DRAWN at, which is what the text
      // wraps to. Scaling from the stored value instead would break the
      // "same words on the same lines" promise whenever the box sits close
      // enough to an edge for the frame to be the narrower constraint.
      const startColumn = measure(caption, frame).widthPct
      const room = usableWidthFraction(caption.xPct ?? 50) * 100
      const startDistance = Math.max(
        8,
        kind === "scale"
          ? Math.hypot(event.clientX - centreX, event.clientY - centreY)
          : Math.abs(event.clientX - centreX),
      )
      const element = event.currentTarget
      element.setPointerCapture(event.pointerId)
      setInteracting(true)
      pushHistory()

      const move = (pointer: PointerEvent) => {
        const distance =
          kind === "scale"
            ? Math.hypot(pointer.clientX - centreX, pointer.clientY - centreY)
            : Math.abs(pointer.clientX - centreX)
        const wanted = distance / startDistance

        if (kind === "column") {
          update(index, {
            widthPct: Math.min(MAX_COLUMN_PCT, Math.max(MIN_COLUMN_PCT, round1(startColumn * wanted))),
          })
          return
        }

        // Scaling moves the size and the column by the SAME factor, so the
        // line budget (their ratio) never changes and the words stay put.
        // Both stop at whichever bound is reached first — the text simply
        // stops growing, the way it stops at the edge of a canvas.
        const ceiling = Math.min(
          15 / startSize,
          Math.min(MAX_COLUMN_PCT, room) / startColumn,
        )
        const floor = Math.max(2 / startSize, MIN_COLUMN_PCT / startColumn)
        const factor = Math.min(ceiling, Math.max(floor, wanted))
        update(index, {
          sizePct: round1(startSize * factor),
          widthPct: round1(startColumn * factor),
        })
      }
      const stop = (pointer: PointerEvent) => {
        element.releasePointerCapture?.(pointer.pointerId)
        element.removeEventListener("pointermove", move)
        element.removeEventListener("pointerup", stop)
        element.removeEventListener("pointercancel", stop)
        setInteracting(false)
      }
      element.addEventListener("pointermove", move)
      element.addEventListener("pointerup", stop)
      element.addEventListener("pointercancel", stop)
    }

  /** Arrow keys nudge, Delete removes, Enter types, Escape steps back out. */
  const onCaptionKeyDown = (index: number) => (event: React.KeyboardEvent) => {
    if (editing === index) return
    const caption = captions[index]
    if (!caption) return
    const step = event.shiftKey ? 2 : 0.5
    const nudge = (change: Partial<ClipCaption>) => {
      event.preventDefault()
      update(index, change)
    }
    if (event.key === "ArrowLeft") nudge({ xPct: round1((caption.xPct ?? 50) - step) })
    else if (event.key === "ArrowRight") nudge({ xPct: round1((caption.xPct ?? 50) + step) })
    else if (event.key === "ArrowUp") nudge({ yPct: round1(caption.yPct - step) })
    else if (event.key === "ArrowDown") nudge({ yPct: round1(caption.yPct + step) })
    else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault()
      remove(index)
    } else if (event.key === "Enter") {
      event.preventDefault()
      pushHistory()
      setEditing(index)
    } else if (event.key === "Escape") {
      setSelected(null)
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
      event.preventDefault()
      duplicate(index)
    }
  }

  /** Leaving edit mode: empty text means the box was abandoned. */
  const commitEdit = (index: number) => {
    setEditing(null)
    const caption = captions[index]
    if (caption && caption.text.trim().length === 0) remove(index)
  }

  if (failed) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this clip. Refresh to try again.</p>
  }
  if (clip === null) {
    return <Skeleton className="h-[320px] w-full rounded-xl" />
  }

  const current = selected !== null ? captions[selected] : undefined

  return (
    <div className="flex flex-col gap-3">
      {/* The Dialog's own header carries the title; this row holds the
          working subtitle and the two ways out. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13px] text-muted-foreground">
          {isBusyElsewhere
            ? "A render from this clip is still running — it'll land in your library when it's done."
            : "Drag text to place it. Double-click to type — on empty space to add more."}
        </p>
        <div className="flex items-center gap-2">
          <Button
            disabled={captions.length === 0 || isBusyElsewhere || saving !== null}
            onClick={() => void save("new")}
          >
            {saving === "new" ? "Saving…" : "Save as new clip"}
          </Button>
          {clip.canReplace && (
            <Button
              variant="secondary"
              disabled={isBusyElsewhere || saving !== null}
              onClick={() => void save("replace")}
            >
              {saving === "replace" ? "Replacing…" : "Replace this clip"}
            </Button>
          )}
        </div>
      </div>

      {rendering && (
        <Notice
          tone="success"
          title={rendering}
          description="The text is being drawn onto the footage from the original source. This usually takes a few seconds."
        />
      )}

      {/* The bar and the frame share one column, so the controls sit
          directly over the thing they control rather than floating wider
          than it. */}
      <div className="mx-auto w-full" style={{ maxWidth: `calc(52vh * ${frame})` }}>
      <div className="flex flex-col gap-2">
      {/* The contextual bar: what it shows depends on what is selected, but
          its height never changes, so nothing below it moves when you click
          a caption (the no-reflow rule). */}
      <div
        role="toolbar"
        aria-label="Caption style"
        className="flex min-h-[46px] items-center justify-between gap-2 rounded-xl bg-shcard px-2 py-1 ring-1 ring-shborder"
      >
        {current && selected !== null ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* The font, each choice drawn in its own face. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Font" className="w-[104px] justify-between">
                  <span
                    style={{
                      fontFamily: FONT_STACKS[current.font].family,
                      fontWeight: FONT_STACKS[current.font].weight,
                    }}
                  >
                    {FONT_CHOICES.find((choice) => choice.value === current.font)?.label}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="shadcn-scope" align="start">
                {FONT_CHOICES.map((choice) => (
                  <DropdownMenuItem
                    key={choice.value}
                    onSelect={() => styleUpdate(selected, { font: choice.value })}
                    style={{
                      fontFamily: FONT_STACKS[choice.value].family,
                      fontWeight: FONT_STACKS[choice.value].weight,
                      fontSize: "15px",
                    }}
                  >
                    {choice.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Text size, % of the frame's height — the renderer's unit. */}
            <input
              type="number"
              aria-label="Text size, % of frame height"
              min={2}
              max={15}
              step={0.5}
              value={current.sizePct}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value)) styleUpdate(selected, { sizePct: Math.min(15, Math.max(2, value)) })
              }}
              className="h-8 w-[72px] rounded-md border border-shborder bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />

            {/* The colour well. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Text colour" title="Text colour">
                  <ColorChip color={current.color} isSelected={false} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="shadcn-scope w-auto p-2" align="start">
                <div className="flex items-center gap-1">
                  {COLORS.map((color) => (
                    <Button
                      key={color.value}
                      variant="ghost"
                      size="icon-sm"
                      aria-label={color.label}
                      title={color.label}
                      onClick={() => styleUpdate(selected, { color: color.value })}
                    >
                      <ColorChip color={color.value} isSelected={current.color === color.value} />
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* The dark outline that keeps text readable over bright footage. */}
            <Button
              variant={current.outline ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={current.outline}
              onClick={() => styleUpdate(selected, { outline: !current.outline })}
            >
              Outline
            </Button>
          </div>
        ) : (
          <p className="px-1 text-[13px] text-muted-foreground">
            {captions.length === 0
              ? "Double-click the clip to add text."
              : "Click text on the clip to restyle it — double-click empty space to add more."}
          </p>
        )}

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={historyDepth === 0} onClick={undo}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={redoDepth === 0} onClick={redo}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m15 14 5-5-5-5" />
              <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
            </svg>
          </Button>
        </div>
      </div>

      {/* The canvas: the media carve-out. Its width is capped by HEIGHT so a
          portrait clip cannot push the toolbar and the buttons off-screen. */}
      <div
        ref={canvasRef}
        onPointerDown={(event) => {
          // A press on the frame itself, not on a caption, deselects.
          if (event.target === event.currentTarget) {
            setSelected(null)
            setEditing(null)
          }
        }}
        onDoubleClick={(event) => {
          // Double-click on empty frame (anywhere that is not a caption —
          // the footage counts as empty) drops a new text box at that spot.
          if ((event.target as HTMLElement).closest?.("[data-caption]")) return
          const box = canvasRef.current?.getBoundingClientRect()
          if (!box || box.width === 0) return
          addCaptionAt(
            ((event.clientX - box.left) / box.width) * 100,
            ((event.clientY - box.top) / box.height) * 100,
          )
        }}
        className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-black ring-1 ring-black/15"
        style={{ containerType: "size", aspectRatio: frame }}
      >
        {!clip.url && (
          <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-[13px] text-white/55">
            {aspectRatio
              ? "The clip file isn't available to preview right now — the text still sits where it will be burned in."
              : "The clip file isn't available to preview right now — caption positions are approximate until it is."}
          </p>
        )}
        {clip.url && (
          <video
            src={clip.url}
            controls
            playsInline
            onLoadedMetadata={(event) => {
              const element = event.currentTarget
              if (element.videoWidth && element.videoHeight) {
                setAspectRatio(element.videoWidth / element.videoHeight)
              }
            }}
            className="absolute inset-0 h-full w-full"
          />
        )}

        {/* Centre guides, shown only while a drag is snapped to them. */}
        {guides.x && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-amber-400/80" />}
        {guides.y && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-amber-400/80" />}

        {captions.map((caption, index) => {
          const { lines, widthPct, heightPct, xPct } = measure(caption, frame)
          const isSelected = selected === index
          const isEditing = editing === index
          return (
            <div
              key={index}
              role="group"
              data-caption={index}
              aria-label={`Caption: ${caption.text}`}
              tabIndex={0}
              onPointerDown={beginDrag(index)}
              onDoubleClick={() => {
                setSelected(index)
                pushHistory()
                setEditing(index)
              }}
              onKeyDown={onCaptionKeyDown(index)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${
                isEditing ? "cursor-text" : "cursor-grab active:cursor-grabbing"
              } ${isSelected ? "outline outline-1 outline-amber-400" : "hover:outline hover:outline-1 hover:outline-amber-400/50"}`}
              style={{
                left: `${xPct}%`,
                top: `${caption.yPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
              }}
            >
              {isEditing ? (
                /* Typing happens on the canvas, in the caption's own face and
                   colour. The browser wraps while typing; the moment the box
                   is left, the renderer's own wrap takes over — which is what
                   will actually be burned. */
                <textarea
                  autoFocus
                  value={caption.text}
                  onChange={(event) => update(index, { text: event.target.value.slice(0, 200) })}
                  onBlur={() => commitEdit(index)}
                  className="h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-center outline-none"
                  style={{
                    color: caption.color,
                    fontFamily: FONT_STACKS[caption.font].family,
                    fontWeight: FONT_STACKS[caption.font].weight,
                    fontSize: `${caption.sizePct}cqh`,
                    lineHeight: LINE_HEIGHT_RATIO,
                  }}
                />
              ) : (
                <div
                  className="pointer-events-none h-full w-full text-center"
                  style={{
                    color: caption.color,
                    fontFamily: FONT_STACKS[caption.font].family,
                    fontWeight: FONT_STACKS[caption.font].weight,
                    fontSize: `${caption.sizePct}cqh`,
                    lineHeight: LINE_HEIGHT_RATIO,
                    WebkitTextStroke: caption.outline ? "0.04em rgba(0,0,0,0.85)" : undefined,
                    paintOrder: "stroke fill",
                  }}
                >
                  {/* The SAME wrap the renderer uses, so the lines on screen
                      are the lines burned in. These spans are the media
                      carve-out, not interface furniture: they ARE the burned
                      pixels being previewed, wearing the user's own font,
                      size and colour — an Astryx Text here would fight those
                      with theme typography tokens. */}
                  {lines.map((line, lineIndex) => (
                    <span key={lineIndex} className="block whitespace-pre">
                      {line}
                    </span>
                  ))}
                </div>
              )}

              {/* Canva's per-element actions ride WITH the selection: a
                  small floating pill above the box (below it when the box
                  is near the top), hidden while dragging so it never covers
                  the frame being aimed at. The style controls stay in the
                  toolbar; actions on the element live at the element. */}
              {isSelected && !isEditing && !interacting && (
                <div
                  className="absolute left-1/2 z-10 -translate-x-1/2"
                  style={caption.yPct - heightPct / 2 < 14 ? { top: "calc(100% + 8px)" } : { bottom: "calc(100% + 8px)" }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center gap-0.5 rounded-lg bg-shcard p-0.5 shadow-md ring-1 ring-shborder">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Duplicate"
                      title="Duplicate (Ctrl+D)"
                      disabled={captions.length >= 6}
                      onClick={() => duplicate(index)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="9" y="9" width="12" height="12" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete" title="Delete" onClick={() => remove(index)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </Button>
                  </div>
                </div>
              )}

              {/* Six handles: corners scale the type, sides re-wrap it. */}
              {isSelected && !isEditing && (
                <>
                  {(
                    [
                      ["-left-1 -top-1", "nwse-resize", "scale"],
                      ["-right-1 -top-1", "nesw-resize", "scale"],
                      ["-left-1 -bottom-1", "nesw-resize", "scale"],
                      ["-right-1 -bottom-1", "nwse-resize", "scale"],
                      ["-left-1 top-1/2 -translate-y-1/2", "ew-resize", "column"],
                      ["-right-1 top-1/2 -translate-y-1/2", "ew-resize", "column"],
                    ] as const
                  ).map(([position, cursor, kind]) => (
                    <span
                      key={position}
                      role="presentation"
                      onPointerDown={beginResize(index, kind)}
                      className={`absolute ${position} ${
                        kind === "column" ? "h-4 w-1.5 rounded-full" : "h-2.5 w-2.5 rounded-full"
                      } bg-white ring-1 ring-black/40`}
                      style={{ cursor }}
                    />
                  ))}
                </>
              )}
            </div>
          )
        })}
      </div>
      </div>
      </div>
    </div>
  )
}

/** A colour square: the swatch, kept to one place. */
function ColorChip({ color, isSelected }: { color: string; isSelected: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width: 16,
        height: 16,
        borderRadius: 4,
        background: color,
        boxShadow: isSelected ? "0 0 0 2px #f59e0b" : "inset 0 0 0 1px rgba(18,18,18,0.25)",
      }}
    />
  )
}
