"use client"

import Link from "next/link"
import { MotionConfig } from "motion/react"
import { Theme } from "@astryxdesign/core/theme"
import { LinkProvider } from "@astryxdesign/core/Link"
import { clipitTheme } from "@/theme/clipit"
import { SignInGate } from "@/components/sign-in-gate"

/**
 * The app's providers, in one place.
 *
 * - Theme: Astryx components wear CLIPIT's theme (see theme/clipit.ts),
 *   forced dark — the product is a cinematic dark surface by design.
 * - LinkProvider: Astryx links navigate through Next's router.
 * - MotionConfig: every motion/react animation respects the visitor's
 *   "reduce motion" system setting. The CSS side of the same promise
 *   lives in globals.css.
 * - SignInGate: the one sign-in prompt, so any gated action anywhere in the
 *   app asks the same way and resumes the same way. Inside Theme, because it
 *   renders a dialog.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={clipitTheme} mode="dark">
      <LinkProvider component={Link}>
        <MotionConfig reducedMotion="user">
          <SignInGate>{children}</SignInGate>
        </MotionConfig>
      </LinkProvider>
    </Theme>
  )
}
