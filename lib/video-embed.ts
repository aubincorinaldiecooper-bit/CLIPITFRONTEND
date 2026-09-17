/**
 * Playing an internet video inside a card, at the second the watcher called out.
 *
 * A card cannot show the page the video lives on. Sites refuse to be put
 * inside another page, and they are right to: a page framed by a stranger is
 * how clickjacking works. What sites do publish, because they want to be
 * embedded, is a PLAYER — a small address made to sit in a frame, which takes
 * a start time. So the card frames the player, never the page.
 *
 * A page address here came back from a search engine, which is to say it came
 * from the internet, and it is about to become an iframe's `src`. So this is
 * an allowlist and not a parser: a site nobody here recognises returns null,
 * the card shows its picture and a link out, and nothing unrecognised is ever
 * framed. Every address returned is built from a fixed host and an id that had
 * to match a narrow shape to get this far.
 */

export interface VideoPlayer {
  /** The site's own player, ready to be framed. */
  url: string
  /** The site's name for itself, for "View on …". */
  site: string
}

/** The shape an id has to have before it is put in an address. */
const ID = /^[\w-]{1,64}$/
const DIGITS = /^\d{1,20}$/

/** What a site calls itself, where its hostname is not what a person says. */
const NAMES: Record<string, string> = {
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "vimeo.com": "Vimeo",
  "dailymotion.com": "Dailymotion",
  "dai.ly": "Dailymotion",
  "facebook.com": "Facebook",
  "fb.watch": "Facebook",
  "twitch.tv": "Twitch",
  "tiktok.com": "TikTok",
}

/** The bare host: no `www.`, no `m.`, lowercased. */
function hostOf(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return url.hostname.toLowerCase().replace(/^(?:www|m|mobile)\./, "")
  } catch {
    return null
  }
}

/**
 * The site a video is on, as a person would say it.
 *
 * This is the site, not the search engine that turned it up. The two are not
 * the same: a result found through a general video engine can be a page on
 * any site at all, and naming the finder would tell the reader nothing about
 * where they are going.
 */
export function siteName(pageUrl: string): string | null {
  const host = hostOf(pageUrl)
  if (!host) return null
  return NAMES[host] ?? host
}

/** Seconds as a whole number a site will accept, or nothing at all. */
function startAt(seconds: number | undefined): number {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.floor(seconds)
}

/**
 * The player for this page, at this second, or null if the site publishes none.
 *
 * Null is an ordinary answer, not a failure: plenty of sites host video without
 * offering a way to embed it. The card shows what it has — the picture, the
 * title, a link out — which is the honest thing to show for a video that cannot
 * be played where you are standing.
 */
export function playerFor(pageUrl: string, atSeconds?: number): VideoPlayer | null {
  const host = hostOf(pageUrl)
  if (!host) return null
  const site = NAMES[host] ?? host
  const start = startAt(atSeconds)

  let url: URL
  try {
    url = new URL(pageUrl)
  } catch {
    return null
  }
  const path = url.pathname.split("/").filter(Boolean)

  if (host === "youtube.com") {
    // watch?v=ID, and the three path shapes that carry the id directly.
    const id = url.searchParams.get("v") ?? (["shorts", "embed", "live", "v"].includes(path[0] ?? "") ? path[1] : null)
    if (!id || !ID.test(id)) return null
    // `rel=0` keeps the end screen to this channel rather than offering the
    // internet at large from inside our own results.
    return { url: `https://www.youtube.com/embed/${id}?start=${start}&rel=0`, site }
  }

  if (host === "youtu.be") {
    const id = path[0]
    if (!id || !ID.test(id)) return null
    return { url: `https://www.youtube.com/embed/${id}?start=${start}&rel=0`, site }
  }

  if (host === "vimeo.com") {
    // vimeo.com/123456789, and vimeo.com/123456789/HASH for an unlisted one,
    // whose hash is part of how the player is reached.
    const [id, hash] = path
    if (!id || !DIGITS.test(id)) return null
    if (hash !== undefined && !ID.test(hash)) return null
    const unlisted = hash ? `?h=${hash}` : ""
    // Vimeo takes its start time as a fragment, not a parameter.
    return { url: `https://player.vimeo.com/video/${id}${unlisted}#t=${start}s`, site }
  }

  if (host === "dailymotion.com" || host === "dai.ly") {
    const id = host === "dai.ly" ? path[0] : path[0] === "video" ? path[1] : null
    if (!id || !ID.test(id)) return null
    return { url: `https://www.dailymotion.com/embed/video/${id}?start=${start}`, site }
  }

  if (host === "facebook.com" || host === "fb.watch") {
    // Facebook's player takes the whole page address as a parameter rather
    // than an id, so the frame's host stays facebook.com whatever was passed.
    //
    // `t` is the start time its plugin documents. Unlike the other three, this
    // one has not been watched working against a live embed from here, so if
    // Facebook ignores it the video opens at the beginning rather than at the
    // moment — wrong, but not broken.
    const href = encodeURIComponent(url.toString())
    return { url: `https://www.facebook.com/plugins/video.php?href=${href}&t=${start}&show_text=false`, site }
  }

  return null
}
