"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import type { Transition } from "motion/react"

const transition: Transition = {
  duration: 2.5,
  ease: [0.175, 0.885, 0.32, 1],
  times: [0, 0.6, 0.6, 1],
  repeat: Infinity,
  repeatType: "mirror",
  repeatDelay: 0.2,
}

const clapperboardPaths = [
  "m12.296 3.464 3.02 3.956",
  "M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z",
  "M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  "m6.18 5.276 3.1 3.899",
]

function ClapperboardSvg({
  className,
  fillDots = false,
}: {
  className?: string
  fillDots?: boolean
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {clapperboardPaths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {fillDots && (
        <>
          <rect x="5" y="13" width="1" height="1" fill="currentColor" />
          <rect x="7" y="14" width="1" height="1" fill="currentColor" />
          <rect x="9" y="13.5" width="1" height="1" fill="currentColor" />
          <rect x="11" y="15" width="1" height="1" fill="currentColor" />
          <rect x="13" y="13" width="1" height="1" fill="currentColor" />
          <rect x="15" y="14.5" width="1" height="1" fill="currentColor" />
          <rect x="17" y="13" width="1" height="1" fill="currentColor" />
          <rect x="19" y="15" width="1" height="1" fill="currentColor" />
          <rect x="6" y="16" width="1" height="1" fill="currentColor" />
          <rect x="8" y="17" width="1" height="1" fill="currentColor" />
          <rect x="10" y="16.5" width="1" height="1" fill="currentColor" />
          <rect x="12" y="17.5" width="1" height="1" fill="currentColor" />
          <rect x="14" y="16" width="1" height="1" fill="currentColor" />
          <rect x="16" y="17" width="1" height="1" fill="currentColor" />
          <rect x="18" y="16" width="1" height="1" fill="currentColor" />
          <rect x="6.5" y="14" width="1" height="1" fill="currentColor" />
          <rect x="10.5" y="14.5" width="1" height="1" fill="currentColor" />
          <rect x="14.5" y="14" width="1" height="1" fill="currentColor" />
          <rect x="18.5" y="14.5" width="1" height="1" fill="currentColor" />
          <rect x="8" y="18" width="1" height="1" fill="currentColor" />
          <rect x="12" y="18" width="1" height="1" fill="currentColor" />
          <rect x="16" y="18" width="1" height="1" fill="currentColor" />
        </>
      )}
    </svg>
  )
}

export function AnalyzingVideo({ className, ...props }: React.ComponentProps<"div">) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      role="status"
      aria-label="Analyzing video"
      className={cn("relative isolate shrink-0", className)}
      {...props}
    >
      <motion.div
        initial={{
          clipPath: "inset(0% 0% 0% 0%)",
        }}
        animate={
          reducedMotion
            ? undefined
            : {
                clipPath: [
                  "inset(0% 0% 0% 0%)",
                  "inset(0% 105% 0% 0%)",
                  "inset(0% 105% 0% 0%)",
                  "inset(0% 0% 0% 0%)",
                ],
              }
        }
        transition={transition}
        className="absolute inset-0 z-10 bg-[var(--loading-ui-analyzing-video-background,var(--background))]"
      >
        <ClapperboardSvg className="size-full" />
      </motion.div>

      <motion.div
        initial={{ transform: "translateX(1400%)" }}
        animate={
          reducedMotion
            ? undefined
            : {
                transform: [
                  "translateX(1400%)",
                  "translateX(-80%)",
                  "translateX(-80%)",
                  "translateX(1400%)",
                ],
              }
        }
        transition={transition}
        className="absolute z-10 h-full w-[7%] rounded-full bg-current"
      />

      <ClapperboardSvg className="absolute inset-0 size-full" fillDots />
      <span className="sr-only">Analyzing video</span>
    </div>
  )
}
