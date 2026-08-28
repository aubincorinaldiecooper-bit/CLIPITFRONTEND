"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "motion/react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

/**
 * uselayouts' status-button, made controllable.
 *
 * The original is a demo: label hardcoded to "Save", state driven by
 * setTimeout. The motion is the point — each letter springs in and out as the
 * label morphs, and a small badge with a spinner-then-tick rides the corner —
 * so all of that is kept verbatim. What changes is that the label and the
 * state come from the caller, because a real button reports a real request.
 */
export type StatusButtonState = "idle" | "loading" | "success"

export function StatusButton({
  state,
  idleLabel,
  loadingLabel,
  successLabel,
  type = "button",
  onClick,
  disabled = false,
  className,
}: {
  state: StatusButtonState
  idleLabel: string
  loadingLabel: string
  successLabel: string
  type?: "button" | "submit"
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const text = state === "idle" ? idleLabel : state === "loading" ? loadingLabel : successLabel

  return (
    <div className="group relative inline-flex font-sans">
      <Button
        type={type}
        onClick={onClick}
        className={cn(
          "relative min-w-[140px] rounded-full transition-all duration-300 disabled:opacity-100",
          state !== "idle" &&
            "cursor-not-allowed border-shmuted bg-shmuted text-muted-foreground shadow-sm hover:bg-shmuted",
          className,
        )}
        disabled={disabled || state !== "idle"}
      >
        <span className="flex items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {text.split("").map((char, i) => (
              <motion.span
                key={`${char}-${i}`}
                layout
                initial={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 500, damping: 30, mass: 1 }}
                className="inline-block whitespace-pre"
              >
                {char}
              </motion.span>
            ))}
          </AnimatePresence>
        </span>
      </Button>

      <div className="pointer-events-none absolute -right-1 -top-1 z-10">
        <AnimatePresence mode="wait">
          {state !== "idle" && (
            <motion.div
              initial={{ opacity: 0, scale: 0, x: -8, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0, x: -8, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={cn(
                "flex size-6 items-center justify-center overflow-visible rounded-full ring-3 ring-shmuted",
                state === "success" ? "bg-shprimary text-primary-foreground" : "bg-shmuted text-muted-foreground",
              )}
            >
              <AnimatePresence mode="popLayout">
                {state === "loading" && (
                  <motion.div
                    key="loader"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8A8 8 0 0 1 12 20Z"
                        opacity=".5"
                      />
                      <path fill="currentColor" d="M20 12h2A10 10 0 0 0 12 2V4A8 8 0 0 1 20 12Z">
                        <animateTransform
                          attributeName="transform"
                          dur="1s"
                          from="0 12 12"
                          repeatCount="indefinite"
                          to="360 12 12"
                          type="rotate"
                        />
                      </path>
                    </svg>
                  </motion.div>
                )}
                {state === "success" && (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, opacity: 0, filter: "blur(4px)" }}
                    animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                    exit={{ scale: 0, opacity: 0, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
