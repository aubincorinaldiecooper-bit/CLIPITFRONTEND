import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { FollowUpComposer, SearchHome } from "../components/moments/search-home"
import type { Video } from "../lib/types"
import type { UploadEntry } from "../components/flow/upload-package"

/**
 * Search home is the composer alone (the owner's prototype, 2026-09-14),
 * and the RULE the box keeps did not change with its look: you can type
 * before the video has landed, and only the send waits — for the bytes,
 * then for the server to say it takes questions. The files on their way
 * stay in sight inside the card, with their failures and the ways out.
 */
const video = (readyForSearch: boolean) => ({ id: "video-1", status: readyForSearch ? "ready" : "processing", readyForSearch }) as unknown as Video

const uploading = (): UploadEntry => ({
  id: "upload-1",
  file: new File(["x"], "film.mp4", { type: "video/mp4" }),
  phase: "uploading",
  progress: 0.3,
})

function renderHome(props: {
  video: Video | null
  entries?: UploadEntry[]
  promptValue?: string
  onSubmit?: () => void
  onPromptChange?: (v: string) => void
  onAdd?: (files: File[]) => void
}) {
  return render(
    <SearchHome
      entries={props.entries ?? []}
      video={props.video}
      promptValue={props.promptValue ?? ""}
      onPromptChange={props.onPromptChange ?? vi.fn()}
      onAdd={props.onAdd ?? vi.fn()}
      onRemove={vi.fn()}
      onRetry={vi.fn()}
      onSubmit={props.onSubmit ?? vi.fn()}
    />,
  )
}

/** Home with its box wired the way the page wires it: what is typed stays. */
function Typed({ video, onPromptChange }: { video: Video | null; onPromptChange: (v: string) => void }) {
  const [value, setValue] = useState("")
  return (
    <SearchHome
      entries={[]}
      video={video}
      promptValue={value}
      onPromptChange={(next) => {
        setValue(next)
        onPromptChange(next)
      }}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      onRetry={vi.fn()}
      onSubmit={vi.fn()}
    />
  )
}

afterEach(cleanup)

const box = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Search your footage" })
const search = () => screen.getByRole<HTMLButtonElement>("button", { name: "Search" })

