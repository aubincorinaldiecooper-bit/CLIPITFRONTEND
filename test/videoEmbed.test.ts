import { describe, expect, it } from "vitest"
import { playerFor, siteName } from "../lib/video-embed"

describe("playing an internet video in a card", () => {
  it("frames YouTube's player at the second the watcher called out", () => {
    const player = playerFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 42)
    expect(player).toEqual({ url: "https://www.youtube.com/embed/dQw4w9WgXcQ?start=42&rel=0", site: "YouTube" })
  })

  it("knows YouTube by its other addresses", () => {
    const at = (url: string) => playerFor(url, 7)?.url
    const expected = "https://www.youtube.com/embed/abc123_-XYZ?start=7&rel=0"
    expect(at("https://youtu.be/abc123_-XYZ")).toBe(expected)
    expect(at("https://www.youtube.com/shorts/abc123_-XYZ")).toBe(expected)
    expect(at("https://m.youtube.com/watch?v=abc123_-XYZ")).toBe(expected)
    expect(at("https://www.youtube.com/live/abc123_-XYZ")).toBe(expected)
  })

  it("gives Vimeo its start time as a fragment, which is how Vimeo takes it", () => {
    expect(playerFor("https://vimeo.com/76979871", 90)?.url).toBe("https://player.vimeo.com/video/76979871#t=90s")
  })

  it("carries the hash an unlisted Vimeo video needs to be reached at all", () => {
    expect(playerFor("https://vimeo.com/76979871/a1b2c3d4e5", 0)?.url).toBe(
      "https://player.vimeo.com/video/76979871?h=a1b2c3d4e5#t=0s",
    )
  })

  it("frames Dailymotion", () => {
    expect(playerFor("https://www.dailymotion.com/video/x7tgad0", 12)?.url).toBe(
      "https://www.dailymotion.com/embed/video/x7tgad0?start=12",
    )
    expect(playerFor("https://dai.ly/x7tgad0", 12)?.url).toBe("https://www.dailymotion.com/embed/video/x7tgad0?start=12")
  })

  it("hands Facebook the page, because that is what its player takes", () => {
    const player = playerFor("https://www.facebook.com/jimmyoyang/videos/1234567890/", 30)
    // The frame's host is facebook.com whatever the page was, because the page
    // travels as a parameter rather than as part of the address.
    expect(player?.url.startsWith("https://www.facebook.com/plugins/video.php?href=")).toBe(true)
    expect(player?.url).toContain(encodeURIComponent("https://www.facebook.com/jimmyoyang/videos/1234567890/"))
    expect(player?.url).toContain("&t=30")
    expect(player?.site).toBe("Facebook")
  })

  it("says no to a site it does not know, rather than framing it", () => {
    // A page address came back from a search engine, so it came from the
    // internet. Anything not recognised is shown as a picture and a link out,
    // and never put inside the page.
    expect(playerFor("https://videos.example.com/watch/1", 5)).toBeNull()
    expect(playerFor("https://notyoutube.com/watch?v=abc", 5)).toBeNull()
  })

  it("says no to an address that is not a page at all", () => {
    expect(playerFor("javascript:alert(1)", 0)).toBeNull()
    expect(playerFor("data:text/html,<script>alert(1)</script>", 0)).toBeNull()
    expect(playerFor("not a url", 0)).toBeNull()
  })

  it("will not carry an id that is not shaped like one", () => {
    // The id goes into an address, so it has to be an id and nothing else.
    expect(playerFor("https://www.youtube.com/watch?v=../../evil", 0)).toBeNull()
    expect(playerFor("https://vimeo.com/not-a-number", 0)).toBeNull()
  })

  it("starts at the beginning when there is no sensible second to start at", () => {
    for (const seconds of [undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(playerFor("https://youtu.be/abc123_-XYZ", seconds)?.url).toContain("start=0")
    }
  })

  it("rounds a fractional second down, since a site will not take a fraction", () => {
    expect(playerFor("https://youtu.be/abc123_-XYZ", 41.8)?.url).toContain("start=41")
  })
})

describe("naming the site a video is on", () => {
  it("uses the name a person would say", () => {
    expect(siteName("https://www.youtube.com/watch?v=abc123_-XYZ")).toBe("YouTube")
    expect(siteName("https://fb.watch/abc123")).toBe("Facebook")
    expect(siteName("https://vimeo.com/76979871")).toBe("Vimeo")
  })

  it("falls back to the bare host for a site with no name of its own", () => {
    expect(siteName("https://videos.example.com/watch/1")).toBe("videos.example.com")
    expect(siteName("https://www.example.com/watch/1")).toBe("example.com")
  })

  it("has nothing to say about something that is not a page", () => {
    expect(siteName("not a url")).toBeNull()
  })
})
