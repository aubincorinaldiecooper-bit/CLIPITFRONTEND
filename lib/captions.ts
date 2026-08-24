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

/** The margin the renderer's clamp keeps between text and the frame edge. */
const EDGE_MARGIN_FRACTION = 0.01

/** Line height as a multiple of the font size, matching the renderer. */
export const LINE_HEIGHT_RATIO = 1.15

/** The width factor per face, exposed so the editor can size a text box. */
export function charWidthFactor(font: ClipCaption["font"]): number {
  return CHAR_WIDTH_FACTOR[font]
}

/**
 * How wide a caption block centred at xPct can be before the renderer would
 * clamp it back toward the middle. Text near an edge has less room, and the
 * editor has to wrap on the same budget or it would show a line that moves.
 */
export function usableWidthFraction(xPct: number): number {
  const x = xPct / 100
  const room = 2 * Math.min(x - EDGE_MARGIN_FRACTION, 1 - EDGE_MARGIN_FRACTION - x)
  return Math.max(0, Math.min(USABLE_WIDTH_FRACTION, room))
}

/**
 * How many characters fit on one line: the text column the editor drew,
 * never wider than the room that column has where it sits.
 */
export function maxCharsPerLine(
  font: ClipCaption["font"],
  sizePct: number,
  aspectRatio: number,
  xPct = 50,
  widthPct = 92,
): number {
  const budget = Math.min(widthPct / 100, usableWidthFraction(xPct))
  return Math.max(4, Math.floor((budget * aspectRatio * 100) / (CHAR_WIDTH_FACTOR[font] * sizePct)))
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
