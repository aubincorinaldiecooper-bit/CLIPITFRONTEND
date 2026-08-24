"use client"

import { useEffect, useRef, useState } from "react"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Card } from "@astryxdesign/core/Card"
import { IconButton } from "@astryxdesign/core/IconButton"
import { NumberInput } from "@astryxdesign/core/NumberInput"
import { Popover } from "@astryxdesign/core/Popover"
import { Selector } from "@astryxdesign/core/Selector"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { ToggleButton } from "@astryxdesign/core/ToggleButton"
import { Toolbar } from "@astryxdesign/core/Toolbar"
import { useToast } from "@astryxdesign/core/Toast"
import { api, ApiError } from "@/lib/api"
import { LINE_HEIGHT_RATIO, maxCharsPerLine, usableWidthFraction, wrapCaptionText } from "@/lib/captions"
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
  // The box IS the text column: the same width the renderer wraps to, so
  // what the user drags is the shape that gets drawn.
  const widthPct = Math.min(column, usableWidthFraction(xPct) * 100)
  const heightPct = Math.min(98, lines.length * caption.sizePct * LINE_HEIGHT_RATIO)
  return { lines, widthPct, heightPct, xPct, column }
}

/**
 * Keep a caption inside the frame, the same way the renderer's clamp does —
 * so a caption can be dragged to the edge but never off it, and the preview
 * never shows a position the render would quietly correct.
 */
function clampIntoFrame(caption: ClipCaption, aspectRatio: number): ClipCaption {
  const { widthPct, heightPct, xPct } = measure(caption, aspectRatio)
  const halfWidth = widthPct / 2
  const halfHeight = heightPct / 2
  const bound = (value: number, half: number) =>
    half >= 48 ? 50 : Math.min(98, Math.max(2, Math.min(99 - half, Math.max(1 + half, value))))
  return { ...caption, xPct: bound(xPct, halfWidth), yPct: bound(caption.yPct, halfHeight) }
}

