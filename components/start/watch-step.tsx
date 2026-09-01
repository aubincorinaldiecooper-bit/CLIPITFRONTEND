"use client"

import type { ClipRequest } from "@/lib/types"
import { AnalyzingUpload } from "./analyzing-upload"

export interface WatchStepProps {
  request: ClipRequest | null
  onCancel?: () => void
}

/**
 * Step 02: Clipit watches. Shows a focused progress card using the real
 * request progress and message, with an explicit Cancel action.
 */
export function WatchStep({ request, onCancel }: WatchStepProps) {
  const failed = request?.status === "failed"
  const percent = request?.progress?.percent ?? 0
  const message = failed
    ? request?.error ?? "The search could not finish."
    : request?.progress?.message ?? "Your video is being scanned for the moments you asked for."

  return (
    <AnalyzingUpload
      percent={failed ? 100 : percent}
      message={message}
      onCancel={onCancel}
    />
  )
}
