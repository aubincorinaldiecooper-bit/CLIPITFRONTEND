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
  // Capitalising the first letter is not enough for any of these: it gives
  // "Linkedin", "Youtube", "Tiktok". Showing a creator their own platform's
  // name spelled wrong, on the screen where they approve a public post, is
  // the kind of small thing that costs trust in everything around it.
  linkedin: "LinkedIn",
  facebook: "Facebook",
  threads: "Threads",
  x: "X",
  twitter: "X",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  reddit: "Reddit",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  tumblr: "Tumblr",
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

/**
 * One stage height for every shape, so the panel never moves — but a height
 * that gives way on a short screen, because a 460px stage on a phone pushed
 * the Post button 300px below the fold.
 */
const STAGE_HEIGHT = "min(460px, 42vh)"

/**
 * Where a platform cuts a long caption off and shows "more". Checking that
 * fold is most of why a preview is worth having — it is the difference
 * between a first line that sells the clip and one that stops mid-word.
 */
const CAPTION_FOLD = 125

const ASPECT_RATIO: Record<string, number> = {
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
}

type Preview = Awaited<ReturnType<typeof api.previewPublish>>["previews"][number]

/**
 * The caption as the feed will show it: cut at the fold, on a word, with the
 * affordance that hides the rest. Anything short enough is left alone.
 */
