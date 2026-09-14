/**
 * What jsdom does not have, and Astryx expects.
 *
 * Several components observe media queries — the results stage asks whether
 * the screen is narrow, the coverflow whether motion should be reduced — and
 * jsdom ships no `matchMedia` at all, so the component throws rather than
 * degrading. One stub here, for every test.
 *
 * Nothing matches: every query reports false, which is the quiet default —
 * no reduced-motion preference, no wide-viewport branch.
 */
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

/*
 * jsdom has no ResizeObserver either. The coverflow measures its frame with
 * one; without it every results-stage test would fail on a missing browser
 * API rather than on anything about the stage. Nothing is observed: the
 * ring paints once from a zero width, which is all a test can see anyway.
 */
if (typeof window !== "undefined" && typeof (window as unknown as { ResizeObserver?: unknown }).ResizeObserver !== "function") {
  class StillObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", { writable: true, value: StillObserver })
  Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: StillObserver })
}
