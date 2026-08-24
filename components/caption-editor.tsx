"use client"

import { useEffect, useRef, useState } from "react"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { List, ListItem } from "@astryxdesign/core/List"
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { Slider } from "@astryxdesign/core/Slider"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Switch } from "@astryxdesign/core/Switch"
import { Text } from "@astryxdesign/core/Text"
import { TextInput } from "@astryxdesign/core/TextInput"
import { useToast } from "@astryxdesign/core/Toast"
import { api, ApiError } from "@/lib/api"
import { maxCharsPerLine, wrapCaptionText } from "@/lib/captions"
import type { Clip, ClipCaption } from "@/lib/types"

/**
 * The caption editor: put styled text on a clip and render it in.
 *
 * The preview is the one hand-built surface (the media carve-out): the clip
 * playing with the captions laid over it, each one draggable to where it
 * should sit. Everything around it is Astryx — the caption list, the text
 * field, the font and colour segments, the size and position sliders, the
 * outline switch, and the two buttons that end the visit, in the owner's
 * words: "Save as new clip" and "Replace this clip".
 *
 * Sizes and positions are percentages of the frame, so what the preview
 * shows is what the render means at any resolution. The burn itself happens
 * in the backend from the pristine source; this page polls until the render
 * is ready and says exactly what happened.
 */

const FONT_STACKS: Record<ClipCaption["font"], { family: string; weight: number }> = {
  // Liberation faces are metrically Arial/Times-compatible, so these
  // stand-ins preview honestly.
  sans: { family: "Arial, Helvetica, sans-serif", weight: 400 },
  bold: { family: "Arial, Helvetica, sans-serif", weight: 700 },
  serif: { family: "Georgia, 'Times New Roman', serif", weight: 400 },
  mono: { family: "'Courier New', Courier, monospace", weight: 400 },
}

/** The four faces the renderer can burn, named for what they look like. */
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

function freshCaption(): ClipCaption {
  return { text: "Your caption", font: "bold", sizePct: 6, color: "#ffffff", yPct: 85, outline: true }
}