function foldCaption(text: string): { shown: string; folded: boolean } {
  if (text.length <= CAPTION_FOLD) return { shown: text, folded: false }
  const cut = text.slice(0, CAPTION_FOLD)
  const lastSpace = cut.lastIndexOf(" ")
  return { shown: (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd(), folded: true }
}

/** The caption line inside a mockup — placeholder, or the real folded text. */
function MockCaption({ caption, className }: { caption: string; className: string }) {
  const text = caption.trim()
  if (!text) return <span className={className}>Your caption appears here</span>
  const { shown, folded } = foldCaption(text)
  return (
    <span className={className}>
      {shown}
      {folded && <span className="opacity-60">… more</span>}
    </span>
  )
}

/**
 * The affordances a feed puts beside a post. Drawn here as plain single
 * strokes in our own hand — the ARRANGEMENT is the familiar one, the
 * drawing is not anybody's icon set.
 */
function FeedGlyph({ d }: { d: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

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

      {/* One cut at a time, framed as the POST it will become.
          
          A bare video in a box is a file inspector; what a creator wants to
          check is "how will this look in the feed". So each slide is a post
          mockup in the shape of its destination — a full-bleed vertical with
          the caption over it for Reels and TikTok, a card with the caption
          beneath for a feed or a watch page.

          Deliberately OUR chrome, not theirs: no platform logo, no copied
          icon set, no borrowed colour. The arrangement is the reference; the
          drawing is ours, in our palette. It says "this is your post"
          without pretending to be someone else's interface. */}
      {/* A composer, not a stack. The preview used to sit centred above the
          caption box, which left a 9:16 post stranded in the middle of a
          980px panel with dead space either side — the media looked like a
          postage stamp on the screen where the media matters most. Side by
          side, the caption gets the width it needs to be read and the post
          gets a column it can fill. It stacks under a narrow window. */}
      <div className="grid items-start gap-x-7 gap-y-5 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="flex min-w-0 flex-col gap-4 lg:order-first lg:pt-1">
        <TextArea
          label="Caption"
          rows={7}
          value={caption}
          onChange={onCaptionChange}
          placeholder="Say something about this clip (optional)"
        />
        {/* Typing is where the fold matters, so the count sits with the box. */}
        <Text as="p" type="supporting" display="block">
          {caption.trim().length > CAPTION_FOLD
            ? `${caption.trim().length} characters — feeds show the first ${CAPTION_FOLD} before "more".`
            : "The first line is what most people read. Everything after it sits behind “more”."}
        </Text>

        {/* The full list, in words, beside the one post you are looking at.
            The carousel shows a single cut at a time on purpose — so the
            answer to "wait, what else is going out?" has to be somewhere
            that does not require stepping through every slide. */}
        <VStack gap={1.5} align="stretch">
          <Text as="p" type="supporting" display="block">
            Going out to
          </Text>
          {previews.map((preview) => (
            <HStack
              key={`row-${preview.aspect}`}
              gap={2}
              align="center"
              justify="between"
            >
              <Text as="span" display="block">
                {describeTargets(preview.targets)}
              </Text>
              <Text as="span" type="supporting" display="block">
                {preview.aspect === "source" ? "as you cut it" : preview.aspect}
                {preview.status === "preparing" ? " · preparing" : ""}
                {preview.status === "failed" ? " · can't be made" : ""}
              </Text>
            </HStack>
          ))}
        </VStack>
      </div>

      <div style={{ containerType: "inline-size" }}>
        <Carousel gap={0} hasSnap padding={0} aria-label="What each platform receives">
          {previews.map((preview, index) => {
            const ratio = ASPECT_RATIO[preview.aspect] ?? 16 / 9
            const overlaid = ratio < 0.8
            const body =
              preview.status === "ready" && preview.url ? (
                <video
                  src={preview.url}
                  // No native controls: a scrub bar bolted across a post
                  // mockup breaks the illusion it exists to create. Click to
                  // play, the way a feed does.
                  playsInline
                  loop
                  muted
                  onClick={(event) => {
                    const video = event.currentTarget
                    if (video.paused) void video.play()
                    else video.pause()
                  }}
                  className="h-full w-full cursor-pointer object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-4 text-center">
                  <Text as="p" type="supporting" display="block">
                    {preview.status === "failed"
                      ? preview.error ?? "This cut couldn't be made."
                      : "Preparing this cut…"}
                  </Text>
                </div>
              )

            return (
              <VStack
                key={`${preview.aspect}-${preview.targets[0]?.accountId ?? ""}`}
                gap={2}
                align="center"
                style={{ width: "100cqw", flexShrink: 0 }}
              >
                {/* A stage of ONE fixed height for every shape. A vertical
                    post fills it; a landscape one sits centred inside it at
                    its true proportions. Sizing each card by itself instead
                    made the panel taller on the vertical slide and shorter
                    on the landscape one, so the caption and the Post button
                    moved as you stepped through — the reflow this app's own
                    rules forbid. */}
                {/* Room down both sides for the carousel's arrows. Without it
                    a square or landscape card fills the column edge to edge
                    and the arrows land ON the footage — covering the very
                    thing they are there to help you look at. */}
                <div
                  data-stage
                  className="flex w-full justify-center"
                  style={{
                    // A feed card's identity row belongs directly under its
                    // media, so the card sinks to the bottom of the stage
                    // instead of floating in the middle of it with a gap.
                    alignItems: overlaid ? "center" : "flex-end",
                    // The stage is the single source of the size: the card
                    // reads it back out of this variable, so one number
                    // governs both axes of every shape.
                    ["--stage" as string]: STAGE_HEIGHT,
                    height: "var(--stage)",
                    paddingInline: 40,
                  }}
                >
                <div
                  className="relative overflow-hidden bg-black"
                  style={{
                    aspectRatio: ratio,
                    // Width first, height derived. A fixed HEIGHT plus a
                    // max-width does not do this: CSS keeps the height and
                    // narrows the width, so a 16:9 clip was drawn in a tall
                    // box and object-cover cropped the sides off it — this
                    // panel showing the wrong crop is the single failure it
                    // exists to prevent. Capping the width at
                    // height × ratio makes the stage the limit on both axes
                    // while the true shape survives.
                    width: `min(100%, calc(var(--stage) * ${ratio.toFixed(4)}))`,
                    flexShrink: 0,
                    // A vertical post is a screen; a feed post is a card.
                    borderRadius: overlaid ? 22 : 14,
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 24px 60px -28px rgba(0,0,0,0.9)",
                  }}
                >
                  {body}

                  {/* The vertical arrangement: caption and identity over the
                      footage, affordances down the right edge. */}
                  {overlaid && preview.status === "ready" && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0"
                        style={{
                          height: "45%",
                          background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                        }}
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3 pr-12">
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-white/25 ring-1 ring-white/40" />
                          <span className="text-[12.5px] font-semibold text-white">
                            {describeTargets(preview.targets)}
                          </span>
                        </div>
                        <MockCaption
                          caption={caption}
                          className="line-clamp-2 text-[12px] leading-snug text-white/85"
                        />
                      </div>
                      <div className="pointer-events-none absolute bottom-3 right-2.5 flex flex-col items-center gap-3.5 text-white/85">
                        <FeedGlyph d="M12 20.5s-7.5-4.7-7.5-9.8A4.2 4.2 0 0 1 12 8.4a4.2 4.2 0 0 1 7.5 2.3c0 5.1-7.5 9.8-7.5 9.8Z" />
                        <FeedGlyph d="M20 12a8 8 0 1 1-3.2-6.4L20 4l-1 4.2A7.9 7.9 0 0 1 20 12Z" />
                        <FeedGlyph d="M4 12l16-7-6 16-2.5-6.5L4 12Z" />
                      </div>
                    </>
                  )}
                </div>
                </div>

                {/* A landscape or square post carries its identity BELOW the
                    media, the way a feed or a watch page does. */}
                {!overlaid && preview.status === "ready" && (
                  <div className="flex w-full max-w-[520px] items-start gap-2.5 px-10">
                    <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-white/12 ring-1 ring-white/15" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <MockCaption
                        caption={caption}
                        className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground/90"
                      />
                      <span className="text-[12px] text-foreground/60">
                        {describeTargets(preview.targets)}
                      </span>
                    </div>
                  </div>
                )}

                <Text as="p" type="supporting" display="block">
                  {describeTargets(preview.targets)} · {preview.aspect === "source" ? "as you cut it" : `${preview.aspect}`}
                  {preview.width && preview.height ? ` · ${preview.width}×${preview.height}` : ""}
                  {previews.length > 1 ? ` · ${index + 1} of ${previews.length}` : ""}
                </Text>
              </VStack>
            )
          })}
        </Carousel>
      </div>
      </div>

      {broken.length > 0 && (
        <Banner
          status="warning"
          title={`${broken.length === 1 ? "One cut" : `${broken.length} cuts`} couldn't be made`}
          description={`${describeTargets(broken.flatMap((preview) => preview.targets))} would be skipped. The other accounts can still be posted to.`}
        />
      )}

      {/* Pinned to the bottom of the panel. Stacked on a narrow window the
          content is taller than the panel, and the button that ends the whole
          errand was below the fold — you had to scroll past four post
          mockups to find it. */}
      <HStack
        gap={2}
        justify="end"
        align="center"
        className="sticky bottom-0 -mx-1 border-t border-white/8 bg-[var(--color-background-popover)] px-1 pb-1 pt-3"
      >
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
