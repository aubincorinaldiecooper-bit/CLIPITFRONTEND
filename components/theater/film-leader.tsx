"use client"

import { useEffect, useRef } from "react"

/**
 * The film-leader countdown, from the owner's reference deck.
 *
 * What plays while a video is being read: a projectionist's academy leader —
 * sprocket holes ticking past, registration marks, a sweeping second hand and
 * a counting numeral. It says "something is being watched" far better than a
 * spinner does, and it is honest about the wait: the count loops rather than
 * pretending to measure progress it does not have.
 *
 * Painted on a canvas because it is a hundred moving hairlines a second;
 * doing it in the DOM would be a hundred elements re-laid-out every frame.
 * The palette is Clipit's light ground, not the reference's, so it sits in
 * the app rather than on top of it.
 */

const MONO_STACK = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
const INK = (alpha: number) => `rgba(17,17,22,${alpha})`
const pad = (value: number, width = 2) => String(Math.floor(value)).padStart(width, "0")

function registrationMark(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  c.beginPath()
  c.moveTo(x - size, y)
  c.lineTo(x + size, y)
  c.moveTo(x, y - size)
  c.lineTo(x, y + size)
  c.stroke()
  c.beginPath()
  c.arc(x, y, size * 0.52, 0, Math.PI * 2)
  c.stroke()
}

function paintLeader(c: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const bar = height * 0.112
  const top = bar
  const bottom = height - bar
  const frameHeight = bottom - top
  const cx = width / 2
  const cy = top + frameHeight / 2
  const radius = Math.min(frameHeight, width) * 0.325

  // Endless 8→2: a real leader counts down to the first frame, and this one
  // has no first frame to reach. Looping is the honest shape for a wait of
  // unknown length.
  const CYCLE = 7
  const phase = ((time % CYCLE) + CYCLE) % CYCLE
  const label = Math.max(2, 8 - Math.floor(phase))

  const wash = c.createLinearGradient(0, top, 0, bottom)
  wash.addColorStop(0, "#fbfbfd")
  wash.addColorStop(0.55, "#f4f4f6")
  wash.addColorStop(1, "#f8f8fa")
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.fillStyle = wash
  c.fillRect(0, 0, width, height)

  // Sprocket holes, sliding — the only part that says "running", not "stuck".
  c.fillStyle = INK(0.13)
  const pitch = frameHeight / 9
  const offset = (time * pitch * 2.4) % pitch
  const perfWidth = width * 0.011
  const perfHeight = pitch * 0.34
  for (let y = top - pitch + offset; y < bottom + pitch; y += pitch) {
    c.fillRect(width * 0.022, y, perfWidth, perfHeight)
    c.fillRect(width - width * 0.022 - perfWidth, y, perfWidth, perfHeight)
  }

  c.strokeStyle = INK(0.12)
  c.lineWidth = Math.max(1, height * 0.0016)
  c.beginPath()
  c.moveTo(cx, top)
  c.lineTo(cx, bottom)
  c.moveTo(width * 0.06, cy)
  c.lineTo(width * 0.94, cy)
  c.stroke()

  c.strokeStyle = INK(0.22)
  for (const corner of ["tl", "tr", "bl", "br"]) {
    const x = corner.endsWith("l") ? width * 0.085 : width * 0.915
    const y = corner.startsWith("t") ? top + frameHeight * 0.16 : bottom - frameHeight * 0.16
    registrationMark(c, x, y, height * 0.024)
  }

  c.strokeStyle = INK(0.38)
  c.lineWidth = Math.max(1.4, height * 0.0032)
  c.beginPath()
  c.arc(cx, cy, radius, 0, Math.PI * 2)
  c.stroke()
  c.strokeStyle = INK(0.18)
  c.beginPath()
  c.arc(cx, cy, radius * 0.845, 0, Math.PI * 2)
  c.stroke()

  const sweep = (phase % 1) * Math.PI * 2
  const start = -Math.PI / 2
  c.fillStyle = INK(0.055)
  c.beginPath()
  c.moveTo(cx, cy)
  c.arc(cx, cy, radius, start, start + sweep)
  c.closePath()
  c.fill()
  c.strokeStyle = INK(0.55)
  c.lineWidth = Math.max(1.2, height * 0.0026)
  c.beginPath()
  c.moveTo(cx, cy)
  c.lineTo(cx + Math.cos(start + sweep) * radius, cy + Math.sin(start + sweep) * radius)
  c.stroke()

  c.strokeStyle = INK(0.28)
  c.lineWidth = Math.max(1, height * 0.002)
  for (let tick = 0; tick < 12; tick += 1) {
    const angle = start + (tick / 12) * Math.PI * 2
    const inner = tick % 3 === 0 ? radius * 1.055 : radius * 1.028
    c.beginPath()
    c.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
    c.lineTo(cx + Math.cos(angle) * radius * 1.1, cy + Math.sin(angle) * radius * 1.1)
    c.stroke()
  }

  c.textAlign = "center"
  c.textBaseline = "middle"
  c.shadowColor = INK(0.22)
  c.shadowBlur = height * 0.02
  c.fillStyle = "#141417"
  c.font = `700 ${(radius * 1.28).toFixed(2)}px "Helvetica Neue", Inter, Helvetica, Arial, sans-serif`
  c.fillText(String(label), cx, cy + radius * 0.02)
  c.shadowBlur = 0

  const frames = Math.floor(time * 24)
  c.font = `500 ${(height * 0.0255).toFixed(2)}px ${MONO_STACK}`
  c.textBaseline = "middle"
  c.textAlign = "right"
  c.fillStyle = INK(0.55)
  c.fillText(
    `01:${pad((frames / 1440) % 60)}:${pad((frames / 24) % 60)}:${pad(frames % 24)}`,
    width * 0.945,
    top + frameHeight * 0.055,
  )

  c.fillStyle = "#ffffff"
  c.fillRect(0, 0, width, bar)
  c.fillRect(0, bottom, width, bar + 1)
}

export function FilmLeader({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getContext("2d")
    if (!c) return

    // Reduced motion is honoured everywhere: paint one still frame and stop.
    // The leader is information ("we are reading this"), so it stays on
    // screen — it simply does not animate.
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    const density = Math.min(window.devicePixelRatio || 1, 2)
    let frame = 0
    const started = performance.now()

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * density))
      canvas.height = Math.max(1, Math.round(rect.height * density))
      if (still) paintLeader(c, canvas.width, canvas.height, 2.4)
    }

    const tick = (now: number) => {
      paintLeader(c, canvas.width, canvas.height, (now - started) / 1000)
      frame = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener("resize", resize)
    if (!still) frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <div className={`relative overflow-hidden bg-[#f6f6f8] ${className ?? ""}`} data-testid="film-leader">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Scanlines and a corner falloff, so it reads as projected rather
          than drawn. Pointer-events off: it is scenery over a live card. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.035) 0px, rgba(0,0,0,0.035) 1px, transparent 1px, transparent 3px), radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.06) 100%)",
        }}
      />
    </div>
  )
}
