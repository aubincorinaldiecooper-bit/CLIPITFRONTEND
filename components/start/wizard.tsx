"use client"

import { cn } from "@/lib/utils"
import type { StartStep } from "./types"

export interface WizardProps {
  step: StartStep
  children: React.ReactNode
}

export function Wizard({ step, children }: WizardProps) {
  return (
    <div className={cn("flex w-full flex-1 flex-col")}>
      {/* No step rail (the owner's call, 2026-09-02): the page is the video,
          the question, and nothing else. `step` still picks what is shown. */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10" data-step={step}>
        <div className="flex flex-1 flex-col items-center justify-center py-8 sm:py-12">
          {children}
        </div>
      </div>
    </div>
  )
}
