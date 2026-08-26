import { MARK_ASPECT, MARK_PATH } from "./mark"

/**
 * The Clipit logo: the monogram, the wordmark, or both.
 *
 * One component so the mark and the word can never drift apart — the landing
 * header, the landing footer and the app rail all draw from here.
 *
 * The wordmark's spec comes from the owner: Inter ExtraBold (800), tracking
 * -2% to -3%, cased "Clipit". It is set at -0.025em, the middle of that range.
 * Inter is already loaded by the root layout as `--font-inter`.
 */

/** How much of the logo to draw. */
export type LogoVariant = "lockup" | "mark" | "wordmark"

export function Logo({
  variant = "lockup",
  size = 24,
  className,
  title = "Clipit",
}: {
  variant?: LogoVariant
  /**
   * The MARK's height in pixels, and the wordmark's cap size follows it.
   * Height rather than width: the mark is taller than it is wide, so sizing by
   * width would make it grow unpredictably next to text.
   */
  size?: number
  className?: string
  /**
   * The accessible name. Passed as the SVG's title on a bare mark; on the
   * lockup the word itself is real text, so the mark is hidden instead of
   * announcing the name twice.
   */
  title?: string
}) {
  const showMark = variant !== "wordmark"
  const showWord = variant !== "mark"

  const mark = (
    <svg
      viewBox={`0 0 ${(MARK_ASPECT * 100).toFixed(2)} 100`}
      height={size}
      width={size * MARK_ASPECT}
      fill="currentColor"
      // On the lockup the word beside it already says "Clipit"; announcing it
      // again would read the name twice.
      role={showWord ? undefined : "img"}
      aria-label={showWord ? undefined : title}
      aria-hidden={showWord ? true : undefined}
      className="shrink-0"
    >
      <path d={MARK_PATH} />
    </svg>
  )

  if (variant === "mark") return <span className={className}>{mark}</span>

  const word = (
    <span
      style={{
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        fontWeight: 800,
        // The owner's spec is -2% to -3%; this sits in the middle.
        letterSpacing: "-0.025em",
        fontSize: size * 1.08,
        lineHeight: 1,
      }}
    >
      Clipit
    </span>
  )

  if (variant === "wordmark") return <span className={className}>{word}</span>

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.34 }}
    >
      {mark}
      {word}
    </span>
  )
}
