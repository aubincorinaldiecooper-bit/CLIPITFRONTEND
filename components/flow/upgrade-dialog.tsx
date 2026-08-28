"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FREE_MAX_VIDEO_MINUTES, type OverLimitFile } from "@/components/flow/use-video-uploads"

/**
 * The upgrade ask, when a video runs past what the free plan covers.
 *
 * It names the files and their real lengths, because "too long" without a
 * number reads as arbitrary. The way up: paid plans are not switched on yet
 * (pricing is behind its flag until Stripe lands), so the button reaches the
 * founder directly — the same door the Enterprise card uses. When plans go
 * live this button should point at them instead.
 */
export function UpgradeDialog({
  files,
  onClose,
}: {
  files: OverLimitFile[]
  onClose: () => void
}) {
  return (
    <Dialog
      open={files.length > 0}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="shadcn-scope sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>That video needs a bigger plan</DialogTitle>
          <DialogDescription>
            The free plan covers videos up to {FREE_MAX_VIDEO_MINUTES} minutes long.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5">
          {files.map((file) => (
            <li key={file.name} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{file.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                about {file.minutes} min
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Bigger plans cover up to 6-hour videos. They&apos;re nearly ready — until they&apos;re
          live, ask and we&apos;ll set you up directly.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button asChild>
            <a href="mailto:aubincorinaldiecooper@gmail.com?subject=Clipit%20upgrade">
              Chat with founder
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
