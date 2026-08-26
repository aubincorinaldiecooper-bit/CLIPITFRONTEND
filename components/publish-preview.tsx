"use client"

import { AspectRatio } from "@astryxdesign/core/AspectRatio"
import { Icon } from "@astryxdesign/core/Icon"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import type { LibraryClip } from "@/lib/types"

/**
 * What you are about to publish, shown before you publish it.
 *
 * The modal used to open on a caption box with no picture in it, which asked
 * someone to confirm sending a clip out in public while showing them nothing
 * of the clip. Two clips cut from one video have near-identical titles; the
 * frame is what tells them apart.
 *
 * The frame itself is the clip's own thumbnail — the media carve-out, so it is
 * plain <img> and <video> rather than anything the design system dresses up.
 */

/** mm:ss. Long clips are rare here but an hour-plus one should not read 75:12. */
export function clipDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  const pad = (value: number) => String(value).padStart(2, "0")
  // Minutes padded too, so the badge is a fixed width and reads as a
  // timecode: "00:24", not "0:24".
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`
}

export function PublishPreview({ clip }: { clip: LibraryClip | null }) {
  if (!clip) return null

  // `durationSeconds` is what the render reported; the in/out points are what
  // was asked for. They usually agree. When the render never reported one,
  // the request is still a truthful answer rather than a blank.
  const seconds = clip.durationSeconds ?? clip.endSeconds - clip.startSeconds

  return (
    <VStack gap={2} align="stretch">
      {/* Wider than 16:9 — measured at about 2.4:1 off the mockup. A
          full 16:9 still made the modal taller than a laptop screen. */}
      <AspectRatio ratio={2.4} fit="cover">
        <span className="relative block overflow-hidden rounded-xl bg-black">
          {clip.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clip.thumbnailUrl} alt="" aria-hidden className="h-full w-full object-cover" />
          ) : (
            // No thumbnail is not the same as no clip. Say which it is rather
            // than showing an empty black rectangle that reads as broken.
            <span className="flex h-full w-full items-center justify-center">
              <Text as="span" type="supporting">
                No preview frame for this clip
              </Text>
            </span>
          )}
          {Number.isFinite(seconds) && seconds > 0 && (
            <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5">
              <Text as="span" type="supporting">
                {clipDuration(seconds)}
              </Text>
            </span>
          )}
        </span>
      </AspectRatio>

      <HStack gap={2} align="center">
        <Text as="p" type="body" display="block">
          {clip.description || "A moment from your video"}
        </Text>
      </HStack>
    </VStack>
  )
}

/**
 * The tick on a chosen account row.
 *
 * Drawn rather than an Astryx checkbox: the checkbox fills a selected row with
 * --color-accent-muted, which on this near-black palette is a solid amber
 * block, and amber here is for small marks and never for a surface. This is
 * the small mark.
 *
 * Decorative — `ListItem`'s own `isSelected` carries the state to a screen
 * reader, so a second announcement here would just be noise.
 */
export function ChosenTick({ isOn }: { isOn: boolean }) {
  return (
    <span
      aria-hidden
      // Neutral, not amber. The mockup fills the chosen circle with a light
      // surface and a dark tick — amber in that list would compete with the
      // platform marks beside it, which are the row's real colour.
      className={
        isOn
          ? "flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-primary"
          : "flex h-6 w-6 items-center justify-center rounded-full text-secondary ring-1 ring-border"
      }
    >
      {isOn && <Icon icon="check" size="sm" />}
    </span>
  )
}
