import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

/**
 * The search screens' header, after the owner's phone round (2026-09-14):
 * the mark, New search and the account — and the library and the shared
 * rooms in the account menu rather than as links in the header. On a phone
 * New search is not drawn at all: the box is already on the screen.
 */
const accountLinks = vi.fn()
vi.mock("@/components/workspace/profile-dropdown", () => ({
  ProfileDropdown: ({ links }: { links?: Array<{ label: string; href: string }> }) => {
    accountLinks(links)
    return <div data-testid="account" />
  },
}))
vi.mock("@/components/workspace/sign-in-gate", () => ({
  WorkspaceSignInGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }))

import { SearchShell } from "../components/moments/search-shell"

afterEach(cleanup)

describe("SearchShell", () => {
  it("carries no Library or Shared links in the header; the account menu has them", () => {
    render(<SearchShell>here</SearchShell>)
    expect(screen.queryByRole("link", { name: "Library" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Shared" })).toBeNull()
    expect(accountLinks).toHaveBeenCalledWith([
      expect.objectContaining({ label: "Library", href: "/clips" }),
      expect.objectContaining({ label: "Shared", href: "/shared" }),
    ])
  })

  it("draws New search for a wide screen only — on a phone the box is already there", () => {
    render(<SearchShell>here</SearchShell>)
    const fresh = screen.getByRole("link", { name: "New search" })
    expect(fresh.getAttribute("href")).toBe("/start")
    expect(fresh.className).toContain("max-[860px]:hidden")
  })

  it("the mark alone on a phone, the lockup on a wide screen, both the way to a new search", () => {
    render(<SearchShell>here</SearchShell>)
    const home = screen.getByRole("link", { name: "Clipit — new search" })
    expect(home.getAttribute("href")).toBe("/start")
    const [lockup, mark] = Array.from(home.children) as HTMLElement[]
    expect(lockup!.className).toContain("max-[860px]:hidden")
    expect(mark!.className).toContain("max-[860px]:inline-flex")
    expect(mark!.textContent).not.toContain("clipit")
  })
})
