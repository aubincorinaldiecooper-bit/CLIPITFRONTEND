import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The publish flow's arithmetic and its honesty, held still:
 * - the calendar never offers yesterday and never mislabels a weekday;
 * - the confirmation speaks clock time the way a person does;
 * - a batch publish reports the truth per clip — a failure is named, never
 *   averaged away into a summary.
 */

const publishClip = vi.fn()
vi.mock("../lib/api", () => ({
  api: { publishClip },
  ApiError: class ApiError extends Error {},
}))

const { monthGrid, speakTime, scheduleDate, localIso, publishEach } = await import(
  "../components/theater/publish-flow"
)

beforeEach(() => vi.clearAllMocks())

describe("monthGrid — the calendar's weeks", () => {
  it("starts August 2026 on a Saturday and ends on a Monday, like the owner's screen", () => {
    const weeks = monthGrid(2026, 7, new Date(2026, 7, 30))
    // 1 Aug 2026 is a Saturday: six leading blanks.
    expect(weeks[0]!.slice(0, 6).every((cell) => cell === null)).toBe(true)
    expect(weeks[0]![6]).toMatchObject({ day: 1 })
    // 31 Aug is a Monday: the last week is 30, 31, then blanks.
    const last = weeks.at(-1)!
    expect(last[0]).toMatchObject({ day: 30 })
    expect(last[1]).toMatchObject({ day: 31 })
    expect(last.slice(2).every((cell) => cell === null)).toBe(true)
  })

  it("disables every day before today, and nothing from today on", () => {
    const weeks = monthGrid(2026, 7, new Date(2026, 7, 30))
    const cells = weeks.flat().filter((cell) => cell !== null)
    expect(cells.filter((cell) => cell.disabled).map((cell) => cell.day)).toEqual(
      Array.from({ length: 29 }, (_, i) => i + 1),
    )
    expect(cells.find((cell) => cell.day === 30)!.disabled).toBe(false)
    expect(cells.find((cell) => cell.day === 31)!.disabled).toBe(false)
  })

  it("a future month has no disabled days; February keeps leap years honest", () => {
    const march = monthGrid(2026, 8, new Date(2026, 7, 30))
    expect(march.flat().filter((cell) => cell !== null).some((cell) => cell.disabled)).toBe(false)
    const leapFeb = monthGrid(2028, 1, new Date(2026, 7, 30)).flat().filter((cell) => cell !== null)
    expect(leapFeb.at(-1)!.day).toBe(29)
  })
})

describe("speakTime — clock words", () => {
  it("says 6:00 PM, 12:00 PM, 12:05 AM the way a person does", () => {
    expect(speakTime("18:00")).toBe("6:00 PM")
    expect(speakTime("12:00")).toBe("12:00 PM")
    expect(speakTime("00:05")).toBe("12:05 AM")
    expect(speakTime("09:30")).toBe("9:30 AM")
  })
})

describe("scheduleDate — the chosen minute", () => {
  it("combines a picked day and time in local terms", () => {
    const when = scheduleDate(localIso(2026, 7, 31), "18:00")!
    expect(when.getFullYear()).toBe(2026)
    expect(when.getMonth()).toBe(7)
    expect(when.getDate()).toBe(31)
    expect(when.getHours()).toBe(18)
    expect(when.getMinutes()).toBe(0)
  })

  it("refuses to invent a date from a missing day", () => {
    expect(scheduleDate(null, "18:00")).toBeNull()
  })
})

describe("publishEach — the truth per clip", () => {
  const clips = [
    { id: "clip-1", title: "Green Mercedes reveal", ready: true },
    { id: "clip-2", title: "Gas station at night", ready: true },
  ]

  it("posts each clip and reports rendering separately from submitted", async () => {
    publishClip
      .mockResolvedValueOnce({ posts: [{ status: "submitted" }] })
      .mockResolvedValueOnce({ posts: [{ status: "rendering" }] })

    const outcomes = await publishEach(clips, { caption: "hello", accountIds: ["acct-1"] })

    expect(publishClip).toHaveBeenNthCalledWith(1, "clip-1", { caption: "hello", accountIds: ["acct-1"] })
    expect(outcomes).toEqual([
      { clipId: "clip-1", title: "Green Mercedes reveal", ok: true, detail: "submitted" },
      { clipId: "clip-2", title: "Gas station at night", ok: true, detail: "rendering" },
    ])
  })

  it("a scheduled submission carries scheduledAt and reports 'scheduled'", async () => {
    publishClip.mockResolvedValue({ scheduled: { id: "sched-1" } })
    const outcomes = await publishEach([clips[0]!], {
      caption: "",
      accountIds: [],
      scheduledAt: "2026-08-31T18:00:00.000Z",
    })
    // Empty selection means "all connected" — the field is omitted, never [].
    expect(publishClip).toHaveBeenCalledWith("clip-1", { caption: "", scheduledAt: "2026-08-31T18:00:00.000Z" })
    expect(outcomes[0]).toMatchObject({ ok: true, detail: "scheduled" })
  })

  it("one clip's refusal is reported on that clip; the other still goes out", async () => {
    const { ApiError } = await import("../lib/api")
    publishClip
      .mockRejectedValueOnce(new (ApiError as unknown as new (message: string) => Error)("This clip is not ready yet"))
      .mockResolvedValueOnce({ posts: [{ status: "submitted" }] })

    const outcomes = await publishEach(clips, { caption: "", accountIds: ["acct-1"] })

    expect(outcomes[0]).toMatchObject({ ok: false, detail: "This clip is not ready yet" })
    expect(outcomes[1]).toMatchObject({ ok: true, detail: "submitted" })
  })
})

describe("postTimeSlots — the times panel", () => {
  it("offers every half hour of the day, spoken as clock time", async () => {
    const { postTimeSlots } = await import("../components/theater/publish-flow")
    const slots = postTimeSlots()
    expect(slots).toHaveLength(48)
    expect(slots[0]).toBe("00:00")
    expect(slots[18]).toBe("09:00")
    expect(slots.at(-1)).toBe("23:30")
    expect(speakTime(slots[18]!)).toBe("9:00 AM")
  })
})
