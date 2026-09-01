"use client"

import { cn } from "@/lib/utils"
import type { StartStep } from "./types"

const STEPS: { id: StartStep; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "watch", label: "Watch" },
  { id: "review", label: "Review" },
]

export function Stepper({ active, className }: { active: StartStep; className?: string }) {
  const activeIndex = STEPS.findIndex((step) => step.id === active)

  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isActive = index === activeIndex
          const isCompleted = index < activeIndex
          const isLast = index === STEPS.length - 1

          return (
            <li key={step.id} className="flex flex-1 items-center">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    isActive && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background",
                    isCompleted && "bg-primary text-primary-foreground",
                    !isActive && !isCompleted && "border border-border bg-background text-muted-foreground",
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-sm font-medium sm:inline",
                    isActive || isCompleted ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-4 h-px flex-1 min-w-[2rem]",
                    isCompleted ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
