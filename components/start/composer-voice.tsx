"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Speaking a question instead of typing it, ported from the owner's draft
 * (9 September) — with the part that lied taken out.
 *
 * The draft, when the microphone was refused or the browser had no speech
 * recognition, typed a fixed sentence into the box word by word behind five
 * bars driven by `Math.random()`. Every signal said the app was listening.
 * Nothing was. In this product the typed words ARE the search, so pressing
 * Enter would have searched the footage for a sentence nobody said.
 *
 * What is kept is the design: five bars that rise and fall beside the send
 * button while recording. They are driven by the real microphone through an
 * AnalyserNode, so a silent room shows still bars — which is the honest
 * picture and the one the fake could never draw.
 *
 * What this cannot do yet is turn the recording into words. Clipit's
 * transcription runs in the worker, on a file, over OpenRouter
 * (`transcribeAudioFile`), and no HTTP route accepts audio from a browser. So
 * `onCaptured` is how a recording leaves here, and when nothing is handed in,
 * `unavailable` says so plainly rather than miming a result.
 */

const BANDS = 5

export interface VoiceCapture {
  isRecording: boolean
  /** One 0–1 level per bar, live from the microphone. */
  levels: number[]
  /** Set when the microphone could not be used, in words for the person. */
  problem: string | null
  start: () => void
  stop: () => void
  dismissProblem: () => void
}

export function useVoiceCapture(onCaptured?: (audio: Blob) => void): VoiceCapture {
  const [isRecording, setIsRecording] = useState(false)
  const [levels, setLevels] = useState<number[]>(() => new Array(BANDS).fill(0))
  const [problem, setProblem] = useState<string | null>(null)

  const stream = useRef<MediaStream | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const frame = useRef<number | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  const teardown = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop()
    recorder.current = null
    if (stream.current) {
      for (const track of stream.current.getTracks()) track.stop()
      stream.current = null
    }
    if (audio.current) {
      void audio.current.close().catch(() => undefined)
      audio.current = null
    }
    setLevels(new Array(BANDS).fill(0))
  }, [])

  // The microphone must not outlive the screen.
  useEffect(() => teardown, [teardown])

  const stop = useCallback(() => {
    setIsRecording(false)
    teardown()
  }, [teardown])

  const start = useCallback(async () => {
    setProblem(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem("This browser will not give Clipit a microphone. Type the question instead.")
      return
    }

    let opened: MediaStream
    try {
      opened = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setProblem("Clipit could not reach your microphone. Check the browser's permission, or type the question instead.")
      return
    }

    stream.current = opened
    setIsRecording(true)

    // The bars, from the real signal. A quiet room draws quiet bars.
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Context) {
      const context = new Context()
      audio.current = context
      const analyser = context.createAnalyser()
      analyser.fftSize = 64
      context.createMediaStreamSource(opened).connect(analyser)
      const spectrum = new Uint8Array(analyser.frequencyBinCount)
      const step = Math.floor(spectrum.length / BANDS)

      const draw = () => {
        analyser.getByteFrequencyData(spectrum)
        const next = new Array(BANDS).fill(0).map((_, band) => {
          let sum = 0
          for (let i = 0; i < step; i += 1) sum += spectrum[band * step + i]
          return sum / step / 255
        })
        setLevels(next)
        frame.current = requestAnimationFrame(draw)
      }
      draw()
    }

    if (typeof MediaRecorder !== "undefined") {
      const capture = new MediaRecorder(opened)
      chunks.current = []
      capture.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data)
      }
      capture.onstop = () => {
        const recorded = new Blob(chunks.current, { type: capture.mimeType || "audio/webm" })
        chunks.current = []
        if (onCaptured) {
          onCaptured(recorded)
        } else {
          // Nothing to send it to yet. Say that, rather than pretending words
          // arrived — which is exactly what the draft did here.
          setProblem("Recorded, but Clipit cannot turn speech into words yet. Type the question for now.")
        }
      }
      recorder.current = capture
      capture.start()
    }
  }, [onCaptured])

  const dismissProblem = useCallback(() => setProblem(null), [])

  return { isRecording, levels, problem, start, stop, dismissProblem }
}

/** Five bars beside the send button, exactly where the draft put them. */
export function VoiceLevels({ levels, isRecording }: { levels: number[]; isRecording: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 items-center justify-end gap-[3px] overflow-hidden transition-all duration-300",
        isRecording ? "w-16 opacity-100" : "w-0 opacity-0",
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
    >
      {levels.map((level, band) => (
        <span
          key={band}
          className="w-1 rounded-full bg-primary transition-[height] duration-75 ease-out"
          style={{ height: `${Math.max(4, level * 24)}px` }}
        />
      ))}
    </span>
  )
}
