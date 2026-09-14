import { describe, expect, it } from "vitest"
import { stageFrame } from "../components/moments/use-stage-frame"

/**
 * The phone stage against the part of the page on screen. The keyboard
 * makes that part smaller and the browser pans it; the stage follows, so
 * the box stays above the keyboard and the footage above the box.
 */
describe("stageFrame", () => {
  it("fills from the stage's top to the bottom of the screen while the top is on screen", () => {
    // A 390 by 844 phone, the header 64px tall above the stage.
    expect(stageFrame({ top: 0, height: 844 }, 64)).toEqual({ height: 780, shift: 0 })
  })

  it("with the keyboard up and the page panned past the stage's top, takes the whole visible part and moves down to it", () => {
    // The keyboard took 336px; the browser panned the page 300px to show the box.
    expect(stageFrame({ top: 300, height: 508 }, 64)).toEqual({ height: 508, shift: 236 })
  })

  it("a pan that stops short of the stage's top only shortens the stage", () => {
    expect(stageFrame({ top: 20, height: 508 }, 64)).toEqual({ height: 464, shift: 0 })
  })

  it("never asks for a negative height", () => {
    expect(stageFrame({ top: 0, height: 40 }, 64)).toEqual({ height: 0, shift: 0 })
  })
})
