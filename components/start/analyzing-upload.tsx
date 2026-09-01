"use client"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { AnalyzingVideo } from "@/components/loading-ui/analyzing-video"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"

export interface AnalyzingUploadProps {
  /** 0–100. */
  percent?: number
  message?: string
  onCancel?: () => void
}

/**
 * Loading card used while Clipit watches the uploaded video.
 *
 * Uses the shadcn Empty pattern + loading-ui animated icon/shimmer,
 * adapted to video with a progress bar and full-width outline Cancel.
 */
export function AnalyzingUpload({ percent = 0, message, onCancel }: AnalyzingUploadProps) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <Empty className="w-full max-w-lg rounded-2xl border-solid p-10 md:p-16">
      <EmptyHeader className="w-full max-w-md">
        <EmptyMedia
          variant="icon"
          className="size-16 [--loading-ui-analyzing-video-background:var(--muted)]"
        >
          <AnalyzingVideo className="size-10" />
        </EmptyMedia>

        <EmptyTitle>
          <TextShimmer as="span">Analyzing upload</TextShimmer>
        </EmptyTitle>

        <EmptyDescription>
          {message ?? "Your video is being scanned for the moments you asked for."}
        </EmptyDescription>

        <Progress value={clamped} className="h-3 w-full" />
      </EmptyHeader>

      <EmptyContent className="w-full max-w-md">
        {onCancel && (
          <Button variant="outline" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}
