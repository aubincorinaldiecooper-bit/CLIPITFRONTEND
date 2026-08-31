import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ClipCard } from "../components/clip-card"
import {
  clipPoster,
  needsComposedFallback,
  presentationForInstruction,
} from "../lib/clip-presentation"
import type { LibraryClip } from "../lib/types"

const clip = (overrides: Partial<LibraryClip> = {}): LibraryClip => ({
  id: "clip-1",
  videoId: "video-1",
  clipMatchId: "match-1",
  status: "ready",
  error: null,
  startSeconds: 12,
  endSeconds: 32,
  startTimecode: "0:12",
  endTimecode: "0:32",
  durationSeconds: 20,
  sizeBytes: 100,
  url: "https://cdn/clip.mp4",
  downloadUrl: "https://cdn/clip-download.mp4",
  urlExpiresAt: null,
  createdAt: "2026-08-31T00:00:00Z",
  description: "A strong moment",
  thumbnailUrl: "https://cdn/old-match-still.jpg",
  videoTitle: "Source video",
  ...overrides,
})

afterEach(cleanup)

describe("platform presentation contract", () => {
  it.each(["TikTok", "Instagram Reel", "YouTube Short"])("requests a 9:16 derivative for %s", (platform) => {
    expect(presentationForInstruction(`Make this a ${platform}`)?.outputAspectRatio).toBe("9:16")
  })

  it("keeps an ordinary request unchanged", () => {
    expect(presentationForInstruction("Find the funniest exchange")).toBeNull()
  })

  it("honours an explicit request for original framing", () => {
    expect(presentationForInstruction("TikTok, but keep the original framing")).toEqual({
      platform: "original",
      outputAspectRatio: "source",
      preserveOriginalFraming: true,
    })
  })

  it("uses a composed canvas until the vertical derivative is available", () => {
    expect(needsComposedFallback(clip({ outputAspectRatio: "9:16", verticalDerivativeGenerated: false }))).toBe(true)
    expect(needsComposedFallback(clip({ outputAspectRatio: "9:16", verticalDerivativeGenerated: true }))).toBe(false)
  })
})

describe("ClipCard poster and playback surfaces", () => {
  it("prefers the renderer's dedicated poster over the match still", () => {
    const item = clip({ posterUrl: "https://cdn/chosen-poster.jpg" })
    expect(clipPoster(item)).toBe("https://cdn/chosen-poster.jpg")
    const { container } = render(<ClipCard clip={item} isPlaying={false} onPlay={vi.fn()} />)
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn/chosen-poster.jpg")
    expect(screen.queryByRole("video")).toBeNull()
  })

  it("opens a true 9:16 player and keeps the poster on the video element", () => {
    const item = clip({ posterUrl: "https://cdn/poster.jpg", platform: "tiktok", outputAspectRatio: "9:16", verticalDerivativeGenerated: true })
    const { container } = render(<ClipCard clip={item} isPlaying={true} onPlay={vi.fn()} />)
    const video = container.querySelector("video")!
    expect(screen.getByTestId("clip-player-frame").className).toContain("aspect-[9/16]")
    expect(video.getAttribute("poster")).toBe("https://cdn/poster.jpg")
    expect(video.className).toContain("object-cover")
  })

  it("plays a landscape fallback intact over a blurred canvas instead of black bars", () => {
    const item = clip({ platform: "reels", outputAspectRatio: "9:16", verticalDerivativeGenerated: false })
    const { container } = render(<ClipCard clip={item} isPlaying={true} onPlay={vi.fn()} />)
    expect(container.querySelectorAll("video")).toHaveLength(2)
    expect(container.querySelectorAll("video")[1]!.className).toContain("object-contain")
  })

  it("still starts playback from the poster control", () => {
    const onPlay = vi.fn()
    render(<ClipCard clip={clip()} isPlaying={false} onPlay={onPlay} />)
    fireEvent.click(screen.getByTestId("clip-poster"))
    expect(onPlay).toHaveBeenCalledOnce()
  })
})