const round1 = (value: number) => Math.round(value * 10) / 10

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
  const [selected, setSelected] = useState<number | null>(0)
  const [editing, setEditing] = useState<number | null>(null)
  const [guides, setGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false })
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
  /** True while the editor is open; the render poll checks it so a finished
   *  render never acts on a modal that was closed mid-wait. */
  const aliveRef = useRef(true)
  const toast = useToast()

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
        setCaptions(
          Array.isArray(loaded.captions) && loaded.captions.length > 0 ? loaded.captions : [freshCaption()],
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
          toast({
            body:
              mode === "new"
                ? "Saved — the captioned clip is in your library."
                : "Replaced — the clip now carries these captions.",
          })
          onDone({ mode, clipId: targetId })
          return
        }
        // A replace that fails hands the working clip back as 'ready' with the
        // error recorded, so "ready with an error" is a failure, not a success.
        if (current.status === "failed" || (current.status === "ready" && current.error)) {
          setRendering(null)
          setSaving(null)
          toast({
            type: "error",
            body:
              mode === "replace" && current.status === "ready"
                ? `The render failed and your clip is unchanged. ${current.error ?? ""}`.trim()
                : current.error ?? "The render failed. Try again.",
          })
          return
        }
      } catch {
        // A dropped poll is not a failed render; keep waiting.
      }
    }
    setRendering(null)
    setSaving(null)
    toast({ type: "error", body: "The render is taking unusually long. Check your library in a minute." })
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
      toast({
        type: "error",
        body: cause instanceof ApiError ? cause.message : "Couldn't start the render. Try again.",
      })
    }
  }

  const update = (index: number, change: Partial<ClipCaption>) => {
    setCaptions((current) =>
      current.map((caption, i) => (i === index ? clampIntoFrame({ ...caption, ...change }, frame) : caption)),
    )
  }

  const remove = (index: number) => {
    setCaptions((current) => current.filter((_, i) => i !== index))
    setSelected(null)
    setEditing(null)
  }

  const addCaption = () => {
    const next = { ...freshCaption(), text: "New caption", yPct: 50 }
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
      if (!moving && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
      moving = true
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
      // A click on a caption that was ALREADY selected puts the caret in it,
      // the way a second click does in a design tool.
      if (!moving && wasSelected) setEditing(index)
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
      setEditing(index)
    } else if (event.key === "Escape") {
      setSelected(null)
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
      // Duplicate, offset a little so the copy is visibly its own thing.
      event.preventDefault()
      if (captions.length >= 6) return
      const copy = clampIntoFrame({ ...caption, yPct: caption.yPct + 6 }, frame)
      setCaptions((current) => [...current, copy])
      setSelected(captions.length)
    }
  }

  /** Leaving edit mode: empty text means the box was abandoned. */
  const commitEdit = (index: number) => {
    setEditing(null)
    const caption = captions[index]
    if (caption && caption.text.trim().length === 0) remove(index)
  }

  if (failed) {
    return <p className="text-sm text-error">Couldn't load this clip. Refresh to try again.</p>
  }
  if (clip === null) {
    return <Skeleton height={320} radius={3} />
  }

  const current = selected !== null ? captions[selected] : undefined

  return (
    <VStack gap={3} align="stretch">
      {/* The Dialog's own header carries the title; this row holds the
          working subtitle and the two ways out. */}
      <HStack justify="between" align="center" gap={4} wrap="wrap">
        <Text as="p" type="supporting" display="block">
          {isBusyElsewhere
            ? "A render from this clip is still running — it'll land in your library when it's done."
            : "Drag the text where it should sit. Double-click it to type."}
        </Text>
        <HStack gap={2} align="center">
          <Button
            label="Save as new clip"
            variant="primary"
            isLoading={saving === "new"}
            isDisabled={captions.length === 0 || isBusyElsewhere || (saving !== null && saving !== "new")}
            onClick={() => void save("new")}
          />
          {clip.canReplace && (
            <Button
              label="Replace this clip"
              variant="secondary"
              isLoading={saving === "replace"}
              isDisabled={isBusyElsewhere || (saving !== null && saving !== "replace")}
              onClick={() => void save("replace")}
            />
          )}
        </HStack>
      </HStack>

      {rendering && (
        <Banner
          status="info"
          title={rendering}
          description="The text is being drawn onto the footage from the original source. This usually takes a few seconds."
        />
      )}

      {/* The bar and the frame share one column, so the controls sit
          directly over the thing they control rather than floating wider
          than it. */}
      <div className="mx-auto w-full" style={{ maxWidth: `calc(52vh * ${frame})` }}>
      <VStack gap={2} align="stretch">
      {/* The contextual bar: what it shows depends on what is selected, but
          its height never changes, so nothing below it moves when you click
          a caption (the AGENTS.md no-reflow rule). */}
      <Card elevation="low" padding={1}>
        <Toolbar
          label="Caption style"
          size="sm"
          startContent={
            current ? (
              <HStack gap={1} align="center" wrap="wrap">
                <Selector
                  label="Font"
                  isLabelHidden
                  variant="ghost"
                  size="sm"
                  width={124}
                  value={current.font}
                  onChange={(value) => selected !== null && update(selected, { font: value as ClipCaption["font"] })}
                  options={FONT_CHOICES.map((choice) => ({ value: choice.value, label: choice.label }))}
                  renderOption={(option) => (
                    <span
                      style={{
                        fontFamily: FONT_STACKS[option.value as ClipCaption["font"]].family,
                        fontWeight: FONT_STACKS[option.value as ClipCaption["font"]].weight,
                        fontSize: "15px",
                      }}
                    >
                      {option.label}
                    </span>
                  )}
                />
                <NumberInput
                  label="Text size, % of frame height"
                  isLabelHidden
                  size="sm"
                  width={104}
                  hasNumberSteppers
                  min={2}
                  max={15}
                  step={0.5}
                  value={current.sizePct}
                  onChange={(value) => selected !== null && update(selected, { sizePct: value })}
                />
                <Popover
                  content={
                    <HStack gap={1} align="center" wrap="wrap">
                      {COLORS.map((color) => (
                        <IconButton
                          key={color.value}
                          label={color.label}
                          tooltip={color.label}
                          variant="ghost"
                          size="sm"
                          icon={<ColorChip color={color.value} isSelected={current.color === color.value} />}
                          onClick={() => selected !== null && update(selected, { color: color.value })}
                        />
                      ))}
                    </HStack>
                  }
                >
                  <IconButton
                    label="Text colour"
                    tooltip="Text colour"
                    variant="ghost"
                    size="sm"
                    icon={<ColorChip color={current.color} isSelected={false} />}
                  />
                </Popover>
                <ToggleButton
                  label="Outline"
                  size="sm"
                  isPressed={current.outline}
                  onPressedChange={(isPressed) => selected !== null && update(selected, { outline: isPressed })}
                />
              </HStack>
            ) : (
              <Text as="p" type="supporting" display="block">
                {captions.length === 0
                  ? "No text on this clip yet — add some."
                  : "Click the text on the clip to restyle it."}
              </Text>
            )
          }
          endContent={
            <HStack gap={1} align="center">
              {current && selected !== null && (
                <Button label="Delete" variant="ghost" size="sm" onClick={() => remove(selected)} />
              )}
              <Button
                label="Add text"
                variant="secondary"
                size="sm"
                isDisabled={captions.length >= 6}
                onClick={addCaption}
              />
            </HStack>
          }
        />
      </Card>

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
        className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-black ring-1 ring-white/10"
        style={{ containerType: "size", aspectRatio: frame }}
      >
        {!clip.url && (
          <Text as="p" type="supporting" display="block" className="pointer-events-none absolute inset-x-0 top-3 text-center">
            {aspectRatio
              ? "The clip file isn't available to preview right now — the text still sits where it will be burned in."
              : "The clip file isn't available to preview right now — caption positions are approximate until it is."}
          </Text>
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
        {guides.x && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-accent/70" />}
        {guides.y && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-accent/70" />}

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
                setEditing(index)
              }}
              onKeyDown={onCaptionKeyDown(index)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${
                isEditing ? "cursor-text" : "cursor-grab active:cursor-grabbing"
              } ${isSelected ? "outline outline-1 outline-accent" : ""}`}
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
      </VStack>
      </div>
    </VStack>
  )
}

/** A colour square: the swatch Astryx does not ship, kept to one place. */
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
        boxShadow: isSelected ? "0 0 0 2px var(--astryx-color-accent, #fcd34d)" : "inset 0 0 0 1px rgba(255,255,255,0.25)",
      }}
    />
  )
}
