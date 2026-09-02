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
 * Publishing one moment from the feed — the owner's screens (Where do they
 * go? → now or later → what happened), in a dialog over the review page,
 * so sending a clip to socials is one press from the card and the feed is
 * still there when the dialog closes.
 *
 * The moment has already been kept by the time this opens: a clip that is
 * sent out is a clip in the library, and keep is what puts it there. The
 * screens themselves are the theater's — what they say about accounts,
 * readiness and outcomes holds here unchanged. The dialog is Astryx's, as
 * the repository asks and as this step's Preview dialog was; the screens
 * bring their own heading and way back, so it has no header of its own.
 */
export function PublishDialog({ clip, onClose }: { clip: PublishableClip | null; onClose: () => void }) {
  const [stage, setStage] = useState<"where" | "when" | "done">("where")
  const [busy, setBusy] = useState(false)
  const [choice, setChoice] = useState<{ accountIds: string[]; caption: string } | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<PublishOutcome[]>([])
  const [mode, setMode] = useState<"now" | "scheduled">("now")
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

  const postNow = useCallback(
    async (accountIds: string[], caption: string) => {
      setBusy(true)
      setChoice({ accountIds, caption })
      const results = await publishEach(clips, { caption, accountIds })
      setOutcomes(results)
      setMode("now")
      setWhen(null)
      setBusy(false)
      setStage("done")
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
      setMode("scheduled")
      setWhen(at)
      setStage("done")
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [choice, clip?.id],
  )

  const retryFailed = useCallback(async () => {
    if (!choice || !outcomes.some((outcome) => !outcome.ok)) return
    setBusy(true)
    const results = await publishEach(clips, {
      caption: choice.caption,
      accountIds: choice.accountIds,
      ...(mode === "scheduled" && when ? { scheduledAt: when.toISOString() } : {}),
    })
    setOutcomes(results)
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, outcomes, mode, when, clip?.id])

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
                    onPostNow={(accountIds, caption) => void postNow(accountIds, caption)}
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
                    mode={mode}
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
