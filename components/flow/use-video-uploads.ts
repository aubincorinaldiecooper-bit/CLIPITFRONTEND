"use client"

import { useCallback, useRef, useState } from "react"
import { api, ApiError, uploadCancelled } from "@/lib/api"
import type { Video } from "@/lib/types"
import { MAX_FILES, MAX_FILE_BYTES, type UploadEntry } from "@/components/flow/upload-package"

/**
 * The upload engine both doors share — New clip's drop zone and the library's
 * drag-anywhere — so a file behaves identically whichever way it came in:
 * its own row, its own progress, its own outcome, and the same refusals.
 *
 * It also holds the free plan's gate. The plan covers videos up to
 * FREE_MAX_VIDEO_MINUTES long (the number the pricing page promises), and the
 * browser can read a file's duration without uploading a byte — so a video
 * past the cap is turned away before the upload starts, with the upgrade ask
 * surfaced by the page. A file whose duration cannot be read is let through:
 * refusing on an unproved claim would block real work, and the server remains
 * the true gate for anything the client cannot verify.
 */

/** The free plan's per-video cap, as the pricing page states it. */
export const FREE_MAX_VIDEO_MINUTES = 30
const FREE_MAX_VIDEO_SECONDS = FREE_MAX_VIDEO_MINUTES * 60

/** Temporarily disabled so long footage can be uploaded while the paid tiers are still being set up. */
const FREE_VIDEO_CAP_ENABLED = false

/** A file the free plan turned away, for the upgrade dialog to name. */
export interface OverLimitFile {
  name: string
  minutes: number
}

/** Read how long a video file runs, without uploading it. Null if unreadable. */
function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const element = document.createElement("video")
    const done = (value: number | null) => {
      URL.revokeObjectURL(url)
      element.removeAttribute("src")
      resolve(value)
    }
    element.preload = "metadata"
    element.onloadedmetadata = () =>
      done(Number.isFinite(element.duration) ? element.duration : null)
    element.onerror = () => done(null)
    // A file the browser cannot parse in ten seconds is not going to answer.
    setTimeout(() => done(null), 10_000)
    element.src = url
  })
}

