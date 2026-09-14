/**
 * The address as a place to park an errand.
 *
 * A sign-in that leaves and comes back, a reload, a link pasted somewhere:
 * anything the page needs to carry across those rides in its own search
 * parameters. Reading is trivial; the discipline is in the removal.
 */

/** One named parameter from the current address, or null. */
export function readSearchParam(name: string): string | null {
  if (typeof window === "undefined") return null
  return new URL(window.location.href).searchParams.get(name)
}

/**
 * Take named parameters out of the address, once what they asked for has
 * been done — and not before: a return that fails to load must keep them,
 * so a reload can try the whole return again (Devin's finding on #82).
 * replaceState, so Back still goes where it should.
 */
export function consumeSearchParams(names: string[]): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (!names.some((name) => url.searchParams.has(name))) return
  for (const name of names) url.searchParams.delete(name)
  window.history.replaceState(window.history.state, "", url.toString())
}

/**
 * Write named parameters into the address, as a new history entry or in
 * place of the current one. Null removes a parameter. Nothing is written
 * when nothing would change, so a re-render never adds an entry.
 *
 * `pushState` and `replaceState` are the native ones; Next's router listens
 * to both, so `useSearchParams` follows and Back walks the entries. The
 * search screens move between home, results and a moment this way — one
 * page holding one conversation, three addresses within it.
 */
export function writeSearchParams(changes: Record<string, string | null>, mode: "push" | "replace" = "replace"): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) url.searchParams.delete(name)
    else url.searchParams.set(name, value)
  }
  if (url.toString() === window.location.href) return
  if (mode === "push") window.history.pushState(window.history.state, "", url.toString())
  else window.history.replaceState(window.history.state, "", url.toString())
}
