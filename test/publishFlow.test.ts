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

const { monthGrid, speakTime, scheduleDate, localIso, publishEach, speakList } = await import(
  "../components/theater/publish-flow"
)
const { phaseOf, progressOf, retryPlans, mergeOutcome, countsOf } = await import("../components/theater/publish-progress")

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
      .mockResolvedValueOnce({ posts: [{ id: "p1", status: "submitted", aspect: "9:16", targets: [{ platform: "tiktok" }] }] })
      .mockResolvedValueOnce({ posts: [{ id: "p2", status: "rendering", aspect: "9:16", targets: [{ platform: "youtube" }] }] })

    const outcomes = await publishEach(clips, { caption: "hello", accountIds: ["acct-1"] })

    expect(publishClip).toHaveBeenNthCalledWith(1, "clip-1", { caption: "hello", accountIds: ["acct-1"] })
    // The posts the server named ride on the outcome: the Publish control
    // reads its truth from them afterwards.
    expect(outcomes).toEqual([
      { clipId: "clip-1", title: "Green Mercedes reveal", ok: true, detail: "submitted", posts: [{ id: "p1", status: "submitted", platforms: ["tiktok"] }] },
      { clipId: "clip-2", title: "Gas station at night", ok: true, detail: "rendering", posts: [{ id: "p2", status: "rendering", platforms: ["youtube"] }] },
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
    expect(outcomes[0]).toMatchObject({ ok: true, detail: "scheduled", posts: [] })
  })

  it("a server that names only the singular post has still made one, and it is recorded", async () => {
    // Devin's and Codex's finding on #77: the older shape left the outcome
    // with no posts, the control read the accepted clip as never sent, and
    // Publish came back for a second press.
    publishClip.mockResolvedValueOnce({ post: { id: "p9", clipId: "clip-1", status: "submitted" } })
    const outcomes = await publishEach([clips[0]!], { caption: "", accountIds: ["acct-1"] })
    expect(outcomes[0]).toMatchObject({ ok: true, detail: "submitted", posts: [{ id: "p9", status: "submitted", platforms: [] }] })
  })

  it("one clip's refusal is reported on that clip; the other still goes out", async () => {
    const { ApiError } = await import("../lib/api")
    publishClip
      .mockRejectedValueOnce(new (ApiError as unknown as new (message: string) => Error)("This clip is not ready yet"))
      .mockResolvedValueOnce({ posts: [{ id: "p2", status: "submitted", aspect: "9:16", targets: [{ platform: "tiktok" }] }] })

    const outcomes = await publishEach(clips, { caption: "", accountIds: ["acct-1"] })

    expect(outcomes[0]).toMatchObject({ ok: false, detail: "This clip is not ready yet", posts: [] })
    expect(outcomes[1]).toMatchObject({ ok: true, detail: "submitted" })
  })
})

