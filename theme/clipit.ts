import { defineTheme } from "@astryxdesign/core/theme"
import { neutralTheme } from "@astryxdesign/theme-neutral"

/**
 * CLIPIT's voice on Astryx's component system — CLIPIT's colour, gothic's
 * structure.
 *
 * The colours are ours and unchanged: the near-black cinematic ground, zinc
 * structural surfaces, amber as the one accent (it is the colour of
 * timecodes, so it reads as "a moment in time" rather than decoration).
 * The wordmark is Inter ExtraBold, from the owner's brand assets — the same
 * lockup the landing uses, so the product has one wordmark rather than two.
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
  /**
   * One notch up from the inherited ramp, across the board.
   *
   * Measured, not chosen by eye. The owner's mockups and the built screens
   * were normalised to the same scale — matched on the side nav, which appears
   * in both — and compared. The layouts agreed; the type did not. Body wanted
   * about 16px against the 14 here, quiet text 14 against 12, and a page title
   * 40 against 32. Everything was uniformly one size small, which is why the
   * screens read tighter and busier than the designs however the spacing
   * around them was adjusted.
   *
   * The ratio is unchanged at 1.2 — the relationships between sizes were
   * right, the anchor was not. Moving the anchor moves every step with it, so
   * this is one change for the whole app rather than a size argued at each
   * call site and left to drift.
   */
  typography: { scale: { base: 16, ratio: 1.2 } },
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

    // The open rail's width is NOT here. It lives as --rail-open-width in
    // app/globals.css (this map's TokenName type takes no custom names), and
    // components/side-nav.tsx applies it only while the rail is open — a
    // token or override here would apply in the collapsed state too, and
    // Astryx collapses by narrowing, so it froze the fold once already.

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
    // A page title should lead. At the inherited 2xl a heading sat almost
    // level with the body text under it, so nothing on a screen said "start
    // here" — the flatness the owner read as unpolished beside the platforms
    // creators use all day. The steps below open the gap between a page
    // title, a section and its prose without touching the type family.
    // These two are pinned rather than read off the scale, so raising the
    // anchor above left them behind — a 32px title against 16px body is only
    // twice the size, where the designs set it at two and a half. Moved with
    // the rest so the gap between a page title, a section and its prose stays
    // the one that was tuned here, at the size the mockups draw it.
    "--text-heading-1-size": "2.5rem",
    "--text-heading-1-leading": "1.15",
    "--text-heading-2-size": "1.5rem",
    "--text-heading-2-leading": "1.3",

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
      // The designs' full-width actions are substantially taller than the
      // system's large step — a "Continue with TikTok" that carries a logo
      // and an arrow needs the room, and it is the only thing on that panel
      // to press.
      "size:lg": { minHeight: "3.75rem", paddingInline: "1.75rem" },
      "variant:primary": {
        backgroundColor: "light-dark(#111113, #ffffff)",
        color: "light-dark(#ffffff, #0b0b0c)",
      },
    },
    // The rail's heading IS the wordmark, so it carries the brand's own type:
    // Inter ExtraBold at -2.5% tracking, matching components/brand/logo.tsx
    // and the owner's spec. It was Instrument Serif until the brand assets
    // arrived; the product had two different wordmarks for a while and now
    // has one.
    "side-nav-heading": {
      base: {
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        fontWeight: "800",
        fontSize: "1.35rem",
        letterSpacing: "-0.025em",
        paddingBlock: "0.5rem",
      },
    },
    // List rows carry most of this app's real content — connected accounts,
    // the platforms you can add, the accounts a clip will post to. The designs
    // draw them at an 84px pitch with a 19px label; Astryx's default is nearer
    // 60 and 16, which made four platforms look like a settings sub-menu
    // rather than the main business of the page.
    "list-item": {
      base: {
        paddingBlock: "1rem",
        paddingInline: "1rem",
        gap: "0.875rem",
      },
    },
    // The rail's WIDTH is deliberately not set here. A theme width applies in
    // every state — including collapsed — and Astryx folds the rail by
    // narrowing it, so pinning 333px here froze the collapse control: the
    // chevron saved its preference and nothing on screen moved. The 333px the
    // owner's designs draw lives in components/side-nav.tsx instead, applied
    // only while the rail is open — the same shape as the component's own
    // resizable mode, which also writes its width only when not collapsed.
    // The rail rows, at Instagram's proportions, by the owner's direction.
    //
    // They were 68px tall (4.25rem) to match a 76px pitch measured off the
    // owner's mockup. Against Instagram's ~56px that read loose: five rows of
    // 68 in an 860px column is a lot of air between short words, and it was
    // half of why the rail looked empty. 3.5rem is 56px.
    //
    // The label size stays at 17px. It is what the mockup draws, it still fits
    // the narrower 244px rail with room to spare, and shrinking it was not
    // part of what was asked for.
    "side-nav-item": {
      base: {
        fontSize: "1.0625rem",
        minHeight: "3.5rem",
        gap: "1.125rem",
        paddingInline: "1.125rem",
        borderRadius: "0.875rem",
      },
      "size:sm": {
        fontSize: "0.84375rem",
        minHeight: "2.375rem",
        gap: "0.75rem",
      },
    },
  },
})
