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
  actionLabel?: string
  onAction?: () => void
}

/**
 * Loading card used while Clipit watches the uploaded video.
 *
 * Uses the shadcn Empty pattern + loading-ui animated icon/shimmer,
 * adapted to video with a progress bar and a full-width outline action.
 */
export function AnalyzingUpload({
  percent = 0,
  message,
  actionLabel = "Back",
  onAction,
}: AnalyzingUploadProps) {
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
        {onAction && (
          <Button variant="outline" className="w-full whitespace-nowrap" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}