describe("the Publish control's truth — read from the posts, never from the 202", () => {
  const made = (id: string, status = "submitted", platforms = ["tiktok"]) => ({ id, status, platforms })
  const ok = (clipId: string, posts: ReturnType<typeof made>[]) => ({ clipId, title: clipId, ok: true, detail: "submitted", posts })
  const refused = (clipId: string) => ({ clipId, title: clipId, ok: false, detail: "no", posts: [] })
  const seen = (id: string, outcome: "posting" | "posted" | "failed", status: string, accountId = "acc-1", platform = "tiktok") => ({
    id, clipId: "clip-1", status, outcome, targets: [{ platform, accountId }], createdAt: "2026-09-02T18:00:00.000Z",
  })

  it("a post the server has not been asked about yet is on its way, with what the 202 said", () => {
    const progress = progressOf([ok("clip-1", [made("p1", "rendering", ["youtube"])])], new Map())
    expect(progress).toEqual([{ postId: "p1", clipId: "clip-1", platforms: ["youtube"], accountIds: [], status: "rendering", outcome: "posting" }])
  })

  it("a post the server names takes the server's word, and the accounts it went to", () => {
    const progress = progressOf([ok("clip-1", [made("p1")])], new Map([["clip-1", [seen("p1", "posted", "published")]]]))
    expect(progress[0]).toMatchObject({ outcome: "posted", status: "published", accountIds: ["acc-1"] })
  })

  it("is Uploading while any post is on its way, Published only when every post is up, Try again on a refusal, Sent when waited out", () => {
    const up = { postId: "p1", clipId: "c", platforms: ["tiktok"], accountIds: ["a"], status: "published", outcome: "posted" as const }
    const going = { ...up, postId: "p2", status: "submitted", outcome: "posting" as const }
    const down = { ...up, postId: "p3", status: "failed", outcome: "failed" as const }
    const none = { refused: 0, blind: 0 }
    expect(phaseOf([up, going], none, false)).toBe("publishing")
    expect(phaseOf([up], none, false)).toBe("published")
    expect(phaseOf([up, down], none, false)).toBe("failed")
    expect(phaseOf([up], { refused: 1, blind: 0 }, false)).toBe("failed")
    expect(phaseOf([going], none, true)).toBe("sent")
    expect(phaseOf([going, down], none, true)).toBe("failed")
    expect(phaseOf([], none, false)).toBe("idle")
    // A clip accepted with nothing to ask about went; that is all that is known — never Published.
    expect(phaseOf([], { refused: 0, blind: 1 }, false)).toBe("sent")
    expect(phaseOf([up], { refused: 0, blind: 1 }, false)).toBe("sent")
    expect(countsOf([ok("c1", []), ok("c2", [made("p")]), refused("c3"), { ...ok("c4", []), detail: "scheduled" }])).toEqual({ refused: 1, blind: 1 })
  })

  it("Try again sends only what did not go: every chosen account for a refused clip, a refused post's accounts, never one whose post is up", () => {
    const chosen = [{ id: "acc-1", platform: "tiktok" }, { id: "acc-2", platform: "youtube" }]
    const posts = [
      { postId: "p1", clipId: "clip-1", platforms: ["tiktok"], accountIds: ["acc-1"], status: "published", outcome: "posted" as const },
      { postId: "p2", clipId: "clip-1", platforms: ["youtube"], accountIds: ["acc-2"], status: "failed", outcome: "failed" as const },
      { postId: "p3", clipId: "clip-3", platforms: ["youtube"], accountIds: [], status: "failed", outcome: "failed" as const },
      // clip-4: a retry was refused after TikTok had gone up — TikTok is not sent again.
      { postId: "p4", clipId: "clip-4", platforms: ["tiktok"], accountIds: [], status: "published", outcome: "posted" as const },
    ]
    expect(
      retryPlans([ok("clip-1", [made("p1"), made("p2")]), refused("clip-2"), ok("clip-3", [made("p3")]), { ...refused("clip-4"), posts: [made("p4")] }], posts, chosen),
    ).toEqual([
      { clipId: "clip-1", accountIds: ["acc-2"] },
      { clipId: "clip-2", accountIds: ["acc-1", "acc-2"] },
      { clipId: "clip-3", accountIds: ["acc-2"] },
      { clipId: "clip-4", accountIds: ["acc-2"] },
    ])
  })

  it("a retry's answer folds into what came before: the channel that is up stays, the refused post goes, the retry's posts join", () => {
    // Devin's and Codex's finding on #77: the retry replaced the whole
    // outcome, and the channel that had gone up read "Not sent".
    const prior = ok("clip-1", [made("p1", "published", ["tiktok"]), made("p2", "failed", ["youtube"])])
    const posts = [
      { postId: "p1", clipId: "clip-1", platforms: ["tiktok"], accountIds: ["acc-1"], status: "published", outcome: "posted" as const },
      { postId: "p2", clipId: "clip-1", platforms: ["youtube"], accountIds: ["acc-2"], status: "failed", outcome: "failed" as const },
    ]
    expect(mergeOutcome(prior, ok("clip-1", [made("p3", "submitted", ["youtube"])]), posts)).toEqual({
      ...ok("clip-1", []),
      posts: [made("p1", "published", ["tiktok"]), made("p3", "submitted", ["youtube"])],
    })
    // A refused retry keeps the posts that are up beside its refusal.
    expect(mergeOutcome(prior, refused("clip-1"), posts)).toEqual({ ...refused("clip-1"), posts: [made("p1", "published", ["tiktok"])] })
    // Progress reads those posts whatever the latest word was.
    expect(progressOf([{ ...refused("clip-1"), posts: [made("p1", "published", ["tiktok"])] }], new Map()).map((post) => post.postId)).toEqual(["p1"])
  })

  it("speaks a list the way a person does", () => {
    expect(speakList(["TikTok"])).toBe("TikTok")
    expect(speakList(["TikTok", "X"])).toBe("TikTok and X")
    expect(speakList(["TikTok", "YouTube Shorts", "X"])).toBe("TikTok, YouTube Shorts and X")
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
