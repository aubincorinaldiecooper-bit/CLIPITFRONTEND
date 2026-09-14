import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"

/**
 * The upload engine, on the one rule this file guards: a row taken off the
 * list stops its transfer. Before, removing a row only hid it — the bytes
 * kept going, the server was told they had landed, and a replaced 4 GB
 * upload put its video in the library anyway (Devin's finding on #96).
 */
const api = vi.hoisted(() => ({
  createUpload: vi.fn(),
  uploadFile: vi.fn(),
  completeMultipartUpload: vi.fn(),
  markUploaded: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  api,
  ApiError: class ApiError extends Error {},
  uploadCancelled: () => new DOMException("The upload was stopped.", "AbortError"),
}))

import { useVideoUploads } from "../components/flow/use-video-uploads"

/** A transfer that lasts until it is stopped, or until `land` is called. */
function transfer() {
  let land!: () => void
  const stopped = vi.fn()
  api.uploadFile.mockImplementation(
    (_videoId: string, _target: unknown, _file: File, _onProgress: unknown, signal?: AbortSignal) =>
      new Promise<{ multipart?: undefined }>((resolve, reject) => {
        land = () => resolve({})
        signal?.addEventListener("abort", () => {
          stopped()
          reject(signal.reason)
        })
      }),
  )
  return { land: () => land(), stopped }
}

beforeEach(() => {
  api.createUpload.mockReset().mockResolvedValue({ video: { id: "video-1" }, upload: { method: "PUT", url: "https://store.test/put", storageKey: "k", headers: {}, expiresInSeconds: 60 } })
  api.uploadFile.mockReset()
  api.completeMultipartUpload.mockReset()
  api.markUploaded.mockReset().mockResolvedValue({ video: { id: "video-1", status: "queued" } })
})
afterEach(cleanup)

const file = () => new File(["x"], "film.mp4", { type: "video/mp4" })

describe("useVideoUploads — a removed row stops its transfer", () => {
  it("stops the bytes, never tells the server they landed, and does not report the video", async () => {
    const onBatchLanded = vi.fn()
    const going = transfer()
    const { result } = renderHook(() => useVideoUploads({ onBatchLanded }))
    act(() => result.current.startUploads([file()]))
    await waitFor(() => expect(api.uploadFile).toHaveBeenCalledTimes(1))
    const id = result.current.uploads[0]!.id

    act(() => result.current.removeUpload(id))
    await waitFor(() => expect(going.stopped).toHaveBeenCalledTimes(1))
    expect(result.current.uploads).toEqual([])
    // Nothing is said to the server about bytes that did not arrive, and no
    // landed video comes back to put itself on screen.
    await waitFor(() => expect(result.current.uploadsBusy).toBe(false))
    expect(api.markUploaded).not.toHaveBeenCalled()
    expect(onBatchLanded).not.toHaveBeenCalled()
  })

  it("a transfer that lands is still told to the server, and reported", async () => {
    const onBatchLanded = vi.fn()
    const going = transfer()
    const { result } = renderHook(() => useVideoUploads({ onBatchLanded }))
    act(() => result.current.startUploads([file()]))
    await waitFor(() => expect(api.uploadFile).toHaveBeenCalledTimes(1))
    going.land()
    await waitFor(() => expect(api.markUploaded).toHaveBeenCalledWith("video-1"))
    await waitFor(() => expect(onBatchLanded).toHaveBeenCalledTimes(1))
    expect(result.current.uploads[0]?.phase).toBe("ready")
  })

  it("clearing the list stops every transfer still going", async () => {
    const going = transfer()
    const { result } = renderHook(() => useVideoUploads())
    act(() => result.current.startUploads([file()]))
    await waitFor(() => expect(api.uploadFile).toHaveBeenCalledTimes(1))
    act(() => result.current.clearUploads())
    await waitFor(() => expect(going.stopped).toHaveBeenCalledTimes(1))
    expect(result.current.uploads).toEqual([])
    await waitFor(() => expect(result.current.uploadsBusy).toBe(false))
    expect(api.markUploaded).not.toHaveBeenCalled()
  })

  it("a stopped transfer is not written up as a failure", async () => {
    transfer()
    const { result } = renderHook(() => useVideoUploads())
    act(() => result.current.startUploads([file()]))
    await waitFor(() => expect(api.uploadFile).toHaveBeenCalledTimes(1))
    const id = result.current.uploads[0]!.id
    act(() => result.current.removeUpload(id))
    await waitFor(() => expect(result.current.uploadsBusy).toBe(false))
    // The row is gone; nothing came back to say "failed" about it.
    expect(result.current.uploads.find((entry) => entry.id === id)).toBeUndefined()
  })
})
