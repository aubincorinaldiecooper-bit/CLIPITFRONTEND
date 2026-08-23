"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Heading } from "@astryxdesign/core/Heading"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
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
import type { Clip, ClipCaption } from "@/lib/types"
import { AppShell } from "@/components/app-shell"

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

function CaptionEditor({ clipId }: { clipId: string }) {
  const [clip, setClip] = useState<Clip | null>(null)
  const [failed, setFailed] = useState(false)
  const [captions, setCaptions] = useState<ClipCaption[]>([])
  const [selected, setSelected] = useState(0)
  const [saving, setSaving] = useState<"new" | "replace" | null>(null)
  const [rendering, setRendering] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    void api
      .getClip(clipId)
      .then(({ clip: loaded }) => {
        if (cancelled) return
        setClip(loaded)
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
      try {
        const { clip: current } = await api.getClip(targetId)
        if (current.status === "ready") {
          toast({
            body: mode === "new" ? "Saved — the captioned clip is in your library." : "Replaced — the clip now carries these captions.",
          })
          router.push("/clips")
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
      <HStack justify="between" align="start" gap={4} wrap="wrap">
        <VStack gap={1.5}>
          <Heading level={1}>Captions</Heading>
          <Text as="p" type="supporting" display="block">
            Drag text where it should sit; what you see is what gets burned in.
          </Text>
        </VStack>
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

      <div className="flex flex-wrap gap-6">
        {/* The preview: the media carve-out. Dynamic styles are the data —
            the user's own colour, size and position choices. */}
        <div
          ref={previewRef}
          className="relative aspect-video w-full max-w-3xl shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/10"
          style={{ containerType: "size" }}
        >
          {clip.url && (
            <video src={clip.url} controls playsInline className="absolute inset-0 h-full w-full" />
          )}
          {captions.map((caption, index) => (
            <button
              key={index}
              type="button"
              onPointerDown={beginDrag(index)}
              onClick={() => setSelected(index)}
              aria-label={`Caption: ${caption.text}. Drag to move.`}
              className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none whitespace-pre-wrap text-center leading-tight ${
                index === selected ? "outline-dashed outline-1 outline-white/50" : ""
              }`}
              style={{
                top: `${caption.yPct}%`,
                color: caption.color,
                fontFamily: FONT_STACKS[caption.font].family,
                fontWeight: FONT_STACKS[caption.font].weight,
                fontSize: `${caption.sizePct}cqh`,
                WebkitTextStroke: caption.outline ? "0.04em rgba(0,0,0,0.85)" : undefined,
                paintOrder: "stroke fill",
              }}
            >
              {caption.text}
            </button>
          ))}
        </div>

        <VStack gap={3} align="stretch" className="min-w-72 flex-1">
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
              <SegmentedControl
                label="Font"
                value={current.font}
                onChange={(value) => update({ font: value as ClipCaption["font"] })}
                size="sm"
                layout="fill"
              >
                <SegmentedControlItem value="sans" label="Clean" />
                <SegmentedControlItem value="bold" label="Bold" />
                <SegmentedControlItem value="serif" label="Serif" />
                <SegmentedControlItem value="mono" label="Mono" />
              </SegmentedControl>
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
      </div>
    </VStack>
  )
}

export default function CaptionScreen({ params }: { params: Promise<{ clipId: string }> }) {
  const { clipId } = use(params)
  return (
    <AppShell active="clips">
      <Layout height="auto" contentWidth={1152}>
        <LayoutContent padding={6}>
          <CaptionEditor clipId={clipId} />
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
