"use client"

import { useEffect, useRef, useState } from "react"
import { Banner } from "@astryxdesign/core/Banner"
import { Carousel } from "@astryxdesign/core/Carousel"
import { Button } from "@astryxdesign/core/Button"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { TextArea } from "@astryxdesign/core/TextArea"
import { api, ApiError } from "@/lib/api"

/**
 * Approve before the world sees it.
 *
 * Publishing cuts a clip to each platform's shape, and a crop decides what
 * is thrown away. So nothing goes out unseen: this prepares the ACTUAL file
 * each platform would receive, plays it, and only posts when the person
 * says so.
 *
 * The players are the media carve-out — hand-built, because what is on
 * screen IS the footage about to be published, and it must be shown at the
 * shape it will be published in, not squeezed into a uniform box.
 */

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
}

/**
 * A platform's name as its own users write it. The map holds the ones whose
 * capitalisation is not guessable; anything else is at least given a capital
 * rather than shown to a person as "linkedin".
 */
const platformName = (platform: string) =>
  PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1)

/** "TikTok and Instagram" — each service named once, however many accounts. */
function describeTargets(targets: Array<{ platform: string }>): string {
  const names = [...new Set(targets.map((target) => platformName(target.platform)))]
  if (names.length <= 1) return names[0] ?? "your accounts"
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

const ASPECT_RATIO: Record<string, number> = {
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
}

type Preview = Awaited<ReturnType<typeof api.previewPublish>>["previews"][number]

export function PublishPreview({
  clipId,
  caption,
  isPublishing,
  onCaptionChange,
  onPublishStart,
  onPublishSettled,
  onPublished,
}: {
  clipId: string
  caption: string
  /**
   * Whether a publish for THIS clip is already in flight. It is the page's
   * to know, not this component's: closing the dialog unmounts everything
   * here, and a local flag would reset — so reopening and pressing Post
   * again would start a second publish of a clip already going out.
   */
  isPublishing: boolean
  onCaptionChange: (value: string) => void
  onPublishStart: () => void
  onPublishSettled: () => void
  onPublished: (result: Awaited<ReturnType<typeof api.publishClip>>) => void
}) {
  const [previews, setPreviews] = useState<Preview[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  /** Bumped to re-run the preview poll after a failure, without reopening. */
  const [attempt, setAttempt] = useState(0)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    let timer: number | undefined

    const load = async () => {
      try {
        const result = await api.previewPublish(clipId)
        if (!aliveRef.current) return
        setPreviews(result.previews)
        // A shape still being cut is worth waiting for — but the wait is
        // visible (each pane says "Preparing"), never a blank screen.
        if (result.previews.some((preview) => preview.status === "preparing")) {
          timer = window.setTimeout(() => void load(), 2500)
        }
      } catch (cause) {
        if (!aliveRef.current) return
        setFailed(
          cause instanceof ApiError ? cause.message : "Couldn't prepare the preview. Try again.",
        )
      }
    }

    void load()
    return () => {
      if (timer) window.clearTimeout(timer)
    }
    // `attempt` is what Try again turns, so the poll restarts in place.
  }, [clipId, attempt])

  const publish = async () => {
    if (isPublishing) return
    onPublishStart()
    try {
      const result = await api.publishClip(clipId, { caption: caption.trim() })
      onPublished(result)
    } catch (cause) {
      setFailed(cause instanceof ApiError ? cause.message : "Couldn't publish just now. Try again.")
    } finally {
      onPublishSettled()
    }
  }

  const retry = () => {
    setFailed(null)
    setAttempt((value) => value + 1)
  }

  // A first load that failed has nothing to show yet — but it still offers
  // the way forward in place, rather than making someone close the dialog
  // and open it again to retry.
  if (previews === null) {
    return failed ? (
      <VStack gap={2} align="stretch">
        <Banner status="error" title="That didn't work" description={failed} />
        <HStack justify="end">
          <Button label="Try again" variant="secondary" onClick={retry} />
        </HStack>
      </VStack>
    ) : (
      <Skeleton height={220} radius={3} />
    )
  }

  const preparing = previews.filter((preview) => preview.status === "preparing")
  const broken = previews.filter((preview) => preview.status === "failed")
  const ready = previews.filter((preview) => preview.status === "ready")

  return (
    <VStack gap={3} align="stretch">
      <Text as="p" type="supporting" display="block">
        This is exactly what each account receives. Nothing is posted until you say so.
      </Text>

      {/* A failure that arrives once the cuts are on screen belongs BESIDE
          them, not instead of them: a brief polling blip must not take away
          the videos, the caption and the button. */}
      {failed && (
        <Banner
          status="error"
          title="That didn't work"
          description={failed}
          endContent={<Button label="Try again" variant="secondary" size="sm" onClick={retry} />}
        />
      )}

      {/* One cut at a time. The arrow moves to the next: a person checking
          what goes out should be looking at ONE post, the way their
          audience will, not scanning a shelf of them. Each slide fills the
          carousel's width and centres its card, so the snap lands on
          exactly one — and the stage is a fixed height, so the panel never
          moves as you step through shapes. */}
      <div style={{ containerType: "inline-size" }}>
        <Carousel gap={0} hasSnap padding={0} aria-label="What each platform receives">
          {previews.map((preview, index) => {
            const ratio = ASPECT_RATIO[preview.aspect] ?? 16 / 9
            return (
              <VStack
                key={`${preview.aspect}-${preview.targets[0]?.accountId ?? ""}`}
                gap={1.5}
                align="center"
                // One slide = one carousel width, so a snap can only ever
                // rest on a single cut.
                style={{ width: "100cqw", flexShrink: 0 }}
              >
                <div
                  className="relative overflow-hidden rounded-xl bg-black ring-1 ring-white/[0.07]"
                  style={{
                    height: 300,
                    aspectRatio: ratio,
                    maxWidth: "100%",
                    flexShrink: 0,
                  }}
                >
                  {preview.status === "ready" && preview.url ? (
                    <video src={preview.url} controls playsInline className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-4 text-center">
                      <Text as="p" type="supporting" display="block">
                        {preview.status === "failed"
                          ? preview.error ?? "This cut couldn't be made."
                          : "Preparing this cut…"}
                      </Text>
                    </div>
                  )}
                </div>
                <VStack gap={0.5} align="center">
                  <Text as="p" type="supporting" display="block" weight="medium">
                    {describeTargets(preview.targets)}
                  </Text>
                  <Text as="p" type="supporting" display="block">
                    {preview.aspect === "source" ? "As you cut it" : `${preview.aspect} cut`}
                    {preview.width && preview.height ? ` · ${preview.width}×${preview.height}` : ""}
                    {previews.length > 1 ? ` · ${index + 1} of ${previews.length}` : ""}
                  </Text>
                </VStack>
              </VStack>
            )
          })}
        </Carousel>
      </div>

      <TextArea
        label="Caption"
        rows={3}
        value={caption}
        onChange={onCaptionChange}
        placeholder="Say something about this clip (optional)"
      />

      {broken.length > 0 && (
        <Banner
          status="warning"
          title={`${broken.length === 1 ? "One cut" : `${broken.length} cuts`} couldn't be made`}
          description={`${describeTargets(broken.flatMap((preview) => preview.targets))} would be skipped. The other accounts can still be posted to.`}
        />
      )}

      <HStack gap={2} justify="end" align="center">
        {preparing.length > 0 && (
          <Text as="p" type="supporting" display="block">
            Waiting on {describeTargets(preparing.flatMap((preview) => preview.targets))}…
          </Text>
        )}
        <Button
          label={ready.length > 1 ? `Post all ${ready.length}` : "Post it"}
          variant="primary"
          isLoading={isPublishing}
          // Approving something you cannot see is the one thing this panel
          // exists to prevent.
          isDisabled={ready.length === 0 || preparing.length > 0}
          onClick={() => void publish()}
        />
      </HStack>
    </VStack>
  )
}
