/**
 * What jsdom does not have, and Astryx expects.
 *
 * Several components observe media queries — ChatLayout asks about density
 * and reduced motion before it renders a single message — and jsdom ships no
 * `matchMedia` at all, so the component throws rather than degrading. The
 * moment feed's test carried its own copy of this stub; that was fine until a
 * second file needed it, and twelve chat tests failed at once on a missing
 * browser API rather than on anything about the chat.
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
