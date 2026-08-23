import { defineTheme } from "@astryxdesign/core/theme"
import { neutralTheme } from "@astryxdesign/theme-neutral"

/**
 * CLIPIT's voice on Astryx's component system — colour and shape from
 * Astryx's GOTHIC theme, type and brand from CLIPIT.
 *
 * The first version of this file hand-picked a dozen tokens and pinned
 * others against the side effects (an amber accent seed tinting the neutral
 * ramp warm — the rail came out brown, quiet text came out beige). Gothic is
 * the maintained answer to the look CLIPIT was reaching for: deep blue-gray
 * dark surfaces, dusty status pastels tuned for dark, restrained shadows, a
 * quiet categorical palette, and slower theatrical motion. Its tokens are
 * adopted here as a set.
 *
 * What stays CLIPIT's, by the owner's standing decisions:
 * - Geist for every word of interface text; the serif (Instrument Serif) is
 *   the wordmark's voice ONLY. Gothic's blackletter display face is
 *   deliberately not brought over — it would put a second voice everywhere.
 * - The primary action is the white pill it has always been.
 * - Amber remains the colour of timecodes (set where timecodes render), not
 *   a theme accent: as an accent seed it fought the cool palette everywhere.
 *
 * Light values are single dark values throughout, like gothic itself: the
 * product is a dark, cinematic surface, forced dark at the provider.
 */
export const clipitTheme = defineTheme({
  name: "clipit",
  extends: neutralTheme,
  color: {
    // Gothic's parchment-on-ink accent: light accent on dark ground, which
    // is exactly the white-pill button CLIPIT already had.
    accent: ["#101314", "#E8F1F6"],
    neutralStyle: "cool",
  },
  // Gothic's pacing: slower, theatrical. Reduced motion is honoured globally.
  motion: { fast: 150, medium: 350, slow: 800, ratio: 0.75 },
  tokens: {
    // === Surfaces — gothic's ink and blue-gray ladder =====================
    "--color-background-body": ["#ffffff", "#101314"],
    "--color-background-surface": ["#ffffff", "#101314"],
    "--color-background-card": ["#fafafa", "#1a1d20"],
    "--color-background-popover": ["#ffffff", "#24292D"],
    "--color-background-muted": ["#f4f4f5", "#24292D"],
    "--color-background-inverted": ["#101314", "#E8F1F6"],
    "--color-overlay": ["#10131466", "#101314CC"],
    "--color-overlay-hover": ["#1013140D", "#E8F1F60D"],
    "--color-overlay-pressed": ["#1013141A", "#E8F1F61A"],

    // === Text — parchment over ink ========================================
    "--color-text-primary": ["#101314", "#E8F1F6"],
    "--color-text-secondary": ["#495056", "#96A0AB"],
    "--color-text-disabled": ["#96A0AB", "#495056"],
    "--color-icon-primary": ["#101314", "#E8F1F6"],
    "--color-icon-secondary": ["#495056", "#96A0AB"],
    "--color-icon-disabled": ["#96A0AB", "#495056"],

    // === Borders and effects ==============================================
    "--color-border": ["#1013141a", "#E8F1F61A"],
    "--color-border-emphasized": ["#96A0AB", "#495056"],
    "--color-skeleton": ["#e4e4e7", "#495056"],
    "--color-shadow": ["#0000002e", "#0000004D"],
    "--shadow-low": "0 2px 4px #00000033, 0 4px 8px #00000040",
    "--shadow-med": "0 2px 4px #00000033, 0 4px 12px #00000040",
    "--shadow-high": "0 4px 6px #00000040, 0 12px 24px #0000004D",

    // === Status — gothic's dusty pastels, tuned for dark ==================
    "--color-success": ["#3a5e2c", "#b3c79a"],
    "--color-error": ["#5e3a35", "#c6a6a2"],
    "--color-warning": ["#876515", "#d3c490"],

    // === Radius — gothic's subtle rounding ================================
    "--radius-inner": "0.25rem",
    "--radius-element": "0.5rem",
    "--radius-container": "0.75rem",
    "--radius-page": "1.5rem",

    // === Type — CLIPIT's, not gothic's ====================================
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
    // pill it has always been — now literally gothic's parchment on ink.
    button: {
      base: { borderRadius: "9999px" },
      "variant:primary": {
        backgroundColor: "light-dark(#101314, #E8F1F6)",
        color: "light-dark(#E8F1F6, #101314)",
      },
    },
    // The one place serif is allowed: the wordmark. The rail's heading IS
    // the wordmark, so it carries the brand voice; every other heading is
    // Geist via the heading font token above.
    "side-nav-heading": {
      base: { fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" },
    },
  },
})
