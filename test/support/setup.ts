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

/*
 * And no IntersectionObserver. Embla asks for one the moment it initialises,
 * to track which slides are in view, so without this every internet-stage
 * test fails on a missing browser API rather than on anything about the
 * stage — which is exactly what happened when the results deck moved onto
 * the carousel.
 *
 * It observes nothing and never fires, so "in view" stays empty here. That
 * costs these tests nothing: they count what is in the page, and every slide
 * is in the page whether or not it is on screen. It does mean the suite
 * cannot tell you the carousel really scrolls — that has to be driven in a
 * real browser, and was.
 */
if (typeof window !== "undefined" && typeof (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver !== "function") {
  class BlindObserver {
    readonly root = null
    readonly rootMargin = ""
    readonly thresholds: number[] = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  Object.defineProperty(window, "IntersectionObserver", { writable: true, value: BlindObserver })
  Object.defineProperty(globalThis, "IntersectionObserver", { writable: true, value: BlindObserver })
}
