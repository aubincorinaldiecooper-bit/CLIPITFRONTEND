import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MomentConversation } from "../components/moments/moment-conversation"
import type { Exchange } from "../components/start/types"
import type { Video } from "../lib/types"
import { acceptingRate, exchange, match, moments, refusingRate, video } from "./support/moments"

/**
 * One moment and the conversation about it — the third screen of the
 * owner's prototype (2026-09-14). The words are the search's own, the
 * rules are the dialogue's: an edit of this moment goes to Re-clip and
 * says what a re-cut can and cannot do; a question is a new search; a
 * refused ask stays in the box; a rating is drawn only once it is taken.
 */
function renderPage(
  one: Exchange,
  props: Partial<React.ComponentProps<typeof MomentConversation>> = {},
  forVideo: Video | null = video,
) {
  const list = moments([one], forVideo)
  return render(
    <MomentConversation
      moment={list[0]!}
      exchange={one}
      video={forVideo}
      moments={list}
      followUp={false}
      searching={false}
      backHref="/start?video=video-1&search=req-1"
      onBack={vi.fn()}
      onAsk={vi.fn()}
      onReclip={vi.fn()}
      {...props}
    />,
  )
}

afterEach(cleanup)

const box = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Ask about this moment" })
const said = () => screen.getAllByTestId("conversation-model").map((node) => node.textContent)
const words = () => screen.getByTestId("answer-words").textContent ?? ""

