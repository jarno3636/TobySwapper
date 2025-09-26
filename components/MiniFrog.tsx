// components/MiniFrog.tsx
"use client"

import { useEffect, useRef } from "react"
import clsx from "clsx"

type MiniFrogProps = {
  /** CSS px (logical) — component takes care of DPR scaling */
  width?: number
  height?: number
  /** Multiplier for bounce/animation speed */
  speed?: number
  /** Extra classNames for outer wrapper */
  className?: string
  /** Called if canvas init fails */
  onError?: () => void
}

/**
 * Premium mini canvas mascot:
 * - DPR-safe rendering (crisp on retina)
 * - Respects `prefers-reduced-motion`
 * - Pauses when tab hidden; resumes when visible
 * - Wink on hover/click
 * - Subtle shadow + glass card styling to match your theme
 */
export default function MiniFrog({
  width = 340,
  height = 220,
  speed = 1,
  className,
  onError,
}: MiniFrogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const winkRef = useRef(0) // frames of wink left
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Get 2D context
    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext("2d", { alpha: true })
      if (!ctx) throw new Error("no 2d ctx")
    } catch {
      onError?.()
      return
    }

    // DPR-safe sizing helper
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      // set internal buffer size
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      // set CSS size
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      // reset transform before scaling to avoid compounding
      ctx!.setTransform(1, 0, 0, 1, 0, 0)
      ctx!.scale(dpr, dpr)
    }

    resize()
    const onResize = () => resize()
    window.addEventListener("resize", onResize)

    // Pause/resume on tab visibility
    const onVis = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      } else {
        startRef.current = null
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    document.addEventListener("visibilitychange", onVis)

    // Interactivity: wink on hover/click
    const onWink = () => {
      winkRef.current = 22 // ~ short wink
    }
    canvas.addEventListener("pointerenter", onWink)
    canvas.addEventListener("click", onWink)

    // ---- Drawing ----
    const drawFrog = (time: number) => {
      const w = width
      const h = height
      const bounce = Math.sin(time * 1.8 * speed) * (reduceMotion ? 1 : 4)
      const y = h * 0.45 + bounce

      // BG gradient
      const g = ctx!.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, "rgba(255,255,255,0.85)")
      g.addColorStop(1, "rgba(245,240,255,0.92)")
      ctx!.fillStyle = g
      ctx!.fillRect(0, 0, w, h)

      // shadow
      ctx!.fillStyle = "rgba(0,0,0,.22)"
      ctx!.beginPath()
      ctx!.ellipse(w / 2, h * 0.78, 60, 14, 0, 0, Math.PI * 2)
      ctx!.fill()

      // body
      ctx!.fillStyle = "#1f6aa3" // blue frog
      ctx!.strokeStyle = "#0a0a0a"
      ctx!.lineWidth = 4
      ctx!.beginPath()
      ctx!.ellipse(w / 2, y, 75, 55, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()

      // belly
      ctx!.fillStyle = "#f5efe3"
      ctx!.beginPath()
      ctx!.ellipse(w / 2, y + 5, 46, 34, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()

      // eyes (wink logic)
      const winking = winkRef.current > 0
      const eyeR = 8
      ctx!.fillStyle = "#0a0a0a"
      if (winking) {
        // left eye closed
        ctx!.lineWidth = 3
        ctx!.beginPath()
        ctx!.moveTo(w / 2 - 38, y - 40)
        ctx!.lineTo(w / 2 - 22, y - 40)
        ctx!.stroke()
      } else {
        ctx!.beginPath()
        ctx!.arc(w / 2 - 30, y - 40, eyeR, 0, Math.PI * 2)
        ctx!.fill()
      }
      // right eye (always open)
      ctx!.beginPath()
      ctx!.arc(w / 2 + 30, y - 40, eyeR, 0, Math.PI * 2)
      ctx!.fill()

      // smile
      ctx!.lineWidth = 3
      ctx!.beginPath()
      ctx!.arc(w / 2, y - 18, 18, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx!.stroke()

      // subtle sparkles
      if (!reduceMotion) {
        ctx!.fillStyle = "rgba(124,58,237,.28)"
        for (let i = 0; i < 6; i++) {
          const px = (i * 57 + time * 28) % (w + 40) - 20
          const py = 30 + ((i * 33) % (h * 0.35))
          ctx!.beginPath()
          ctx!.arc(px, py, 1.7, 0, Math.PI * 2)
          ctx!.fill()
        }
      }
    }

    const loop = (ts: number) => {
      if (startRef.current == null) startRef.current = ts
      const elapsed = (ts - startRef.current) / 1000 // seconds

      // Clear per frame
      ctx!.clearRect(0, 0, width, height)
      drawFrog(elapsed)

      // decay wink
      if (winkRef.current > 0) winkRef.current -= 1

      if (!reduceMotion && !document.hidden) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    if (reduceMotion) {
      // draw a single static frame
      drawFrog(0)
    } else {
      rafRef.current = requestAnimationFrame(loop)
    }

    // Cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVis)
      canvas.removeEventListener("pointerenter", onWink)
      canvas.removeEventListener("click", onWink)
    }
  }, [width, height, speed, onError])

  return (
    <div
      className={clsx(
        // matches your “cel-card” vibe but lighter; override easily
        "rounded-2xl border-2 border-black shadow-[0_8px_0_#000] overflow-hidden",
        "bg-white",
        className
      )}
      style={{
        width,
        height,
      }}
      role="img"
      aria-label="Animated Toby frog mascot bouncing happily"
    >
      <canvas
        ref={canvasRef}
        // keep a neutral background so it blends in even if not drawn yet
        className="block w-full h-full"
      />
    </div>
  )
}
