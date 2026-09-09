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

  /**
   * A start can be abandoned while the permission prompt is still open.
   *
   * Devin's finding on #90, and it was the serious one: the screen closes, the
   * cleanup runs, and THEN getUserMedia resolves and hands over a live stream
   * that nothing is left to stop. The microphone stays on with the screen
   * gone. `generation` is bumped by every teardown, so a start that comes back
   * to a stale generation stops the tracks it was given and leaves.
   */
  const mounted = useRef(true)
  const generation = useRef(0)
  const starting = useRef(false)

  const stream = useRef<MediaStream | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const frame = useRef<number | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)

  const teardown = useCallback(() => {
    // Anything still being acquired belongs to a run that is over.
    generation.current += 1
    starting.current = false
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
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      teardown()
    }
  }, [teardown])

  const stop = useCallback(() => {
    setIsRecording(false)
    teardown()
  }, [teardown])

  const start = useCallback(async () => {
    // One prompt at a time: tapping twice must not open two microphones.
    if (starting.current || stream.current) return
    setProblem(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem("This browser will not give Clipit a microphone. Type the question instead.")
      return
    }

    const mine = generation.current
    starting.current = true

    let opened: MediaStream
    try {
      opened = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      starting.current = false
      if (mounted.current && generation.current === mine) {
        setProblem("Clipit could not reach your microphone. Check the browser's permission, or type the question instead.")
      }
      return
    }

    starting.current = false

    // Gone, stopped, or superseded while the prompt was open. Whoever asked
    // for this is no longer listening, so end it here rather than leave a
    // microphone running behind a screen nobody is on.
    if (!mounted.current || generation.current !== mine) {
      for (const track of opened.getTracks()) track.stop()
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
      /**
       * This session's own sound, in its own array.
       *
       * Devin's second finding on #90: one shared array meant a quick stop
       * and start had two recorders writing into it. `stop()` finishes
       * asynchronously, so the old recorder's handler could run after the new
       * one had begun — and hand back, or throw away, the recording that was
       * still being made.
       */
      const collected: Blob[] = []
      capture.ondataavailable = (event) => {
        if (event.data.size > 0) collected.push(event.data)
      }
      capture.onstop = () => {
        // Superseded by a newer recording, or the screen is gone.
        if (recorder.current !== null && recorder.current !== capture) return
        if (!mounted.current) return

        const recorded = new Blob(collected, { type: capture.mimeType || "audio/webm" })
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