describe("MomentConversation", () => {
  it("shows the question, what Clipit understood about this moment, and where it sits", () => {
    renderPage(exchange({ matches: [match(), match({ id: "m2", confidence: 0.5 })] }))
    expect(screen.getByTestId("conversation-question").textContent).toBe("find the harbour")
    // The moment, not the search: how many were found belongs to the results page.
    expect(words()).toBe("Harbour skyline")
    expect(document.body.textContent).not.toContain("Found 2 moments")
    expect(screen.getByTestId("answer-metadata").textContent).toBe("0:10–0:34· seen· from what I'd noted")
    // The player plays exactly the moment, from the source.
    expect((screen.getByTestId("moment-video") as HTMLVideoElement).getAttribute("src")).toBe("https://cdn.test/proxy.mp4?sig=1#t=10")
    expect(screen.getByRole("link", { name: "All moments" }).getAttribute("href")).toBe("/start?video=video-1&search=req-1")
  })

  it("quotes the spoken line when the moment was found by what was said", () => {
    renderPage(exchange({ matches: [match({ source: "multimodal", quote: "let's go" })] }))
    expect(words()).toBe("Harbour skyline")
    expect(screen.getByTestId("answer-quote").textContent).toBe("“let's go”")
    expect(screen.getByTestId("answer-metadata").textContent).toContain("seen and heard")
    cleanup()
    renderPage(exchange())
    expect(screen.queryByTestId("answer-quote")).toBeNull()
  })

  it("while the search is still running, says what it is doing rather than an answer", () => {
    renderPage(exchange({ status: "searching", progress: { stage: "search", percent: 20, chunksTotal: 5, chunksCompleted: 2, chunksFailed: 0, message: "", candidatesFound: 1 } }), { searching: true })
    expect(screen.getByTestId("conversation-thread").textContent).toContain("I'll look for that.")
    expect(screen.getByTestId("conversation-thread").textContent).toContain("Watching the footage — 2 of 5 parts…")
    expect(screen.getByTestId("conversation-thread").textContent).toContain("1 possible moment so far…")
    expect(screen.queryByTestId("answer")).toBeNull()
    expect(box().disabled).toBe(true)
    expect(box().placeholder).toBe("Still looking…")
  })

  it("the box asks about this moment, and says nothing about workflows", () => {
    renderPage(exchange())
    expect(box().placeholder).toBe("Ask about this moment…")
    expect(document.body.textContent).not.toContain("publish")
    expect(document.body.textContent).not.toContain("reworks")
  })

  it("a kept moment's file is news on the picture, not a line in the conversation", () => {
    const kept = exchange({ matches: [match({ feedback: "approved", clip: { id: "c-a", status: "generating" } })] })
    const { rerender } = renderPage(kept)
    expect(screen.getByTestId("moment-decision").textContent).toBe("Kept · cutting…")
    expect(screen.queryByTestId("conversation-model")).toBeNull()
    const failed = exchange({ matches: [match({ feedback: "approved", clip: { id: "c-a", status: "failed" } })] })
    const list = moments([failed])
    rerender(
      <MomentConversation moment={list[0]!} exchange={failed} video={video} moments={list} followUp={false} searching={false} backHref="#" onBack={vi.fn()} onAsk={vi.fn()} onReclip={vi.fn()} muted onMutedChange={vi.fn()} />,
    )
    expect(screen.getByTestId("moment-decision").textContent).toBe("Kept · cut failed")
  })

  it("a new question is a search, and leaves the box once it was taken", async () => {
    const onAsk = vi.fn(async () => true)
    renderPage(exchange(), { onAsk })
    await userEvent.type(box(), "find the goal{enter}")
    expect(onAsk).toHaveBeenCalledWith("find the goal")
    await waitFor(() => expect(box().value).toBe(""))
  })

  it("keeps a question the server refused in the box, to edit and send again", async () => {
    const onAsk = vi.fn(async () => false)
    renderPage(exchange(), { onAsk })
    await userEvent.type(box(), "find the goal{enter}")
    expect(onAsk).toHaveBeenCalledWith("find the goal")
    expect(box().value).toBe("find the goal")
    onAsk.mockResolvedValueOnce(true as never)
    await userEvent.type(box(), "{enter}")
    expect(onAsk).toHaveBeenCalledTimes(2)
    expect(onAsk).toHaveBeenLastCalledWith("find the goal")
    await waitFor(() => expect(box().value).toBe(""))
  })

  it("words about the moment on screen go to Re-clip, and the reply does not pretend the words were followed", async () => {
    const onReclip = vi.fn(async () => true)
    const onAsk = vi.fn()
    const { rerender } = renderPage(exchange(), { onReclip, onAsk })
    await userEvent.type(box(), "trim the slow intro off this one{enter}")
    expect(onReclip).toHaveBeenCalledTimes(1)
    expect(onAsk).not.toHaveBeenCalled()
    expect(screen.getByTestId("conversation-user").textContent).toBe("trim the slow intro off this one")
    // The note follows the moment: the page re-reads it as reworking.
    const reworking = exchange({ matches: [match({ reclipStatus: "pending" })] })
    const list = moments([reworking])
    rerender(
      <MomentConversation moment={list[0]!} exchange={reworking} video={video} moments={list} followUp={false} searching={false} backHref="#" onBack={vi.fn()} onAsk={onAsk} onReclip={onReclip} muted onMutedChange={vi.fn()} />,
    )
    expect(said().at(-1)).toContain("not the change you described")
    expect(screen.getByTestId("reworking-overlay")).toBeTruthy()
  })

  it("a re-cut can name another moment by number, the way the stage counts", async () => {
    const onReclip = vi.fn(async () => true)
    renderPage(exchange({ matches: [match({ id: "a" }), match({ id: "b", confidence: 0.5, description: "The dunk" })] }), { onReclip })
    await userEvent.type(box(), "re-cut moment 2{enter}")
    expect(onReclip).toHaveBeenCalledTimes(1)
    expect(onReclip.mock.calls[0]![0].match.id).toBe("b")
    await userEvent.type(box(), "re-cut moment 5{enter}")
    expect(onReclip).toHaveBeenCalledTimes(1)
    expect(said().at(-1)).toBe("There's no moment 5 here — there are 2.")
  })

  it("says a re-cut did not start when the server refused it, instead of claiming it is underway", async () => {
    const onReclip = vi.fn(async () => false)
    renderPage(exchange(), { onReclip })
    await userEvent.type(box(), "re-cut it{enter}")
    expect(onReclip).toHaveBeenCalledTimes(1)
    expect(said().at(-1)).toContain("could not be re-cut just now")
    expect(said().at(-1)).not.toContain("Re-cutting")
  })

  it("refuses a re-cut it cannot give, in words, and offers the action only while one is left", async () => {
    const onReclip = vi.fn()
    renderPage(exchange({ matches: [match({ reclipsRemaining: 0 })] }), { onReclip })
    expect(screen.queryByTestId("action-reclip")).toBeNull()
    await userEvent.type(box(), "re-cut it{enter}")
    expect(onReclip).not.toHaveBeenCalled()
    expect(said().at(-1)).toBe('"Harbour skyline" has used all its re-cuts.')
  })

  it("the small action is the same re-cut as the words, and sits under the answer, not as a chip", async () => {
    const onReclip = vi.fn(async () => true)
    renderPage(exchange(), { onReclip })
    expect(screen.queryByText("Re-cut this moment")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Re-cut this moment" }))
    expect(onReclip).toHaveBeenCalledTimes(1)
    expect(onReclip.mock.calls[0]![0].match.id).toBe("match-1")
  })

  it("offers the file to save only once the 9:16 file exists", () => {
    const media = {
      composition: { aspectRatio: "9:16", mode: "smart_crop", focalX: 0.5, focalY: 0.5, focusPct: 50, crop: null },
      url: "https://cdn.test/clips/v/c-a-vertical.mp4?sig=1",
      downloadUrl: "https://cdn.test/save.mp4",
      canonicalUrl: "https://cdn.test/clips/v/c-a.mp4?sig=1",
      posterUrl: "https://cdn.test/posters/c-a.jpg",
      posterTimestampSeconds: 1,
      sourceAspectRatio: "16:9",
      outputAspectRatio: "9:16",
      compositionMode: "smart_crop",
      derivativeStatus: "ready",
    }
    renderPage(exchange({ matches: [match({ feedback: "approved", clip: { id: "c-a", status: "ready" } })] }, [{ id: "c-a", clipMatchId: "match-1", status: "ready", url: "https://cdn.test/clips/v/c-a.mp4?sig=1", media } as never]))
    expect(screen.getByTestId("action-download").getAttribute("href")).toBe("https://cdn.test/save.mp4")
    expect(screen.queryByText("Download")).toBeNull()
    // And the player plays the finished file, not the source.
    expect((screen.getByTestId("moment-video") as HTMLVideoElement).getAttribute("src")).toBe("https://cdn.test/clips/v/c-a-vertical.mp4?sig=1")
  })

  it("takes a question as soon as the upload has landed, and says what it is waiting on before then", () => {
    const landed = { ...video, status: "preprocessing", readyForSearch: false, acceptsQuestions: true } as unknown as Video
    renderPage(exchange(), {}, landed)
    expect(box().disabled).toBe(false)
    cleanup()
    const uploading = { ...video, status: "pending_upload", readyForSearch: false, acceptsQuestions: false } as unknown as Video
    renderPage(exchange(), {}, uploading)
    expect(box().disabled).toBe(true)
    expect(box().placeholder).toBe("Your video is still uploading…")
  })
})

/** Makes the page believe it is on a phone: the one media query the stage asks about matches. */
function onAPhone() {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: query === "(width < 860px)",
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

describe("On a phone: the footage above, the conversation a sheet below", () => {
  let widen: () => void
  beforeEach(() => {
    widen = onAPhone()
  })
  afterEach(() => widen())

  const sheet = () => screen.getByTestId("conversation-sheet")
  const handle = () => screen.getByRole("button", { name: /the conversation/ })

  it("rests as a peek — the question and the box — with the thread put away, and the footage sized by the room it has", async () => {
    renderPage(exchange())
    await waitFor(() => expect(sheet().dataset.state).toBe("peek"))
    expect(handle().getAttribute("aria-expanded")).toBe("false")
    expect(screen.getByTestId("conversation-question").textContent).toBe("find the harbour")
    expect(box()).toBeTruthy()
    // The thread is in the page for the sheet to show; the peek's CSS puts it away.
    expect(screen.getByTestId("conversation-thread").className).toContain("max-[860px]:hidden")
    // At rest the sheet is exactly the peek tall (jsdom measures nothing, so the fallback stands),
    // and the card is the whole 9:16 frame in the room above it (jsdom's window is 1024 by 768).
    expect(sheet().style.height).toBe("118px")
    const card = screen.getByTestId("footage-card")
    expect([card.style.width, card.style.height]).toEqual(["334px", "594px"])
    expect(screen.getByTestId("moment-player").className).toContain("max-[860px]:size-full")
    expect(screen.queryByTestId("card-sound")).toBeNull()
    // Down, the card is the whole frame and the player's own controls are in it.
    expect(screen.getByRole("button", { name: "Expand" })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: /^(Mute|Unmute)$/ })).toHaveLength(1)
  })

  it("the handle opens and closes the sheet; open, the footage is the reference's card and the sheet has the rest", async () => {
    const user = userEvent.setup()
    const onMutedChange = vi.fn()
    renderPage(exchange(), { muted: false, onMutedChange })
    await waitFor(() => expect(sheet().dataset.state).toBe("peek"))
    await user.click(handle())
    expect(sheet().dataset.state).toBe("open")
    expect(handle().getAttribute("aria-expanded")).toBe("true")
    // Up, the card is the 3:4 window at its ceiling width, and the sheet has what it leaves
    // of the 768px: 768 − 40 (top row) − 16 (margins) − 373 (the card).
    expect(sheet().style.height).toBe("339px")
    const card = screen.getByTestId("footage-card")
    expect([card.style.width, card.style.height]).toEqual(["280px", "373px"])
    // The sound control sits beside the card, since the card shows the frame's middle.
    const sound = screen.getByTestId("card-sound")
    expect(sound.getAttribute("aria-label")).toBe("Mute")
    await user.click(sound)
    expect(onMutedChange).toHaveBeenCalledWith(true)
    // The card crops the player's own controls out of sight, so they are not
    // there to take focus: the one sound control is the card's, and there is
    // no expand, seek or time.
    expect(screen.getAllByRole("button", { name: /^(Mute|Unmute)$/ })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Expand" })).toBeNull()
    expect(screen.queryByTestId("moment-time")).toBeNull()
    await user.click(handle())
    expect(sheet().dataset.state).toBe("peek")
  })

  it("a pull on the head goes where it was pulling: up opens, down closes", async () => {
    renderPage(exchange())
    await waitFor(() => expect(sheet().dataset.state).toBe("peek"))
    const head = screen.getByTestId("sheet-head")
    fireEvent.pointerDown(head, { clientY: 700, pointerId: 1, button: 0 })
    fireEvent.pointerMove(head, { clientY: 600, pointerId: 1 })
    // On its way up the thread already shows, and the sheet follows the finger.
    expect(sheet().dataset.state).toBe("open")
    expect(sheet().style.height).toBe("218px")
    fireEvent.pointerUp(head, { clientY: 600, pointerId: 1 })
    expect(sheet().dataset.state).toBe("open")
    expect(sheet().style.height).toBe("339px")

    fireEvent.pointerDown(head, { clientY: 300, pointerId: 1, button: 0 })
    fireEvent.pointerMove(head, { clientY: 400, pointerId: 1 })
    fireEvent.pointerUp(head, { clientY: 400, pointerId: 1 })
    expect(sheet().dataset.state).toBe("peek")
  })

  it("a pull that starts on the handle is not undone by the click a browser may fire after it", async () => {
    renderPage(exchange())
    await waitFor(() => expect(sheet().dataset.state).toBe("peek"))
    const grip = handle()
    fireEvent.pointerDown(grip, { clientY: 700, pointerId: 1, button: 0 })
    fireEvent.pointerMove(grip, { clientY: 600, pointerId: 1 })
    fireEvent.pointerUp(grip, { clientY: 600, pointerId: 1 })
    fireEvent.click(grip)
    expect(sheet().dataset.state).toBe("open")
    // The next press is its own: a plain click still toggles.
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.click(grip)
    expect(sheet().dataset.state).toBe("peek")
  })

  it("the sheet never runs past the room below the top row, so the box is never clipped away", async () => {
    // A screen so short that even the peek would not fit: the sheet stops
    // at the room there is (jsdom's frame is the window's own height).
    const tall = window.innerHeight
    window.innerHeight = 120
    try {
      renderPage(exchange())
      await waitFor(() => expect(sheet().dataset.state).toBe("peek"))
      await waitFor(() => expect(sheet().style.height).toBe("80px"))
    } finally {
      window.innerHeight = tall
    }
  })

  it("a tap on the question beside the handle opens the sheet too", async () => {
    renderPage(exchange())
    await waitFor(() => expect(sheet().dataset.state).toBe("peek"))
    const question = screen.getByTestId("conversation-question")
    fireEvent.pointerDown(question, { clientY: 700, pointerId: 1, button: 0 })
    fireEvent.pointerUp(question, { clientY: 702, pointerId: 1 })
    expect(sheet().dataset.state).toBe("open")
  })

  it("a reply raises the sheet, so it is seen rather than put away", async () => {
    const user = userEvent.setup()
    renderPage(exchange(), { onReclip: vi.fn().mockResolvedValue(true) })
    await waitFor(() => expect(sheet().dataset.state).toBe("peek"))
    await user.type(box(), "re-cut this one{Enter}")
    await waitFor(() => expect(screen.getAllByTestId("conversation-model").length).toBeGreaterThan(0))
    expect(sheet().dataset.state).toBe("open")
  })
})

describe("Rating an answer", () => {
  const chosen = () => screen.queryByTestId("answer-rating")?.querySelector('button[aria-pressed="true"]')?.getAttribute("aria-label") ?? null

  it("offers the thumbs once an answer has arrived, and nothing while the search runs, on a failed search, or with nowhere to send", () => {
    renderPage(exchange(), { onRateAnswer: acceptingRate() })
    expect(screen.getByTestId("answer-rating")).toBeTruthy()
    cleanup()
    renderPage(exchange({ status: "searching" }), { onRateAnswer: acceptingRate(), searching: true })
    expect(screen.queryByTestId("answer-rating")).toBeNull()
    cleanup()
    renderPage(exchange({ status: "failed", matches: [match()] }), { onRateAnswer: acceptingRate() })
    expect(screen.queryByTestId("answer-rating")).toBeNull()
    cleanup()
    renderPage(exchange())
    expect(screen.queryByTestId("answer-rating")).toBeNull()
  })

  it("sends the press, naming the answer it is about, and counts a second press of the same thumb as nothing", async () => {
    const onRate = acceptingRate()
    renderPage(exchange(), { onRateAnswer: onRate })
    await userEvent.click(screen.getByRole("button", { name: "Good answer" }))
    await waitFor(() => expect(chosen()).toBe("Good answer — sent"))
    expect(onRate).toHaveBeenCalledWith("req-1", "answer_helpful")
    await userEvent.click(screen.getByRole("button", { name: "Good answer — sent" }))
    expect(onRate).toHaveBeenCalledTimes(1)
  })

  it("sends the other thumb when someone changes their mind, and does not claim the first was undone", async () => {
    const onRate = acceptingRate()
    renderPage(exchange(), { onRateAnswer: onRate })
    await userEvent.click(screen.getByRole("button", { name: "Good answer" }))
    await waitFor(() => expect(chosen()).toBe("Good answer — sent"))
    await userEvent.click(screen.getByRole("button", { name: "Not what I was after" }))
    await waitFor(() => expect(chosen()).toBe("Not what I was after — sent"))
    expect(onRate).toHaveBeenCalledTimes(2)
  })

  it("draws no rating the server did not take", async () => {
    renderPage(exchange(), { onRateAnswer: refusingRate() })
    await userEvent.click(screen.getByRole("button", { name: "Good answer" }))
    await waitFor(() => expect(chosen()).toBeNull())
    expect(screen.getByRole("button", { name: "Good answer" })).toBeTruthy()
  })
})
