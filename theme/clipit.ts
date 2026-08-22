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
  },
})
