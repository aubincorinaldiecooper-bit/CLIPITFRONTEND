/**
 * The phone stage's arithmetic: how the sheet and the footage above it share
 * the screen, to the owner's reference (2026-09-14: Instagram's comment
 * view).
 *
 * With the sheet down the footage is the player, edge to edge: the screen's
 * width, and every pixel between the way back and the sheet (the owner,
 * 2026-09-14 — "when the chat is collapsed it should just be the full
 * player, it's mobile"). A phone is taller than 9:16, so filling its width
 * leaves the picture a little taller than the room; the middle of it shows,
 * the way a reel does. With the sheet up the footage is a card about half
 * the screen wide and 3:4 tall, and the sheet takes everything else.
 */

export interface Size {
  width: number
  height: number
}

/** A card on the stage: its size, and the corners it wears there. */
export interface CardBox extends Size {
  radius: number
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
/** The open card's corners. Edge to edge it has none — a full-bleed picture is not a card. */
const OPEN_RADIUS = 18
/** The least thread an open sheet is worth: under this, a reply is a sliver between the question and the box. */
export const MIN_THREAD = 120
/** The least card worth keeping above an open sheet — still a picture. */
export const MIN_CARD = 120

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** Every pixel between the way back and a sheet `sheetHeight` tall. */
export function cardRoom(stageHeight: number, sheetHeight: number): number {
  return Math.max(0, stageHeight - TOP_ROW - sheetHeight)
}

/**
 * The sheet's height when it is up. The card's size is the reference and
 * the sheet has what it leaves — as long as that holds a thread worth
 * reading. When it does not (the keyboard has taken most of the screen),
 * the thread keeps its least height and the card shrinks to what is left,
 * down to the least card worth keeping; past that the sheet cannot rise
 * at all and stays at its peek (Devin's finding on #98). Never past the
 * room below the top row.
 */
export function openSheetHeight(stage: Size, peek: number): number {
  const room = Math.max(0, stage.height - TOP_ROW)
  const width = Math.min(stage.width * CARD_SHARE, CARD_MAX_WIDTH)
  const withCard = room - CARD_MARGIN * 2 - width / CARD_ASPECT
  const least = peek + MIN_THREAD
  if (withCard >= least) return Math.round(withCard)
  if (room - CARD_MARGIN * 2 - MIN_CARD >= least) return Math.round(least)
  return Math.round(Math.min(peek, room))
}

/** With the sheet down: the player, edge to edge, filling the room. */
export function peekCard(stage: Size, sheetHeight: number): CardBox {
  return { width: Math.round(stage.width), height: Math.round(cardRoom(stage.height, sheetHeight)), radius: 0 }
}

/** With the sheet up: the 3:4 card, about half the screen wide — narrower when the room is short. */
export function openCard(stage: Size, sheetHeight: number): CardBox {
  const room = Math.max(0, cardRoom(stage.height, sheetHeight) - CARD_MARGIN * 2)
  const width = Math.min(stage.width * CARD_SHARE, CARD_MAX_WIDTH, room * CARD_ASPECT)
  return { width: Math.round(width), height: Math.round(width / CARD_ASPECT), radius: OPEN_RADIUS }
}

/**
 * The card for a sheet `sheetHeight` tall, between its two resting places:
 * the peek card at `peek`, the open card at `open`, and on the way between
 * them a straight blend — which fits the room at every step, since each
 * resting card fits its own and the room shrinks in a straight line. When
 * the sheet cannot rise (the open height is the peek), the card is the
 * whole frame.
 */
export function cardAt(stage: Size, peek: number, open: number, sheetHeight: number): CardBox {
  const from = peekCard(stage, peek)
  if (open <= peek) return from
  const to = openCard(stage, open)
  const t = clamp((sheetHeight - peek) / (open - peek), 0, 1)
  const between = (a: number, b: number) => Math.round(a + (b - a) * t)
  return { width: between(from.width, to.width), height: between(from.height, to.height), radius: between(from.radius, to.radius) }
}
