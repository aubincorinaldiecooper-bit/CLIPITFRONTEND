import type { ReactNode } from "react"
import { Card } from "@astryxdesign/core/Card"
import { Heading } from "@astryxdesign/core/Heading"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"

/**
 * The two shapes the owner's dashboard designs are built from.
 *
 * Every one of those screens is the same pair repeated: an icon sitting in a
 * rounded well, and a card whose header is that well plus a title, plus an
 * action pinned to the right. Writing them once is what keeps the corner
 * radius, the well size and the gap between mark and title identical on the
 * Home, Workspaces and Publishing screens — three pages that a person moves
 * between in seconds and would notice disagreeing.
 */

/** How big the well is. `sm` is a row's mark; `md` heads a card or a column. */
export type WellSize = "sm" | "md"

const WELL: Record<WellSize, string> = {
  // Explicit pixels, not `rounded-xl`. Tailwind's radius scale is mapped onto
  // the theme's radius tokens here, and `xl` lands on 24px — which on a 44px
  // square is a circle, not the rounded square the designs draw. Worth knowing
  // before reaching for a radius utility anywhere else in this app.
  sm: "h-11 w-11 rounded-[12px]",
  md: "h-12 w-12 rounded-[12px]",
}

/**
 * An icon on its own ground.
 *
 * Decorative: in every use the mark sits beside a label that already names it,
 * so it is hidden from screen readers rather than repeating the label aloud.
 */
export function IconWell({
  icon: Glyph,
  size = "md",
}: {
  icon: (props: { className?: string }) => ReactNode
  size?: WellSize
}) {
  return (
    <span
      aria-hidden
      className={`${WELL[size]} flex shrink-0 items-center justify-center bg-surface text-primary ring-1 ring-border`}
    >
      <Glyph className={size === "sm" ? "h-[18px] w-[18px]" : "h-5 w-5"} />
    </span>
  )
}

/**
 * A titled panel: mark, title, optional supporting line, optional action.
 *
 * `action` is pinned to the header's right edge and stays on the first line
 * even when the supporting text wraps — in the designs the button is level
 * with the title, not with the paragraph under it.
 */
export function SectionCard({
  icon,
  title,
  description,
  descriptionPlacement = "beside",
  action,
  children,
}: {
  icon: (props: { className?: string }) => ReactNode
  title: string
  description?: string
  /**
   * Where the supporting line sits.
   *
   * `beside` tucks it under the title, indented to the title's left edge —
   * the shape the Publishing design uses, where the sentence belongs to the
   * heading. `below` runs it full width under the whole header row, which is
   * what the Home design does, where the sentence is about the section rather
   * than a caption on its title.
   */
  descriptionPlacement?: "beside" | "below"
  action?: ReactNode
  children?: ReactNode
}) {
  const supporting = description && (
    <Text as="p" type="body" color="secondary" display="block">
      {description}
    </Text>
  )

  return (
    <Card variant="muted" padding={5}>
      <VStack gap={4} align="stretch">
        <VStack gap={2} align="stretch">
          <HStack justify="between" align="start" gap={4} wrap="wrap">
            <HStack gap={3} align={descriptionPlacement === "beside" ? "start" : "center"}>
              <IconWell icon={icon} />
              <VStack gap={0.5}>
                <Heading level={3} accessibilityLevel={2}>
                  {title}
                </Heading>
                {descriptionPlacement === "beside" && supporting}
              </VStack>
            </HStack>
            {action}
          </HStack>
          {descriptionPlacement === "below" && supporting}
        </VStack>
        {children}
      </VStack>
    </Card>
  )
}
