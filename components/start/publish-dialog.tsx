"use client"

import { useCallback, useState } from "react"
import { Dialog } from "@astryxdesign/core/Dialog"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import {
  PublishDone,
  WhenTo,
  WhereTo,
  publishEach,
  type PublishOutcome,
  type PublishableClip,
} from "@/components/theater/publish-flow"

/**
 * Publishing one moment from the feed — the owner's screens in a dialog
 * over the review page, so sending a clip to socials is one press from the
 * card and the feed is still there when the dialog closes.
 *
 * The moment has already been kept by the time this opens: a clip that is
 * sent out is a clip in the library, and keep is what puts it there. "Where
 * do they go?" does the publishing itself now (2026-09-02): Publish tells
 * the truth in place, so the only screen after it is Schedule's. The
 * dialog is Astryx's, as the repository asks; the screens bring their own
 * heading and way back, so it has no header of its own.
 */
export function PublishDialog({
  clip,
  onClose,
  onSignIn,
}: {
  clip: PublishableClip | null
  onClose: () => void
  /** Before a sign-in is asked for: the page parks what the return should reopen. */
  onSignIn?: () => void
}) {
  const [stage, setStage] = useState<"where" | "when" | "done">("where")
  const [busy, setBusy] = useState(false)
  const [choice, setChoice] = useState<{ accountIds: string[]; caption: string } | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<PublishOutcome[]>([])
  const [when, setWhen] = useState<Date | null>(null)

  const clips = clip ? [clip] : []

  const close = useCallback(() => {
    onClose()
    // Fresh screens next time; a finished flow must not reopen on "done".
    setStage("where")
    setChoice(null)
    setScheduleError(null)
    setOutcomes([])
    setWhen(null)
  }, [onClose])

  /** Post now, for the screen's Publish control: the truth per clip comes back to it. */
  const publish = useCallback(
    async (accountIds: string[], caption: string, clipIds?: string[]) => {
      setBusy(true)
      try {
        const chosen = clipIds ? clips.filter((entry) => clipIds.includes(entry.id)) : clips
        return await publishEach(chosen, { caption, accountIds })
      } finally {
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clip?.id],
  )

  const commitSchedule = useCallback(
    async (at: Date) => {
      if (!choice) return
      setBusy(true)
      setScheduleError(null)
      const results = await publishEach(clips, { caption: choice.caption, accountIds: choice.accountIds, scheduledAt: at.toISOString() })
      setBusy(false)
      if (results.length > 0 && results.every((result) => !result.ok)) {
        // Nothing was accepted: stay here and show the reason in place, so
        // the fix (usually the time) is one tap away.
        setScheduleError(results[0]!.detail)
        return
      }
      setOutcomes(results)
      setWhen(at)
      setStage("done")
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [choice, clip?.id],
  )

  const retryFailed = useCallback(async () => {
    if (!choice || !when || !outcomes.some((outcome) => !outcome.ok)) return
    setBusy(true)
    const results = await publishEach(clips, { caption: choice.caption, accountIds: choice.accountIds, scheduledAt: when.toISOString() })
    setOutcomes(results)
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, outcomes, when, clip?.id])

  return (
    <Dialog
      isOpen={clip !== null}
      // A submission in flight is not interrupted by Escape or a stray click.
      onOpenChange={(open) => {
        if (!open && !busy) close()
      }}
      variant="standard"
      width="min(100vw - 32px, 512px)"
      maxHeight="90vh"
      padding={0}
      purpose="info"
      aria-label="Publish this moment"
    >
      {clip && (
        <Layout
          content={
            <LayoutContent padding={6} isScrollable>
              <div className="shadcn-scope" data-testid="publish-dialog">
                {stage === "where" && (
                  <WhereTo
                    clips={clips}
                    busy={busy}
                    onBack={close}
                    onSignIn={onSignIn}
                    onPublish={publish}
                    onSchedule={(accountIds, caption) => {
                      setChoice({ accountIds, caption })
                      setScheduleError(null)
                      setStage("when")
                    }}
                  />
                )}
                {stage === "when" && (
                  <WhenTo
                    busy={busy}
                    error={scheduleError}
                    clipCount={clips.length}
                    onBack={() => setStage("where")}
                    onCommit={(at) => void commitSchedule(at)}
                  />
                )}
                {stage === "done" && (
                  <PublishDone
                    mode="scheduled"
                    when={when}
                    outcomes={outcomes}
                    busy={busy}
                    onRetryFailed={outcomes.some((outcome) => !outcome.ok) ? () => void retryFailed() : null}
                    onHome={close}
                    homeLabel="Back to your moments"
                  />
                )}
              </div>
            </LayoutContent>
          }
        />
      )}
    </Dialog>
  )
}
