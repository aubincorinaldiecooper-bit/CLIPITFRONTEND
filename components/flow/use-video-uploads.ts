"use client"

import { useCallback, useRef, useState } from "react"
import { api, ApiError } from "@/lib/api"
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
   * Carry one file all the way: ask for a slot, send the bytes — in one PUT,
   * or part by part for a big file — seal a part-by-part upload, then tell
   * the server it landed. Every failure is written onto that file's own row.
   */
  const runUpload = useCallback(
    async (entry: UploadEntry) => {
      patchUpload(entry.id, { phase: "uploading", progress: 0, error: undefined })
      try {
        const { video: created, upload } = await api.createUpload(
          entry.file.name,
          entry.file.type || undefined,
          entry.file.size,
        )
        patchUpload(entry.id, { videoId: created.id })
        const outcome = await api.uploadFile(upload, entry.file, (fraction) =>
          patchUpload(entry.id, { progress: fraction }),
        )
        if (outcome.multipart) {
          await api.completeMultipartUpload(created.id, outcome.multipart.uploadId, outcome.multipart.parts)
        }
        const { video: queued } = await api.markUploaded(created.id)
        patchUpload(entry.id, { phase: "ready", progress: 1, videoId: queued.id })
        return queued
      } catch (cause) {
        patchUpload(entry.id, {
          phase: "failed",
          error: cause instanceof ApiError ? cause.message : "Upload failed. Try again.",
        })
        return null
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
          const seconds = await probeDuration(file)
          if (seconds !== null && seconds > FREE_MAX_VIDEO_SECONDS) {
            tooLong.push({ name: file.name, minutes: Math.round(seconds / 60) })
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
        void Promise.all(accepted.map((entry) => runUpload(entry)))
          .then((results) => {
            const landed = results.filter((video): video is Video => video !== null)
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

  const removeUpload = useCallback((id: string) => {
    setUploads((current) => current.filter((entry) => entry.id !== id))
  }, [])

  return {
    uploads,
    setUploads,
    uploadsBusy: busy,
    startUploads,
    retryUpload,
    removeUpload,
    overLimit,
    clearOverLimit,
  }
}
