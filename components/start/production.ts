import type { PublishableClip } from "@/components/theater/publish-flow"
import type { Clip, ClipMatch, MatchFeedback, MatchFeedbackReason } from "@/lib/types"
import type { Exchange } from "./types"

/**
 * Where a kept moment's file is.
 *
 * A moment is the evidence — a stretch of the video, its words, a still —
 * and its finished 9:16 file is made when a person keeps it. Between the
 * press and the file there is a state the card, the dialogue and the
 * publish screens all need to agree on, so it is decided in one place from
 * the clip row the server tells.
 *
 * Null means nothing was asked for: no clip exists for the moment.
 */
export type Production = "producing" | "produced" | "failed"

export function productionOf(clip: Clip | null | undefined, stub?: ClipMatch["clip"] | null): Production | null {
  if (!clip) {
    // The match knows a clip exists before the row itself has been fetched.
    if (!stub) return null
    return stub.status === "failed" ? "failed" : "producing"
  }
  if (clip.status === "failed") return "failed"
  if (clip.status !== "ready") return "producing"
  // A vertical moment's file is its 9:16 derivative — never the landscape
  // cut in its place. The media block says whether that file exists.
  if (clip.media) {
    if (clip.media.derivativeStatus === "failed") return "failed"
    return clip.media.url ? "produced" : "producing"
  }
  return clip.url ? "produced" : "producing"
}

/**
 * Whether Publish has to keep the moment before it can send it. A moment
 * not yet kept has nothing made; a kept moment whose cut failed is kept
 * again, which makes it again (the server produces on Keep for a failed
 * render). Otherwise its clip already exists (Devin's and Codex's finding
 * on #87: a failed cut had no working retry).
 */
export function needsKeep(match: Pick<ClipMatch, "feedback" | "clip">, clip: Clip | null | undefined): boolean {
  if (match.feedback !== "approved") return true
  // A row the conversation holds counts even before the match has been
  // re-read with its id (Codex's finding on #88: Publish kept again, and
  // cut again, a moment whose finished clip was already on screen).
  if (!clip && !match.clip?.id) return true
  return productionOf(clip, match.clip) === "failed"
}

/** The clip row a moment has, by the id the match names or by the moment the row names. */
export function clipRowFor(match: Pick<ClipMatch, "id" | "clip">, clips: Clip[]): Clip | null {
  const clipId = match.clip?.id
  return clips.find((clip) => (clipId ? clip.id === clipId : clip.clipMatchId === match.id)) ?? null
}

/** What the card shows again after a Keep that failed, and whether the server has to be told. */
export interface KeepRollback {
  verdict: MatchFeedback | null
  reason: MatchFeedbackReason | null
  /** Only when the failed press had recorded a verdict the moment did not have before. */
  tellServer: boolean
}

/**
 * A press that failed changes nothing it did not make. A first Keep whose
 * cut then did not start takes its own approval back; a Keep again on a
 * moment already kept — its cut failed once — leaves the moment kept when
 * it fails again, at either step (Devin's finding on #88: the retry used
 * the first Keep's rollback and made a kept moment undecided).
 */
export function afterFailedKeep(
  previous: { verdict: MatchFeedback | null; reason: MatchFeedbackReason | null },
  failedAt: "approve" | "produce",
): KeepRollback {
  return {
    verdict: previous.verdict,
    reason: previous.reason,
    tellServer: failedAt === "produce" && previous.verdict !== "approved",
  }
}

/**
 * The file to save, once there is one: the same file the card plays. A
 * vertical moment whose 9:16 file has not landed offers nothing rather than
 * the landscape cut; so does a server that does not sign one for saving.
 */
export function downloadUrlOf(clip: Clip | null | undefined): string | null {
  if (!clip || productionOf(clip) !== "produced") return null
  if (clip.media) return clip.media.downloadUrl ?? null
  return clip.downloadUrl ?? null
}

/**
 * The clip the publish screens are open for, read fresh from the
 * conversation on every render: Publish keeps the moment, its file is made,
 * and the dialog's "ready" flips the moment the server says the file is
 * there — not on a timer, and not from a snapshot taken at the press.
 */
export function publishableFor(exchanges: Exchange[], clipId: string, fallbackTitle: string): PublishableClip {
  for (const exchange of exchanges) {
    const clip = exchange.clips.find((candidate) => candidate.id === clipId)
    const match = exchange.request.matches?.find((candidate) => candidate.clip?.id === clipId)
    if (!clip && !match) continue
    return {
      id: clipId,
      title: match?.description || fallbackTitle,
      ready: productionOf(clip ?? null, match?.clip ?? null) === "produced",
    }
  }
  return { id: clipId, title: fallbackTitle, ready: false }
}