describe("the box while a video is still being prepared", () => {
  it("lets people type, and keeps Search off", async () => {
    const onPromptChange = vi.fn()
    renderHome({ video: video(false), onPromptChange })
    expect(box().disabled).toBe(false)
    await userEvent.type(box(), "f")
    expect(onPromptChange).toHaveBeenCalledWith("f")
    expect(search().disabled).toBe(true)
    expect(screen.getByText(/still being prepared/)).toBeTruthy()
  })

  it("does not send on Enter either", async () => {
    const onSubmit = vi.fn()
    renderHome({ video: video(false), promptValue: "find the goal", onSubmit })
    await userEvent.type(box(), "{Enter}")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("sends once the video is ready, on Enter and on the button", async () => {
    const onSubmit = vi.fn()
    renderHome({ video: video(true), promptValue: "find the goal", onSubmit })
    expect(search().disabled).toBe(false)
    await userEvent.type(box(), "{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await userEvent.click(search())
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it("keeps Shift+Enter as a new line", async () => {
    const onSubmit = vi.fn()
    renderHome({ video: video(true), promptValue: "find the goal", onSubmit })
    await userEvent.type(box(), "{Shift>}{Enter}{/Shift}")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("accepts a question before a video is picked, while keeping Search off and promising nothing", async () => {
    const onPromptChange = vi.fn()
    render(<Typed video={null} onPromptChange={onPromptChange} />)
    expect(box().placeholder).toBe("Ask for a moment…")
    await userEvent.type(box(), "find the introduction")
    expect(onPromptChange).toHaveBeenLastCalledWith("find the introduction")
    expect(search().disabled).toBe(true)
    expect(screen.queryByText(/still uploading/)).toBeNull()
  })

  it("opens the moment a file is picked, before its bytes have landed, and says what it is waiting on", () => {
    renderHome({ video: null, entries: [uploading()] })
    expect(box().disabled).toBe(false)
    expect(search().disabled).toBe(true)
    // The file is on screen as itself while it goes up.
    expect(screen.getByRole("button", { name: /^film\.mp4 — uploading/ })).toBeTruthy()
    expect(screen.getByText(/still uploading/)).toBeTruthy()
  })

  it("sends as soon as the server says it takes questions, even while the video is still being prepared", async () => {
    const onSubmit = vi.fn()
    const landed = { id: "video-1", status: "preprocessing", readyForSearch: false, acceptsQuestions: true } as unknown as Video
    renderHome({ video: landed, promptValue: "find the goal", onSubmit })
    expect(search().disabled).toBe(false)
    expect(screen.queryByText(/still being prepared/)).toBeNull()
    await userEvent.type(box(), "{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("keeps Search off while the server says the bytes have not landed", () => {
    const stillUploading = { id: "video-1", status: "pending_upload", readyForSearch: false, acceptsQuestions: false } as unknown as Video
    renderHome({ video: stillUploading, promptValue: "find the goal" })
    expect(search().disabled).toBe(true)
  })

  it("still accepts a question when the only pick failed, without promising it can send", () => {
    renderHome({ video: null, entries: [{ ...uploading(), phase: "failed", error: "Too large" }] })
    expect(box().disabled).toBe(false)
    expect(search().disabled).toBe(true)
    expect(screen.queryByText(/still being prepared|still uploading/)).toBeNull()
  })

  it("still accepts a question after preparation failed, without promising it can send", () => {
    const failed = { id: "video-1", status: "failed", readyForSearch: false } as unknown as Video
    renderHome({ video: failed })
    expect(box().disabled).toBe(false)
    expect(search().disabled).toBe(true)
    expect(screen.queryByText(/still being prepared/)).toBeNull()
  })

})

describe("home is the box alone, and the box still takes video", () => {
  it("has no drop container on it, only the attach control", () => {
    renderHome({ video: null })
    expect(screen.queryByText(/drag/i)).toBeNull()
    expect(screen.queryByText(/drop/i)).toBeNull()
    expect(screen.getByRole("button", { name: "Attach video" })).toBeTruthy()
  })

  it("hands a picked video to the same uploader the container used", async () => {
    const onAdd = vi.fn()
    renderHome({ video: null, onAdd })
    const file = new File(["x"], "harbour.mp4", { type: "video/mp4" })
    const picker = document.querySelector<HTMLInputElement>('input[type="file"]')!
    expect(picker.accept).toContain("video/")
    await userEvent.upload(picker, file)
    expect(onAdd).toHaveBeenCalledWith([file])
  })

  it("takes a video dropped onto the card", () => {
    const onAdd = vi.fn()
    renderHome({ video: null, onAdd })
    const file = new File(["x"], "harbour.mp4", { type: "video/mp4" })
    const card = screen.getByTestId("search-home").querySelector('[data-slot="ask-composer"]')!.parentElement!
    fireEvent.dragOver(card, { dataTransfer: { types: ["Files"], files: [file] } })
    expect(box().placeholder).toBe("Drop the video to attach it…")
    fireEvent.drop(card, { dataTransfer: { types: ["Files"], files: [file] } })
    expect(onAdd).toHaveBeenCalledWith([file])
    expect(box().placeholder).toBe("Ask for a moment…")
  })

  it("shows the file itself while it goes up, not a line of text about it", () => {
    renderHome({ video: null, entries: [uploading()] })
    const thumb = screen.getByRole("button", { name: /^film\.mp4 — uploading/ })
    expect(thumb.querySelector("video")).toBeTruthy()
    // The percentage is not drawn — a spinner is — but it stays in the
    // label, the one thing a spinning circle cannot tell a screen reader.
    expect(thumb.getAttribute("aria-label")).toBe("film.mp4 — uploading, 30%")
  })

  it("says why an upload failed, and offers the same two ways out", async () => {
    const onRetry = vi.fn()
    const onRemove = vi.fn()
    render(
      <SearchHome
        entries={[{ ...uploading(), phase: "failed", error: "Too large" }]}
        video={null}
        promptValue=""
        onPromptChange={vi.fn()}
        onAdd={vi.fn()}
        onRemove={onRemove}
        onRetry={onRetry}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: "film.mp4 — Too large" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledWith("upload-1")
    await userEvent.click(screen.getByRole("button", { name: "Remove film.mp4" }))
    expect(onRemove).toHaveBeenCalledWith("upload-1")
  })

  it("shows a video that arrived without the tray — opened from the library, or come back to — and offers to take it off", async () => {
    // Back from the results lands here with the video still attached; a
    // video opened from the library never had a row in the tray at all.
    // Either way the box must show what the question is about.
    const onDetach = vi.fn()
    const opened = {
      id: "video-1", sourceType: "upload", sourceUrl: null, title: "harbour.mp4", originalFilename: "harbour.mp4", status: "ready",
      readyForSearch: true, acceptsQuestions: true, playback: { url: "https://cdn.test/source.mp4", expiresAt: "", proxyUrl: "https://cdn.test/proxy.mp4" },
    } as unknown as Video
    render(
      <SearchHome entries={[]} video={opened} promptValue="" onPromptChange={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} onRetry={vi.fn()} onSubmit={vi.fn()} onDetach={onDetach} />,
    )
    const thumb = screen.getByRole("button", { name: "harbour.mp4 — attached" })
    expect(thumb.querySelector("video")?.getAttribute("src")).toBe("https://cdn.test/proxy.mp4")
    expect(screen.getByRole("button", { name: "Attach another" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Remove harbour.mp4" }))
    expect(onDetach).toHaveBeenCalledTimes(1)
    cleanup()
    // A video whose upload is in the tray is shown by its row, once.
    render(
      <SearchHome entries={[{ ...uploading(), phase: "ready", videoId: "video-1" }]} video={opened} promptValue="" onPromptChange={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} onRetry={vi.fn()} onSubmit={vi.fn()} onDetach={onDetach} />,
    )
    expect(screen.queryByTestId("attached-video")).toBeNull()
    expect(screen.getByRole("button", { name: "film.mp4 — uploaded" })).toBeTruthy()
  })

  it("an example fills the box rather than searching: there is nothing to search yet", async () => {
    const onPromptChange = vi.fn()
    const onSubmit = vi.fn()
    renderHome({ video: null, onPromptChange, onSubmit })
    await userEvent.click(screen.getByRole("button", { name: "Where the car pulls out of the driveway" }))
    expect(onPromptChange).toHaveBeenCalledWith("Where the car pulls out of the driveway")
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("the box under the results", () => {
  it("takes the next question of the same video, and none while a search is running", async () => {
    const onSubmit = vi.fn()
    const { rerender } = render(<FollowUpComposer video={video(true)} promptValue="find the goal" onPromptChange={vi.fn()} onSubmit={onSubmit} searching={false} />)
    await userEvent.type(screen.getByRole("textbox", { name: "Ask for another moment" }), "{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    rerender(<FollowUpComposer video={video(true)} promptValue="find the goal" onPromptChange={vi.fn()} onSubmit={onSubmit} searching />)
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Ask for another moment" }).placeholder).toBe("Still looking…")
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Search" }).disabled).toBe(true)
  })
})
