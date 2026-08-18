"use client"

import { useState } from "react"
import type { Video } from "@/lib/types"

const EXAMPLES = [
  "Clip every time I score a goal.",
  "Find the part where I explain why I left.",
  "Clip the boss fight.",
  "Find when John joins the stream.",
]

interface InstructionStepProps {
  video: Video
  onSubmit: (instruction: string) => void
  busy: boolean
}

/**
 * The instruction is free text and goes to the model verbatim — there are no
 * predefined categories. The examples are prompts for the user, not options.
 */
export function InstructionStep({ video, onSubmit, busy }: InstructionStepProps) {
  const [instruction, setInstruction] = useState("")
  const canSubmit = instruction.trim().length >= 3 && !busy

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) onSubmit(instruction.trim())
        }}
        className="space-y-3"
      >
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            // Enter submits; Shift+Enter for a newline.
            if (event.key === "Enter" && !event.shiftKey && canSubmit) {
              event.preventDefault()
              onSubmit(instruction.trim())
            }
          }}
          rows={3}
          maxLength={2000}
          autoFocus
          placeholder="Describe the moment you want…"
          className="w-full resize-none rounded-xl border border-white/15 bg-transparent px-5 py-4 text-base outline-none placeholder:text-foreground/30 focus:border-foreground/40"
        />

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-foreground/40">
            {video.transcript.status === "ready"
              ? "Searches both what is on screen and what is said."
              : "Searches what is on screen."}
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-transform hover:scale-[1.03] disabled:opacity-40"
          >
            {busy ? "Searching…" : "Find moments"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setInstruction(example)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-foreground/50 transition-colors hover:border-white/25 hover:text-foreground/80"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  )
}
