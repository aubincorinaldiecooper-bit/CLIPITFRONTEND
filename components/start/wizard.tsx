"use client"

import { cn } from "@/lib/utils"
import type { StartStep } from "./types"
import { Stepper } from "./stepper"

const STEPS: Exclude<StartStep, "review">[] = ["upload", "watch"]

export interface WizardProps {
  step: StartStep
  children: React.ReactNode
}

export function Wizard({ step, children }: WizardProps) {
  return (
    <div className={cn("flex w-full flex-1 flex-col")}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        <Stepper active={step} />

        <div className="flex flex-1 flex-col items-center justify-center py-8 sm:py-12">
          {children}
        </div>
      </div>
    </div>
  )
}