export function useVideoUploads({
  onBatchLanded,
}: {
  /** Every accepted file of one drop has settled; the ready videos, in order. */
  onBatchLanded?: (videos: Video[]) => void
} = {}) {
  const [uploads, setUploads] = useState<UploadEntry[]>([])
  const uploadsRef = useRef<UploadEntry[]>([])
  uploadsRef.current = uploads
  const [busy, setBusy] = useState(false)
  /** Files the free plan turned away in the latest pick; the page shows the
   *  upgrade ask while this is non-empty. */
  const [overLimit, setOverLimit] = useState<OverLimitFile[]>([])
  const clearOverLimit = useCallback(() => setOverLimit([]), [])

  const patchUpload = useCallback((id: string, patch: Partial<UploadEntry>) => {
    setUploads((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }, [])

  /**
   * One handle per transfer in flight, so taking a row off the list stops
   * its bytes — a replaced 4 GB upload used to carry on to the end and put
   * its video in the library anyway (Devin's finding on #96).
   */
  const transfers = useRef(new Map<string, AbortController>())
  const stopTransfer = useCallback((id: string) => {
    transfers.current.get(id)?.abort(uploadCancelled())
    transfers.current.delete(id)
  }, [])

  /**
   * Carry one file all the way: ask for a slot, send the bytes — in one PUT,
   * or part by part for a big file — seal a part-by-part upload, then tell
   * the server it landed. Every failure is written onto that file's own row.
   * A transfer stopped on the way is not a failure and is not marked as
   * landed: the server never hears that its bytes arrived, because they did
   * not. A stop can only stop bytes, though. Once they are all in storage
   * the landing is seen through — the part-by-part upload sealed and the
   * server told — because the alternative is a whole object stored for
   * ever behind a video nobody can see (Devin's finding on #96). The one
   * exception is a stop that lands between the last part and the seal: the
   * parts are abandoned — the stop is not settled until they are — which is
   * the clean end there is.
   */
  const runUpload = useCallback(
    async (entry: UploadEntry) => {
      const controller = new AbortController()
      transfers.current.get(entry.id)?.abort(uploadCancelled())
      transfers.current.set(entry.id, controller)
      const { signal } = controller
      patchUpload(entry.id, { phase: "uploading", progress: 0, error: undefined })
      try {
        const { video: created, upload } = await api.createUpload(
          entry.file.name,
          entry.file.type || undefined,
          entry.file.size,
        )
        if (signal.aborted) return null
        patchUpload(entry.id, { videoId: created.id })
        const outcome = await api.uploadFile(
          created.id,
          upload,
          entry.file,
          (fraction) => patchUpload(entry.id, { progress: fraction }),
          signal,
        )
        if (outcome.multipart) {
          if (signal.aborted) {
            // Every part is in storage and none is sealed: walk away
            // cleanly, as a failed part does, so nothing is left billed —
            // and settle only once that is done. The tidy-up is part of the
            // stop, not something fired after it: the request outlives the
            // tab and is tried a few bounded times, in abortMultipartUpload
            // (Devin's finding on #96). Past those attempts the catch below
            // settles the stop anyway; the bucket's sweep is the backstop.
            await api.abortMultipartUpload(created.id, outcome.multipart.uploadId)
            return null
          }
          await api.completeMultipartUpload(created.id, outcome.multipart.uploadId, outcome.multipart.parts)
        }
        // The bytes are whole in storage now, stop or no stop. The server is
        // told so; a row already taken off the list simply shows nothing of
        // it — the engine's landed-batch filter keeps a removed row's video
        // off the screen — and the video is in the library, where it can be
        // deleted, rather than stored unseen.
        const { video: queued } = await api.markUploaded(created.id)
        if (signal.aborted) return null
        patchUpload(entry.id, { phase: "ready", progress: 1, videoId: queued.id })
        return queued
      } catch (cause) {
        // Stopped, not failed: the row is already gone, and there is nothing
        // to say on it.
        if (signal.aborted) return null
        patchUpload(entry.id, {
          phase: "failed",
          error: cause instanceof ApiError ? cause.message : "Upload failed. Try again.",
        })
        return null
      } finally {
        if (transfers.current.get(entry.id) === controller) transfers.current.delete(entry.id)
      }
    },
    [patchUpload],
  )

  const startUploads = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      void (async () => {
        // The free gate first: a video past the plan's cap never starts.
        const tooLong: OverLimitFile[] = []
        const withinPlan: File[] = []
        for (const file of files) {
          if (FREE_VIDEO_CAP_ENABLED) {
            const seconds = await probeDuration(file)
            if (seconds !== null && seconds > FREE_MAX_VIDEO_SECONDS) {
              tooLong.push({ name: file.name, minutes: Math.round(seconds / 60) })
            } else {
              withinPlan.push(file)
            }
          } else {
            withinPlan.push(file)
          }
        }
        if (tooLong.length > 0) setOverLimit(tooLong)

        const room = Math.max(0, MAX_FILES - uploadsRef.current.length)
        const taken = withinPlan.slice(0, room)
        const overflow = withinPlan.slice(room)

        const rejected: UploadEntry[] = []
        const accepted: UploadEntry[] = []
        taken.forEach((file, index) => {
          const entry: UploadEntry = {
            id: `${Date.now()}-${index}-${file.name}`,
            file,
            phase: "queued",
          }
          // Refused files still get a row. A file that vanishes on being
          // dropped reads as a bug in the page; a row saying why reads as an
          // answer.
          if (file.size > MAX_FILE_BYTES) {
            rejected.push({ ...entry, phase: "failed", error: "Too large to upload" })
          } else {
            accepted.push(entry)
          }
        })
        overflow.forEach((file, index) => {
          rejected.push({
            id: `${Date.now()}-over-${index}-${file.name}`,
            file,
            phase: "failed",
            error: `More than ${MAX_FILES} files in one go`,
          })
        })

        const added = [...accepted, ...rejected]
        if (added.length === 0) return
        setUploads((current) => [...current, ...added])
        if (accepted.length === 0) return

        setBusy(true)
        void Promise.all(
          accepted.map(async (entry) => ({ entry, video: await runUpload(entry) })),
        )
          .then((results) => {
            // A file taken off the list while its bytes were still going up
            // has been dismissed: it must not come back as a landed video and
            // put itself on screen.
            const landed = results
              .filter((result) => uploadsRef.current.some((entry) => entry.id === result.entry.id))
              .map((result) => result.video)
              .filter((video): video is Video => video !== null)
            if (landed.length > 0) onBatchLanded?.(landed)
          })
          .finally(() => setBusy(false))
      })()
    },
    [onBatchLanded, runUpload],
  )

  const retryUpload = useCallback(
    (id: string) => {
      const entry = uploadsRef.current.find((candidate) => candidate.id === id)
      // A file refused for its size or for overflowing the batch has nothing
      // to retry — trying again would fail the same way.
      if (!entry || entry.file.size > MAX_FILE_BYTES) return
      setBusy(true)
      void runUpload(entry).finally(() => setBusy(false))
    },
    [runUpload],
  )

  /** Take a row off the list, and stop its transfer if one is still going. */
  const removeUpload = useCallback(
    (id: string) => {
      stopTransfer(id)
      setUploads((current) => current.filter((entry) => entry.id !== id))
    },
    [stopTransfer],
  )

  /** Empty the list, stopping every transfer still going. */
  const clearUploads = useCallback(() => {
    for (const id of Array.from(transfers.current.keys())) stopTransfer(id)
    setUploads([])
  }, [stopTransfer])

  return {
    uploads,
    setUploads,
    uploadsBusy: busy,
    startUploads,
    retryUpload,
    removeUpload,
    clearUploads,
    overLimit,
    clearOverLimit,
  }
}
