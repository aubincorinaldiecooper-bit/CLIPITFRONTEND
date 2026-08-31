import type { Clip, ClipCompositionMode, ClipPlatform } from "./types"

const VERTICAL_PLATFORMS = new Set<ClipPlatform>(["tiktok", "reels", "shorts"])

export interface RequestedPresentation {
  platform: ClipPlatform
  outputAspectRatio: "9:16" | "source"
  preserveOriginalFraming: boolean
}

export function presentationForInstruction(instruction: string): RequestedPresentation | null {
  const lower = instruction.toLocaleLowerCase()
  const originalFraming = /original (?:frame|framing|aspect)|keep (?:the )?original/.test(lower)
  const platform: ClipPlatform | null = originalFraming
    ? "original"
    : /tiktok/.test(lower)
      ? "tiktok"
      : /(?:instagram )?reel/.test(lower)
        ? "reels"
        : /(?:youtube )?short/.test(lower)
          ? "shorts"
          : null
  return platform
    ? {
        platform,
        outputAspectRatio: platform === "original" ? "source" : "9:16",
        preserveOriginalFraming: platform === "original",
      }
    : null
}

/** The backend remains authoritative; this only describes how its asset should be shown. */
export function isVerticalClip(clip: Pick<Clip, "platform" | "outputAspectRatio">): boolean {
  return clip.outputAspectRatio === "9:16" || (clip.platform != null && VERTICAL_PLATFORMS.has(clip.platform))
}

export function clipPoster(clip: Pick<Clip, "posterUrl"> & { thumbnailUrl?: string | null }): string | null {
  return clip.posterUrl ?? clip.thumbnailUrl ?? null
}

/**
 * A source excerpt is never stretched to impersonate a vertical render. When
 * the API has not produced a derivative, the player uses the source twice:
 * once blurred as a full-bleed canvas, then intact above it.
 */
export function needsComposedFallback(
  clip: Pick<Clip, "outputAspectRatio" | "compositionMode" | "verticalDerivativeGenerated">,
): boolean {
  return clip.outputAspectRatio === "9:16" && !clip.verticalDerivativeGenerated
}

export function compositionLabel(mode: ClipCompositionMode | null | undefined): string {
  if (mode === "smart_crop") return "Subject-centred crop"
  if (mode === "blurred_background") return "Full frame on a blurred canvas"
  if (mode === "padded") return "Full frame with padding"
  return "Original framing"
}
