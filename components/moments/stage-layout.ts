/**
 * The phone stage's arithmetic: how the sheet and the card above it share
 * the screen, to the owner's reference (2026-09-14: Instagram's comment
 * view). With the sheet down the footage is the whole 9:16 frame, as large
 * as the room allows. With the sheet up it is a card about half the screen
 * wide and 3:4 tall — a window onto the middle of the frame — pinned above
 * the sheet, which takes everything else.
 */

export interface Size {
  width: number
  height: number
}

/** The stage's top row — the way back — in pixels. */
export const TOP_ROW = 40
/** Above and below the card. */
export const CARD_MARGIN = 8
/** The open card's width as a share of the stage's width, and its ceiling. */
export const CARD_SHARE = 0.55
export const CARD_MAX_WIDTH = 280
/** The open card's shape: width over height. */
export const CARD_ASPECT = 3 / 4
/** The footage's frame, width over height: every delivered clip is 9:16. */
export const FRAME_ASPECT = 9 / 16
/** The card's side margins when it is the whole frame. */
const FRAME_GUTTER = 16

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** The room the card has above a sheet `sheetHeight` tall. */
export function cardRoom(stageHeight: number, sheetHeight: number): number {
  return Math.max(0, stageHeight - TOP_ROW - sheetHeight - CARD_MARGIN * 2)
}

/**
 * The sheet's height when it is up: what is left once the card has its room
 * — never under the peek, never past the room below the top row. The card's
 * size is the reference; the sheet's is what follows from it.
 */
export function openSheetHeight(stage: Size, peek: number): number {
  const width = Math.min(stage.width * CARD_SHARE, CARD_MAX_WIDTH)
  const room = Math.max(0, stage.height - TOP_ROW)
  return Math.round(clamp(stage.height - TOP_ROW - CARD_MARGIN * 2 - width / CARD_ASPECT, Math.min(peek, room), room))
}

/** With the sheet down: the whole frame, as large as the room allows. */
export function peekCard(stage: Size, sheetHeight: number): Size {
  const height = Math.min(cardRoom(stage.height, sheetHeight), (stage.width - FRAME_GUTTER * 2) / FRAME_ASPECT)
  return { width: Math.round(height * FRAME_ASPECT), height: Math.round(height) }
}

/** With the sheet up: the 3:4 card, about half the screen wide — narrower when the room is short. */
export function openCard(stage: Size, sheetHeight: number): Size {
  const width = Math.min(stage.width * CARD_SHARE, CARD_MAX_WIDTH, cardRoom(stage.height, sheetHeight) * CARD_ASPECT)
  return { width: Math.round(width), height: Math.round(width / CARD_ASPECT) }
}

/**
 * The card for a sheet `sheetHeight` tall, between its two resting places:
 * the peek card at `peek`, the open card at `open`, and on the way between
 * them a straight blend — which fits the room at every step, since each
 * resting card fits its own and the room shrinks in a straight line. When
 * the sheet cannot rise (the open height is the peek), the card is the
 * whole frame.
 */
export function cardAt(stage: Size, peek: number, open: number, sheetHeight: number): Size {
  const from = peekCard(stage, peek)
  if (open <= peek) return from
  const to = openCard(stage, open)
  const t = clamp((sheetHeight - peek) / (open - peek), 0, 1)
  return { width: Math.round(from.width + (to.width - from.width) * t), height: Math.round(from.height + (to.height - from.height) * t) }
}

/**
 * The 9:16 frame's height at the card's width — the whole picture, of which
 * the card shows the middle. Never shorter than the card: when the card IS
 * the frame, a rounding's worth of card showing under the picture would be
 * a hairline gap.
 */
export function frameHeight(card: Size): number {
  return Math.max(card.height, Math.round(card.width / FRAME_ASPECT))
}
