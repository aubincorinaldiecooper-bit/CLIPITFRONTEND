import { describe, expect, it } from "vitest"
import { cardAt, frameHeight, openCard, openSheetHeight, peekCard } from "../components/moments/stage-layout"

/**
 * The phone stage's arithmetic, to the owner's reference (2026-09-14:
 * Instagram's comment view): a 390 by 844 phone, whose stage is the 780px
 * under the header, with the sheet's peek measured at 126px.
 */
const phone = { width: 390, height: 780 }
const peek = 126

describe("stage layout", () => {
  it("with the sheet down, the card is the whole 9:16 frame, as tall as the room above the sheet", () => {
    // 780 − 40 (top row) − 126 (peek) − 16 (margins) = 598 tall, 9:16 wide.
    expect(peekCard(phone, peek)).toEqual({ width: 336, height: 598 })
  })

  it("up, the sheet takes what the card leaves: the card is 55% of the width and 3:4 tall", () => {
    // 0.55 × 390 = 214.5 wide, 286 tall; the sheet is 780 − 40 − 16 − 286.
    expect(openSheetHeight(phone, peek)).toBe(438)
    expect(openCard(phone, 438)).toEqual({ width: 215, height: 286 })
  })

  it("the card never grows past its ceiling on a wide phone", () => {
    const wide = { width: 600, height: 900 }
    expect(openCard(wide, openSheetHeight(wide, peek)).width).toBe(280)
  })

  it("between the two resting places the card is a straight blend, which fits the room at every step", () => {
    const open = openSheetHeight(phone, peek)
    expect(cardAt(phone, peek, open, peek)).toEqual(peekCard(phone, peek))
    expect(cardAt(phone, peek, open, open)).toEqual(openCard(phone, open))
    const midway = cardAt(phone, peek, open, (peek + open) / 2)
    expect(midway).toEqual({ width: 276, height: 442 })
    // The room halfway is 780 − 40 − 282 − 16 = 442: the card fills it exactly.
    expect(midway.height).toBe(442)
  })

  it("with the keyboard up, the thread keeps its least height and the card shrinks to what is left", () => {
    // iOS, panned: the stage is the whole 508px visible. The reference card
    // would leave the thread 40px; instead the thread gets 120 and the card
    // the 206 that remain, still 3:4.
    const panned = { width: 390, height: 508 }
    expect(openSheetHeight(panned, peek)).toBe(246)
    expect(openCard(panned, 246)).toEqual({ width: 155, height: 206 })
    // The same rule, with 444 of it the stage.
    const short = { width: 390, height: 444 }
    expect(openSheetHeight(short, peek)).toBe(246)
    expect(openCard(short, 246)).toEqual({ width: 107, height: 142 })
  })

  it("when not even the least card fits above the least thread, the sheet cannot rise, and the card is the whole frame", () => {
    const cramped = { width: 390, height: 300 }
    expect(openSheetHeight(cramped, peek)).toBe(peek)
    expect(cardAt(cramped, peek, peek, peek)).toEqual(peekCard(cramped, peek))
  })

  it("the frame behind the card is the whole 9:16 picture at the card's width", () => {
    expect(frameHeight({ width: 215, height: 286 })).toBe(382)
    // When the card is the frame, the frame is exactly the card — not a pixel short of it.
    expect(frameHeight({ width: 336, height: 598 })).toBe(598)
  })

  it("never asks for a sheet past the room below the top row, however tall the peek", () => {
    const tiny = { width: 390, height: 120 }
    expect(openSheetHeight(tiny, 118)).toBe(80)
  })
})
