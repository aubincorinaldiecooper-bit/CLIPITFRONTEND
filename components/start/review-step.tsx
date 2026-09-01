"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card } from "@astryxdesign/core/Card"
import { VStack, HStack } from "@astryxdesign/core/Stack"
import { Text, Heading } from "@astryxdesign/core/Text"
import { Button } from "@astryxdesign/core/Button"
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { AspectRatio } from "@astryxdesign/core/AspectRatio"
import { X, Check } from "lucide-react"
import type { Clip, ClipMatch, ClipRequest, Video } from "@/lib/types"
import { ClipSlider } from "./clip-slider"

export interface ReviewStepProps {
  request: ClipRequest | null
  clips: Clip[]
  video: Video | null
  busy?: boolean
  onKeep: (matchId: string) => void | Promise<void>
  onSkip: (matchId: string) => void | Promise<void>
  onUploadMore: () => void
}

function asMinutes(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

function clipForMatch(match: ClipMatch, clips: Clip[]) {
  const clipId = match.clip?.id
  if (!clipId) return null
  return clips.find((c) => c.id === clipId && c.status === "ready" && c.url) ?? null
}

interface PreviewSource {
  url: string
  start: number
  end: number | null
}

/**
 * What Play should show for a moment.
 *
 * A moment is only cut into its own file once it has been kept, so during
 * review there is usually nothing rendered to play. The source video answers
 * for it: same footage, seeked to the moment's bounds. Deciding whether to
 * keep a clip you cannot watch is not a decision.
 */
function previewFor(match: ClipMatch, clips: Clip[], video: Video | null): PreviewSource | null {
  const clip = clipForMatch(match, clips)
  if (clip?.url) return { url: clip.url, start: 0, end: null }
  const source = video?.playback?.url
  if (!source) return null
  return { url: source, start: match.startSeconds, end: match.endSeconds }
}

/** Plays a moment and stops at its out-point rather than running on. */
function PreviewPlayer({ source }: { source: PreviewSource }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const element = ref.current
    if (element) element.currentTime = source.start
  }, [source.url, source.start])

  return (
    <video
      ref={ref}
      src={`${source.url}#t=${source.start}`}
      controls
      autoPlay
      muted
      playsInline
      onTimeUpdate={(event) => {
        const element = event.currentTarget
        if (source.end !== null && element.currentTime >= source.end) element.pause()
      }}
    />
  )
}

export function ReviewStep({ request, clips, video, busy, onKeep, onSkip, onUploadMore }: ReviewStepProps) {
  const matches = request?.matches ?? []
  const pending = useMemo(() => matches.filter((m) => m.feedback == null), [matches])

  const [selectedId, setSelectedId] = useState<string | undefined>(pending[0]?.id)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId || !pending.some((m) => m.id === selectedId)) {
      setSelectedId(pending[0]?.id)
    }
  }, [pending, selectedId])

  const activeMatch = matches.find((m) => m.id === selectedId) ?? pending[0]

  const videoLabel = video?.title ?? video?.originalFilename ?? "Video"

  const cards = useMemo(
    () =>
      pending.map((match) => {
        return {
          id: match.id,
          src: match.thumbnailUrl ?? "",
          title: match.description || "Moment",
          description: `${videoLabel} · ${asMinutes(match.startSeconds)} – ${asMinutes(match.endSeconds)}`,
          videoUrl: previewFor(match, clips, video)?.url,
        }
      }),
    [pending, clips, video, videoLabel],
  )

  const previewMatch = previewId ? matches.find((m) => m.id === previewId) : undefined
  const preview = previewMatch ? previewFor(previewMatch, clips, video) : null

  const keptCount = matches.filter((m) => m.feedback === "approved").length
  const skippedCount = matches.filter((m) => m.feedback === "rejected").length

  const handleKeep = () => {
    if (!activeMatch || busy) return
    void onKeep(activeMatch.id)
    setPreviewId(null)
    setSelectedId(undefined)
  }

  const handleSkip = () => {
    if (!activeMatch || busy) return
    void onSkip(activeMatch.id)
    setPreviewId(null)
    setSelectedId(undefined)
  }

  const activeIndex = cards.findIndex((c) => c.id === selectedId)
  const activeCard = activeIndex >= 0 ? cards[activeIndex] : cards[0]
  const activeId = activeCard?.id

  if (pending.length === 0) {
    return (
      <VStack vAlign="center" hAlign="center" gap={6} padding={0} width="100%" maxWidth={420} className="flex-1">
        <Card padding={6} width="100%" variant="default" elevation="med">
          <VStack vAlign="center" hAlign="center" gap={3}>
            <Heading level={3} type="display-3" justify="center">
              All caught up
            </Heading>
            <Text type="body" color="secondary" justify="center">
              You kept {keptCount} clip{keptCount === 1 ? "" : "s"}.
            </Text>
            {skippedCount > 0 && (
              <Text type="supporting" color="secondary" justify="center">
                {skippedCount} skipped
              </Text>
            )}
            <Button label="Clip another video" variant="primary" onClick={onUploadMore} />
          </VStack>
        </Card>
      </VStack>
    )
  }

  return (
    <VStack vAlign="center" hAlign="center" gap={6} padding={0} width="100%" className="flex-1">
      <ClipSlider
        cards={cards}
        onSelect={(card) => setSelectedId(card.id)}
        onPlay={(card) => setPreviewId(card.id)}
      />

      {activeCard && (
        <HStack gap={4} vAlign="center" padding={0}>
          <Button
            label="Skip"
            icon={<X className="size-4" />}
            variant="secondary"
            size="lg"
            isDisabled={busy}
            onClick={handleSkip}
          />
          <Button
            label="Keep"
            icon={<Check className="size-4" />}
            variant="primary"
            size="lg"
            isDisabled={busy}
            onClick={handleKeep}
          />
        </HStack>
      )}

      <Dialog
        isOpen={previewId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null)
        }}
        variant="standard"
        width="min(100vw - 32px, 360px)"
        padding={0}
        purpose="info"
      >
        <Layout
          header={
            <DialogHeader
              title="Preview"
              onOpenChange={(open) => {
                if (!open) setPreviewId(null)
              }}
            />
          }
          content={
            <LayoutContent padding={0} isScrollable={false}>
              {preview && (
                <AspectRatio ratio={9 / 16} fit="cover">
                  <PreviewPlayer source={preview} />
                </AspectRatio>
              )}
            </LayoutContent>
          }
        />
      </Dialog>
    </VStack>
  )
}
