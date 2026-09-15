import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { InternetResults } from "../components/moments/internet-results"
import { askGate, askTarget } from "../components/start/ask-gate"
import type { InternetCandidate } from "../lib/types"

afterEach(cleanup)

const candidate = (overrides: Partial<InternetCandidate> = {}): InternetCandidate => ({
  id: "c1",
  query: "a man walking a dog",
  title: "Dog walk in the park",
  pageUrl: "https://publisher.example/watch/1",
  thumbnailUrl: null,
  source: "example-video",
  ...overrides,
})

describe("asking the internet instead of a video", () => {
  it("is what the box does when nothing is attached", () => {
    expect(askTarget(null)).toBe("internet")
    expect(askGate(null).accepting).toBe(true)
  })

  it("lists what was found, as pages to open", () => {
    render(
      <InternetResults
        query="a man walking a dog"
        candidates={[candidate(), candidate({ id: "c2", title: "Another walk", pageUrl: "https://other.example/v/2", source: null })]}
      />,
    )

    expect(screen.getByText("2 pages found for “a man walking a dog”.")).toBeTruthy()
    const links = screen.getAllByTestId("internet-candidate")
    expect(links).toHaveLength(2)
    expect(links[0]!.getAttribute("href")).toBe("https://publisher.example/watch/1")
    // Opening someone else's page must not hand them this tab.
    expect(links[0]!.getAttribute("rel")).toContain("noopener")
    expect(screen.getByText(/example-video · publisher\.example/)).toBeTruthy()
    expect(screen.getByText("other.example")).toBeTruthy()
  })

  it("says one page, not one pages", () => {
    render(<InternetResults query="q" candidates={[candidate()]} />)
    expect(screen.getByText("1 page found for “q”.")).toBeTruthy()
  })

  it("states an empty answer as an empty answer", () => {
    // The provider looked and came back with nothing. That is a different
    // thing from the search having failed, which never reaches this screen.
    render(<InternetResults query="nothing at all" candidates={[]} />)
    expect(screen.getByText("Nothing came back for “nothing at all”.")).toBeTruthy()
    expect(screen.queryAllByTestId("internet-candidate")).toHaveLength(0)
  })

  it("falls back to the page URL when a result has no readable host", () => {
    render(<InternetResults query="q" candidates={[candidate({ pageUrl: "not a url" })]} />)
    expect(screen.getByText("example-video · not a url")).toBeTruthy()
  })
})
