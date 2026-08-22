import { defineTheme } from "@astryxdesign/core/theme"
import { neutralTheme } from "@astryxdesign/theme-neutral"

/**
 * CLIPIT's voice on Astryx's component system.
 *
 * The product is a dark, cinematic surface (see globals.css) — footage is lit
 * imagery on a near-black ground, and the app is forced to dark mode at the
 * provider. Light values are still defined so nothing breaks if a region ever
 * opts into light.
 *
 * Amber is the one accent: it is already the colour of timecodes everywhere
 * in the product, so the accent reads as "a moment in time" rather than
 * decoration. The serif (Instrument Serif) is deliberately NOT a theme token:
 * it is the wordmark's voice only — interface text is Geist.
 */
export const clipitTheme = defineTheme({
  name: "clipit",
  extends: neutralTheme,
  color: {
    // [light, dark] seeds; the pipeline derives on-accent, muted, etc.
    accent: ["#b45309", "#fcd34d"],
    neutralStyle: "cool",
  },
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
    // Interface type is Geist, loaded by next/font in the root layout.
    "--font-family-body": "var(--font-geist-sans), system-ui, sans-serif",
    "--font-family-heading": "var(--font-geist-sans), system-ui, sans-serif",
    "--font-family-code": "var(--font-geist-mono), ui-monospace, monospace",
  },
  components: {
    // Every action in CLIPIT is a pill; keep that identity on Astryx buttons.
    button: {
      base: { borderRadius: "9999px" },
    },
    // The one place serif is allowed: the wordmark. The rail's heading IS
    // the wordmark, so it carries the brand voice; every other heading is
    // Geist via the heading font token above.
    "side-nav-heading": {
      base: { fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" },
    },
  },
})
