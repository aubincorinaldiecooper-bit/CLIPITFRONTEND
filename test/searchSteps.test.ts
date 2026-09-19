import { describe, expect, it } from "vitest"
import { searchSteps, type SearchStepsInput } from "../components/start/search-steps"

const moment = (n: number, confidence = 0.9) => ({
  id: `m${n}`,
  pageUrl: `https://www.youtube.com/watch?v=v${n}`,
  title: `Video ${n}`,
  still: null,
  source: "youtube.com",
  marks: [{ startSeconds: 1, endSeconds: 9, description: "A thing happens.", confidence }],
  confidence,
})

const run = (over: Partial<SearchStepsInput>) =>
  searchSteps({ phase: "searching", moments: [], candidatesFound: 0, ...over })

const state = (steps: ReturnType<typeof searchSteps>, key: string) =>
  steps.find((s) => s.key === key)!.state

describe("what the step rows claim", () => {
  it("shows the first row working before anything is known", () => {
    const steps = run({ phase: "loading" })
    expect(state(steps, "found")).toBe("running")
    // Nothing has been watched, so nothing may be said about watching.
    expect(state(steps, "watched")).toBe("pending")
    expect(state(steps, "matched")).toBe("pending")
  })

  it("ticks every row when all seven were watched and five matched", () => {
    const steps = run({
      phase: "answered",
      outcome: "matched",
      candidatesFound: 7,
      candidatesWatched: 7,
      moments: [1, 2, 3, 4, 5].map((n) => moment(n)),
    })
    expect(state(steps, "found")).toBe("done")
    expect(state(steps, "watched")).toBe("done")
    expect(state(steps, "matched")).toBe("done")
  })

  /*
   * The 17 September failure, as a row state.
   *
   * Seven videos were found, every watch failed because the watcher had no
   * method to call, and the screen said "No results fit your search." Nobody
   * had opened a single video. The matched row must stay PENDING here: a grey
   * "nothing found" would be the same false claim in a smaller font, because
   * we never found out what was in them.
   */
  it("never says nothing was found when nothing was watched", () => {
    const steps = run({
      phase: "failed",
      outcome: "watch_failed",
      candidatesFound: 7,
      candidatesWatched: 0,
      failure: { kind: "video_model_unavailable", count: 28 },
    })
    expect(state(steps, "found")).toBe("done")
    expect(state(steps, "watched")).toBe("failed")
    expect(state(steps, "matched")).toBe("pending")
    expect(state(steps, "matched")).not.toBe("none")
    expect(state(steps, "matched")).not.toBe("done")
  })

  it("never leaves a green tick on watching when the search died mid-watch", () => {
    const steps = run({
      phase: "failed",
      outcome: "search_failed",
      candidatesFound: 7,
      candidatesWatched: 7,
      moments: [moment(1)],
      failure: { kind: "browser_unavailable", count: 4 },
    })
    // Every candidate had been watched when it died, which under a naive
    // count reads as a clean finish. It was not one.
    expect(state(steps, "watched")).not.toBe("done")
    expect(state(steps, "watched")).toBe("partial")
    expect(state(steps, "matched")).toBe("partial")
  })

  it("calls a complete watch with no matches an answer, not a failure", () => {
    const steps = run({
      phase: "answered",
      outcome: "no_matches",
      candidatesFound: 7,
      candidatesWatched: 7,
    })
    expect(state(steps, "matched")).toBe("none")
    expect(state(steps, "matched")).not.toBe("failed")
  })

  it("marks a part-watched search partly, not done and not failed", () => {
    const steps = run({
      phase: "answered",
      outcome: "partly_watched",
      candidatesFound: 7,
      candidatesWatched: 5,
      moments: [moment(1), moment(2)],
    })
    expect(state(steps, "watched")).toBe("partial")
    const watched = steps.find((s) => s.key === "watched")!
    expect(watched.amount).toBe("5 of 7")
    expect(watched.details.map((d) => d.meta)).toEqual(["5", "2"])
  })

  it("says how many were watched with nothing in them, so the listed ones do not read as all of them", () => {
    const steps = run({
      phase: "answered",
      outcome: "matched",
      candidatesFound: 7,
      candidatesWatched: 7,
      moments: [moment(1), moment(2), moment(3)],
    })
    const matched = steps.find((s) => s.key === "matched")!
    const aside = matched.details.filter((d) => d.aside)
    expect(aside).toHaveLength(1)
    expect(aside[0].label).toBe("4 more videos had nothing in them")
    // The three real ones are links; the remark is not.
    expect(matched.details.filter((d) => d.href)).toHaveLength(3)
    expect(aside[0].href).toBeUndefined()
  })

  it("keeps the remark singular when only one video was quiet", () => {
    const steps = run({
      phase: "answered",
      outcome: "matched",
      candidatesFound: 2,
      candidatesWatched: 2,
      moments: [moment(1)],
    })
    const matched = steps.find((s) => s.key === "matched")!
    expect(matched.details.filter((d) => d.aside)[0].label).toBe("1 more video had nothing in it")
  })

  it("reports a search that turned nothing up as nothing found, not as broken", () => {
    const steps = run({ phase: "answered", outcome: "no_candidates", candidatesFound: 0, candidatesWatched: 0 })
    expect(state(steps, "found")).toBe("none")
    // There was nothing to watch, so the watching never started.
    expect(state(steps, "watched")).toBe("pending")
    expect(state(steps, "matched")).toBe("pending")
  })

  it("never counts more watched than were found, whatever it is handed", () => {
    const steps = run({ phase: "answered", outcome: "matched", candidatesFound: 3, candidatesWatched: 99 })
    expect(steps.find((s) => s.key === "watched")!.amount).toBe("3 of 3")
  })

  it("puts no count beside a row that has nothing true to say yet", () => {
    const steps = run({ phase: "loading" })
    expect(steps.map((s) => s.amount)).toEqual(["", "", ""])
  })

  describe("once the pages themselves are sent", () => {
    const roll = [
      { id: "c1", page: "https://www.youtube.com/watch?v=a", source: "youtube.com", state: "watched" as const },
      { id: "c2", page: "https://vimeo.com/123", source: "vimeo.com", state: "unwatched" as const },
      { id: "c3", page: "https://www.dailymotion.com/video/x9", source: "dailymotion.com", state: "not_reached" as const },
    ]

    it("opens the first row onto what the search turned up", () => {
      const steps = run({ phase: "answered", outcome: "partly_watched", candidatesFound: 3, candidatesWatched: 1, candidates: roll })
      const first = steps.find((s) => s.key === "found")!
      expect(first.details.map((d) => d.label)).toEqual([
        "https://www.youtube.com/watch?v=a",
        "https://vimeo.com/123",
        "https://www.dailymotion.com/video/x9",
      ])
      // Display text. Some of these are pages nobody opened.
      expect(first.details.every((d) => d.href === undefined)).toBe(true)
    })

    /*
     * The distinction the whole payload change was made for.
     *
     * "We opened it and got nothing back" and "we never opened it" are
     * different facts, and collapsing them is how a search invents a failure
     * for a page nobody touched.
     */
    it("keeps a page that was tried apart from one that was never reached", () => {
      const steps = run({ phase: "answered", outcome: "partly_watched", candidatesFound: 3, candidatesWatched: 1, candidates: roll })
      const watched = steps.find((s) => s.key === "watched")!
      const named = watched.details.filter((d) => d.aside)
      expect(named.map((d) => [d.label, d.meta])).toEqual([
        ["https://vimeo.com/123", "no watch"],
        ["https://www.dailymotion.com/video/x9", "not reached"],
      ])
    })

    it("does not list the ones that were watched — the counts already say those", () => {
      const steps = run({ phase: "answered", outcome: "partly_watched", candidatesFound: 3, candidatesWatched: 1, candidates: roll })
      const watched = steps.find((s) => s.key === "watched")!
      expect(watched.details.some((d) => d.label.includes("youtube.com/watch?v=a"))).toBe(false)
      // The counts still lead.
      expect(watched.details.slice(0, 2).map((d) => d.meta)).toEqual(["1", "1"])
    })

    it("says nothing about pages when the reply does not carry them", () => {
      const steps = run({ phase: "answered", outcome: "partly_watched", candidatesFound: 3, candidatesWatched: 1 })
      expect(steps.find((s) => s.key === "found")!.details).toEqual([])
      // The counts survive on their own, so an older reply still reads right.
      expect(steps.find((s) => s.key === "watched")!.details.map((d) => [d.label, d.meta])).toEqual([
        ["Opened and watched", "1"],
        ["Not watched", "2"],
      ])
    })

    it("falls back to the site when an address could not be read", () => {
      const steps = run({
        phase: "answered",
        outcome: "matched",
        candidatesFound: 1,
        candidatesWatched: 1,
        candidates: [{ id: "c9", page: null, source: "example.com", state: "watched" as const }],
      })
      expect(steps.find((s) => s.key === "found")!.details[0].label).toBe("example.com")
    })

    /*
     * The summary line and the list under it must not contradict each other.
     *
     * `found - watched` lumps "we opened it and got nothing back" together
     * with "we never opened it at all". Caught by driving this in a browser:
     * the row read "Would not open: 3" directly above two pages marked no
     * watch and one marked not reached.
     */
    it("never counts a page nobody opened among the ones that would not open", () => {
      const steps = run({
        phase: "failed",
        outcome: "search_failed",
        candidatesFound: 4,
        candidatesWatched: 1,
        failure: { kind: "browser_unavailable", count: 2 },
        candidates: [
          { id: "c1", page: "https://a.example/1", source: "a.example", state: "watched" as const },
          { id: "c2", page: "https://b.example/2", source: "b.example", state: "unwatched" as const },
          { id: "c3", page: "https://c.example/3", source: "c.example", state: "unwatched" as const },
          { id: "c4", page: "https://d.example/4", source: "d.example", state: "not_reached" as const },
        ],
      })
      const watched = steps.find((s) => s.key === "watched")!
      const counts = watched.details.filter((d) => !d.aside)
      expect(counts.map((d) => [d.label, d.meta])).toEqual([
        ["Opened and watched", "1"],
        ["Would not open", "2"],
        ["Never reached", "1"],
      ])
      // And the three numbers account for every page, exactly once.
      expect(counts.reduce((total, d) => total + Number(d.meta), 0)).toBe(4)
    })
  })
})
