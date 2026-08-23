import type { ClipCaption } from "./types"

/**
 * The editor's mirror of the backend caption layout
 * (CLIPIT/src/services/media/captions.ts). SAME constants, SAME wrap
 * algorithm: the lines the preview shows are exactly the lines the render
 * burns, which is the whole meaning of a preview. Change either side only
 * together with the other.
 */

const CHAR_WIDTH_FACTOR: Record<ClipCaption["font"], number> = {
  sans: 0.5,
  bold: 0.53,
  serif: 0.5,
  mono: 0.6,
}

const USABLE_WIDTH_FRACTION = 0.92

/** How many characters fit on one line, from the frame's shape alone. */
export function maxCharsPerLine(font: ClipCaption["font"], sizePct: number, aspectRatio: number): number {
  return Math.max(4, Math.floor((USABLE_WIDTH_FRACTION * aspectRatio * 100) / (CHAR_WIDTH_FACTOR[font] * sizePct)))
}

/** Greedy word wrap; a word longer than a line is broken hard. */
export function wrapCaptionText(text: string, maxChars: number): string[] {
  const lines: string[] = []
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(/\s+/).filter((word) => word.length > 0)
    if (words.length === 0) continue
    let current = ""
    for (let word of words) {
      while (word.length > maxChars) {
        if (current) {
          lines.push(current)
          current = ""
        }
        lines.push(word.slice(0, maxChars))
        word = word.slice(maxChars)
      }
      if (!current) current = word
      else if (current.length + 1 + word.length <= maxChars) current = `${current} ${word}`
      else {
        lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
  }
  return lines.length > 0 ? lines : [text.trim() || " "]
}
