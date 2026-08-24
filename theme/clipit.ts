import { defineTheme } from "@astryxdesign/core/theme"
import { neutralTheme } from "@astryxdesign/theme-neutral"

/**
 * CLIPIT's voice on Astryx's component system — CLIPIT's colour, gothic's
 * structure.
 *
 * The colours are ours and unchanged: the near-black cinematic ground, zinc
 * structural surfaces, amber as the one accent (it is the colour of
 * timecodes, so it reads as "a moment in time" rather than decoration).
 * The serif (Instrument Serif) is the wordmark's voice only.
 *
 * What is borrowed from Astryx's maintained GOTHIC theme is exactly its
 * STRUCTURE — the parts of a theme that carry polish without touching
 * identity:
 * - the radius ladder (subtle rounding, tuned steps),
 * - the shadow set (restrained, atmospheric),
 * - the motion pacing (slower, theatrical; reduced motion stays honoured).
 * Its colours were tried and rolled back by the owner's call: structure we
 * change, everything else we keep.
 */
export const clipitTheme = defineTheme({
  name: "clipit",
  extends: neutralTheme,
  color: {
    // [light, dark] seeds; the pipeline derives on-accent, muted, etc.
    accent: ["#b45309", "#fcd34d"],
    neutralStyle: "cool",
  },
  // Gothic's pacing: slower, theatrical. Reduced motion is honoured globally.
  motion: { fast: 150, medium: 350, slow: 800, ratio: 0.75 },
  tokens: {
    "--color-background-body": ["#ffffff", "#08080a"],
    // The amber accent seed tints the generated neutral ramp warm — the
    // rail came out brown against our cool near-black content. Structural
    // surfaces stay in the zinc family; amber is for accents, not walls.
    "--color-background-surface": ["#ffffff", "#131316"],
    "--color-background-card": ["#fafafa", "#131316"],
    "--color-background-popover": ["#ffffff", "#232327"],
    "--color-background-inverted": ["#18181b", "#f4f4f5"],
    "--color-border": ["#1113171a", "#f4f4f51a"],
    "--color-border-emphasized": ["#8b8b93", "#5d5d66"],
    "--color-text-primary": ["#111113", "#f4f4f5"],
    // Like the backgrounds: the amber seed tints the generated grays warm,
    // and secondary text came out beige on our cool near-black. Pinned to
    // the zinc family so quiet text is gray, not tan.
    "--color-text-secondary": ["#52525b", "#a1a1aa"],

    // === Structure, from gothic ==========================================
    "--radius-inner": "0.25rem",
    "--radius-element": "0.5rem",
    "--radius-container": "0.75rem",
    "--radius-page": "1.5rem",
    "--shadow-low": "0 2px 4px #00000033, 0 4px 8px #00000040",
    "--shadow-med": "0 2px 4px #00000033, 0 4px 12px #00000040",
    "--shadow-high": "0 4px 6px #00000040, 0 12px 24px #0000004D",

    // Interface type is Geist, loaded by next/font in the root layout.
    "--font-family-body": "var(--font-geist-sans), system-ui, sans-serif",
    "--font-family-heading": "var(--font-geist-sans), system-ui, sans-serif",
    "--font-family-code": "var(--font-geist-mono), ui-monospace, monospace",
    // The landing hero's voice: display-1 is the marquee size, set heavy and
    // tight the way the reference's headline is. It appears nowhere in the
    // app's chrome, so the app's heading scale is untouched.
    "--text-display-1-size": "clamp(2.6rem, 5vw, 4.25rem)",
    "--text-display-1-weight": "var(--font-weight-semibold)",
    "--text-display-1-leading": "1.02",
  },
  components: {
    // Every action in CLIPIT is a pill, and the primary action is the white
    // pill it has always been — amber stays the accent of timecodes and
    // highlights, not the colour of buttons.
    button: {
      base: { borderRadius: "9999px" },
      "variant:primary": {
        backgroundColor: "light-dark(#111113, #ffffff)",
        color: "light-dark(#ffffff, #0b0b0c)",
      },
    },
    // The one place serif is allowed: the wordmark. The rail's heading IS
    // the wordmark, so it carries the brand voice; every other heading is
    // Geist via the heading font token above. Sized to anchor the roomier
    // rail below it.
    "side-nav-heading": {
      base: {
        fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif",
        fontSize: "1.5rem",
        paddingBlock: "0.5rem",
      },
    },
    // The rail rows, at the proportions of the reference (Instagram's rail):
    // 24px icons, ~48px rows, a real gap between icon and label, and a label
    // you don't have to squint at. Structure and behaviour stay Astryx's —
    // only the scale changes. The icon half lives in components/side-nav.tsx
    // (the glyphs are drawn at 24px); the two move together.
    "side-nav-item": {
      base: {
        fontSize: "0.9375rem",
        // Taller rows and a wider gutter: the reference's rail breathes,
        // and its icons sit on one axis well clear of the labels.
        minHeight: "3.25rem",
        gap: "1rem",
        paddingInline: "0.875rem",
        borderRadius: "0.75rem",
      },
      "size:sm": {
        fontSize: "0.84375rem",
        minHeight: "2.375rem",
        gap: "0.75rem",
      },
    },
  },
})
