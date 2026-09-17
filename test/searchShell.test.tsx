import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

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

afterEach(() => {
  cleanup()
  accountLinks.mockClear()
})

describe("SearchShell", () => {
  it("keeps the header minimal and leaves account navigation out of the shell", () => {
    render(<SearchShell>here</SearchShell>)
    expect(screen.queryByRole("link", { name: "Library" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Shared" })).toBeNull()
    expect(accountLinks).toHaveBeenCalledWith([])
  })

  it("draws New chat on a wide screen only", () => {
    render(<SearchShell>here</SearchShell>)
    const fresh = screen.getByRole("link", { name: "New chat" })
    expect(fresh.getAttribute("href")).toBe("/start")
    expect(fresh.className).toContain("max-[860px]:hidden")
  })

  it("uses the Clipit lockup on desktop and the mark on mobile", () => {
    render(<SearchShell>here</SearchShell>)
    const home = screen.getByRole("link", { name: "Clipit — new chat" })
    expect(home.getAttribute("href")).toBe("/start")
    const [lockup, mark] = Array.from(home.children) as HTMLElement[]
    expect(lockup!.className).toContain("max-[860px]:hidden")
    expect(mark!.className).toContain("max-[860px]:inline-flex")
  })

  it("pins the account control to the far edge of the header", () => {
    render(<SearchShell>here</SearchShell>)
    const slot = screen.getByTestId("account-slot")
    expect(slot.className).toContain("ml-auto")
    expect(slot.className).toContain("justify-end")
    expect(screen.getByTestId("account")).toBeTruthy()
  })
})
