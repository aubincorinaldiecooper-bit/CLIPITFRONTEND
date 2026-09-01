"use client"

import { CircleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { ClipRequest } from "@/lib/types"
import { AnalyzingUpload } from "./analyzing-upload"

export interface WatchStepProps {
  request: ClipRequest | null
  /** Leaves the waiting screen. The search itself keeps running. */
  onBack?: () => void
  /** Offered when the search could not finish. */
  onRetry?: () => void
}

export function WatchStep({ request, onBack, onRetry }: WatchStepProps) {
  if (request?.status === "failed") {
    return (
      <Empty className="w-full max-w-lg rounded-2xl border-solid p-10 md:p-16">
        <EmptyHeader className="w-full max-w-md">
          <EmptyMedia variant="icon" className="size-16">
            <CircleAlert className="size-10" />
          </EmptyMedia>
          <EmptyTitle>That search could not finish</EmptyTitle>
          <EmptyDescription>
            {request.error ?? "Something went wrong while scanning your video."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="w-full max-w-md">
          {onRetry && (
            <Button className="w-full whitespace-nowrap" onClick={onRetry}>
              Try again
            </Button>
          )}
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <AnalyzingUpload
      percent={request?.progress?.percent ?? 0}
      message={request?.progress?.message ?? "Your video is being scanned for the moments you asked for."}
      actionLabel="Back to your video"
      onAction={onBack}
    />
  )
}