export function CaptionEditor({ clipId, onDone }: { clipId: string; onDone: () => void }) {
  const [clip, setClip] = useState<Clip | null>(null)
  const [failed, setFailed] = useState(false)
  const [captions, setCaptions] = useState<ClipCaption[]>([])
  const [selected, setSelected] = useState(0)
  const [saving, setSaving] = useState<"new" | "replace" | null>(null)
  const [rendering, setRendering] = useState<string | null>(null)
  /** The source's real shape, learned from the video itself; 16:9 until known. */
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  /** True while the editor is open; the render poll checks it so a finished
   *  render never acts on a modal that was closed mid-wait. */
  const aliveRef = useRef(true)
  const toast = useToast()

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void api
      .getClip(clipId)
      .then(({ clip: loaded }) => {
        if (cancelled) return
        setClip(loaded)
        // The source's true shape, from the backend's probe: the layout is
        // right from the first paint, file loaded or not. onLoadedMetadata
        // below stays as the fallback for older rows without a probe.
        if (loaded.sourceWidth && loaded.sourceHeight) {
          setAspectRatio(loaded.sourceWidth / loaded.sourceHeight)
        }
        // Start from what the clip already carries, so "change the colour"
        // of an existing caption is editing, not retyping.
        setCaptions(Array.isArray(loaded.captions) && loaded.captions.length > 0 ? loaded.captions : [freshCaption()])
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
        if (current.status === "ready") {
          toast({
            body: mode === "new" ? "Saved — the captioned clip is in your library." : "Replaced — the clip now carries these captions.",
          })
          onDone()
          return
        }
        if (current.status === "failed") {
          setRendering(null)
          setSaving(null)
          toast({ type: "error", body: current.error ?? "The render failed. Try again." })
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
    if (saving) return
    setSaving(mode)
    try {
      const { clip: target } = await api.captionClip(clipId, { mode, captions })
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

  const update = (change: Partial<ClipCaption>) => {
    setCaptions((current) => current.map((caption, index) => (index === selected ? { ...caption, ...change } : caption)))
  }

  /** Drag a caption to where it should sit; percentages, so it holds. */
  const beginDrag = (index: number) => (event: React.PointerEvent) => {
    event.preventDefault()
    setSelected(index)
    const box = previewRef.current?.getBoundingClientRect()
    if (!box) return
    const move = (pointer: PointerEvent) => {
      const yPct = Math.min(98, Math.max(2, ((pointer.clientY - box.top) / box.height) * 100))
      setCaptions((current) =>
        current.map((caption, i) => (i === index ? { ...caption, yPct: Math.round(yPct * 10) / 10 } : caption)),
      )
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
  }

  if (failed) {
    return <p className="text-sm text-error">Couldn't load this clip. Refresh to try again.</p>
  }
  if (clip === null) {
    return <Skeleton height={320} radius={3} />
  }

  const current = captions[selected] ?? captions[0]

  return (
    <VStack gap={4} align="stretch">
      {/* The Dialog's own header carries the title; this row holds the
          working subtitle and the two ways out. */}
      <HStack justify="between" align="center" gap={4} wrap="wrap">
        <Text as="p" type="supporting" display="block">
          Drag text where it should sit; what you see is what gets burned in.
        </Text>
        <HStack gap={2} align="center">
          <Button
            label="Save as new clip"
            variant="primary"
            isLoading={saving === "new"}
            isDisabled={saving !== null && saving !== "new"}
            onClick={() => void save("new")}
          />
          {clip.canReplace && (
            <Button
              label="Replace this clip"
              variant="secondary"
              isLoading={saving === "replace"}
              isDisabled={saving !== null && saving !== "replace"}
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

      <HStack gap={5} align="start" wrap="wrap">
        {/* The preview: the media carve-out. Dynamic styles are the data —
            the user's own colour, size and position choices.

            It shares the row rather than owning it: at 768px fixed it pushed
            the controls below the fold, so the font choice was a scroll away
            from a person who had come to change the font. Width is capped by
            HEIGHT (46vh × the frame's own shape) so a portrait clip can't do
            the same thing vertically, and the aspect box stays exact — the
            drag positions are percentages of it. */}
        <div className="min-w-0 flex-1 basis-[420px]">
        <div
          ref={previewRef}
          className="relative mx-auto overflow-hidden rounded-xl bg-black ring-1 ring-white/10"
          style={{
            containerType: "size",
            aspectRatio: aspectRatio ?? 16 / 9,
            width: `min(100%, calc(46vh * ${aspectRatio ?? 16 / 9}))`,
          }}
        >
          {!clip.url && (
            <Text as="p" type="supporting" display="block" className="absolute inset-x-0 top-3 text-center">
              {aspectRatio
                ? "The clip file isn't available to preview right now — the captions below still show where text will sit."
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
                  // The frame takes the source's real shape, so portrait and
                  // square footage preview exactly as they will render, and
                  // caption positions mean the same thing in both places.
                  setAspectRatio(element.videoWidth / element.videoHeight)
                }
              }}
              className="absolute inset-0 h-full w-full"
            />
          )}
          {captions.map((caption, index) => (
            <button
              key={index}
              type="button"
              onPointerDown={beginDrag(index)}
              onClick={() => setSelected(index)}
              aria-label={`Caption: ${caption.text}. Drag to move.`}
              className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none text-center ${
                index === selected ? "outline-dashed outline-1 outline-white/50" : ""
              }`}
              style={{
                top: `${caption.yPct}%`,
                color: caption.color,
                fontFamily: FONT_STACKS[caption.font].family,
                fontWeight: FONT_STACKS[caption.font].weight,
                fontSize: `${caption.sizePct}cqh`,
                lineHeight: 1.15,
                WebkitTextStroke: caption.outline ? "0.04em rgba(0,0,0,0.85)" : undefined,
                paintOrder: "stroke fill",
              }}
            >
              {/* The SAME wrap the renderer uses (lib/captions.ts mirrors the
                  backend), so the lines on screen are the lines burned in.
                  These spans are the media carve-out, not interface
                  furniture: they ARE the burned pixels being previewed,
                  wearing the user's own font/size/colour choices — an
                  Astryx Text here would fight those with theme typography
                  tokens, which is exactly what this surface must not wear. */}
              {wrapCaptionText(caption.text, maxCharsPerLine(caption.font, caption.sizePct, aspectRatio ?? 16 / 9)).map(
                (line, lineIndex) => (
                  <span key={lineIndex} className="block whitespace-pre">
                    {line}
                  </span>
                ),
              )}
            </button>
          ))}
        </div>
        </div>

        <VStack gap={3} align="stretch" className="min-w-0 flex-1 basis-[320px]">
          <List hasDividers density="compact">
            {captions.map((caption, index) => (
              <ListItem
                key={index}
                label={caption.text || "Empty caption"}
                isSelected={index === selected}
                onClick={() => setSelected(index)}
                endContent={
                  captions.length > 1 ? (
                    <Button
                      label="Remove"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCaptions((existing) => existing.filter((_, i) => i !== index))
                        setSelected(0)
                      }}
                    />
                  ) : undefined
                }
              />
            ))}
          </List>
          {captions.length < 6 && (
            <Button
              label="Add caption"
              variant="secondary"
              size="sm"
              onClick={() => {
                setCaptions((existing) => [...existing, { ...freshCaption(), yPct: 15 }])
                setSelected(captions.length)
              }}
            />
          )}

          {current && (
            <VStack gap={3} align="stretch">
              <TextInput
                label="Text"
                value={current.text}
                onChange={(value) => update({ text: value.slice(0, 200) })}
                placeholder="What should it say?"
              />
              <VStack gap={1} align="stretch">
                {/* SegmentedControl's own label is aria-only — without a
                    visible one, the owner literally could not find the font
                    choice. Same for colour below. */}
                <Text as="p" type="supporting" display="block" weight="medium">
                  Font
                </Text>
              <SegmentedControl
                label="Font"
                value={current.font}
                onChange={(value) => update({ font: value as ClipCaption["font"] })}
                size="sm"
                layout="fill"
              >
                {/* Each choice wears its own face: "Aa" drawn in the very
                    font it selects, so the row reads as fonts at a glance
                    instead of four same-looking words. The specimen is the
                    media carve-out's logic — it is a sample of the output,
                    not interface text. */}
                {FONT_CHOICES.map((choice) => (
                  <SegmentedControlItem
                    key={choice.value}
                    value={choice.value}
                    label={choice.label}
                    icon={
                      <span
                        aria-hidden
                        style={{
                          fontFamily: FONT_STACKS[choice.value].family,
                          fontWeight: FONT_STACKS[choice.value].weight,
                          fontSize: "15px",
                          lineHeight: 1,
                          marginInlineEnd: "0.35em",
                        }}
                      >
                        Aa
                      </span>
                    }
                  />
                ))}
              </SegmentedControl>
              </VStack>
              <VStack gap={1} align="stretch">
                <Text as="p" type="supporting" display="block" weight="medium">
                  Colour
                </Text>
              <SegmentedControl
                label="Colour"
                value={current.color}
                onChange={(value) => update({ color: value })}
                size="sm"
                layout="fill"
              >
                {COLORS.map((color) => (
                  <SegmentedControlItem key={color.value} value={color.value} label={color.label} />
                ))}
              </SegmentedControl>
              </VStack>
              <Slider
                label="Size"
                value={current.sizePct}
                onChange={(value: number) => update({ sizePct: value })}
                min={2}
                max={15}
                step={0.5}
                formatValue={(value) => `${value}% of frame`}
              />
              <Slider
                label="Position"
                value={current.yPct}
                onChange={(value: number) => update({ yPct: value })}
                min={2}
                max={98}
                step={1}
                formatValue={(value) => `${Math.round(value)}% down`}
              />
              <Switch
                label="Outline"
                description="A dark edge that keeps light text readable over light footage."
                value={current.outline}
                onChange={(checked: boolean) => update({ outline: checked })}
              />
            </VStack>
          )}
        </VStack>
      </HStack>
    </VStack>
  )
}
