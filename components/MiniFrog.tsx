// components/MiniFrog.tsx
"use client"

import { useEffect, useRef } from "react"
import clsx from "clsx"

type MiniFrogProps = {
  /** CSS px (logical) — component takes care of DPR scaling */
  width?: number
  height?: number
  /** Multiplier for base bounce/animation speed */
  speed?: number
  /** Extra classNames for outer wrapper */
  className?: string
  /** Called if canvas init fails */
  onError?: () => void
}

/**
 * Premium mini canvas mascot — Toby Frog
 * - Dark, on-brand gradient background
 * - Tap/Click = wink; Double-tap/Double-click = jump (bigger bounce)
 * - DPR crisp, respects prefers-reduced-motion, pauses when hidden
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
  const startRef = useRef<number | null>(null)

  // interaction state
  const winkFramesRef = useRef(0)
  const jumpBoostRef = useRef(0)       // extra bounce during jump
  const lastTapRef = useRef<number>(0) // for double-tap detection

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext("2d", { alpha: true })
      if (!ctx) throw new Error("no 2d ctx")
    } catch {
      onError?.()
      return
    }

    // DPR-safe sizing
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
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

    // Interactions
    const wink = () => { winkFramesRef.current = 20 }
    const jump = () => { jumpBoostRef.current = 1 } // decay in loop

    // Double-tap (touch or mouse)
    const onPointerDown = () => {
      const now = performance.now()
      if (now - lastTapRef.current < 300) {
        jump()
      } else {
        wink()
      }
      lastTapRef.current = now
    }
    // Desktop dblclick as well
    const onDblClick = () => jump()
    // Friendly hover wink
    const onPointerEnter = () => wink()

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("dblclick", onDblClick)
    canvas.addEventListener("pointerenter", onPointerEnter)

    // ---- Drawing ----
    const draw = (t: number) => {
      const w = width
      const h = height
      ctx!.clearRect(0, 0, w, h)

      /* Background: night cyan/violet gradients to match app */
      const bg = ctx!.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, "#0b1020")
      bg.addColorStop(1, "#0a0f1c")
      ctx!.fillStyle = bg
      ctx!.fillRect(0, 0, w, h)

      const r1 = ctx!.createRadialGradient(w * 0.08, h * -0.1, 20, w * 0.08, h * -0.1, h * 0.9)
      r1.addColorStop(0, "rgba(124,58,237,0.36)")
      r1.addColorStop(1, "rgba(124,58,237,0)")
      ctx!.fillStyle = r1
      ctx!.fillRect(0, 0, w, h)

      const r2 = ctx!.createRadialGradient(w * 0.92, h * 0.1, 20, w * 0.92, h * 0.1, h * 0.9)
      r2.addColorStop(0, "rgba(14,165,233,0.34)")
      r2.addColorStop(1, "rgba(14,165,233,0)")
      ctx!.fillStyle = r2
      ctx!.fillRect(0, 0, w, h)

      // Bounce
      const baseAmp = reduceMotion ? 1.5 : 4
      const jumpAmp = jumpBoostRef.current * 18
      const amp = baseAmp + jumpAmp
      const y = h * 0.5 + Math.sin(t * (1.9 * speed)) * amp

      // shadow
      ctx!.fillStyle = "rgba(0,0,0,0.24)"
      ctx!.beginPath()
      ctx!.ellipse(w / 2, h * 0.83, 62, 12 + (jumpAmp > 0 ? 5 : 0), 0, 0, Math.PI * 2)
      ctx!.fill()

      // FROG BODY (friendly green with cream belly)
      const outline = "#0a0a0a"
      ctx!.lineWidth = 4
      ctx!.strokeStyle = outline

      // body
      const bodyGrad = ctx!.createLinearGradient(0, y - 60, 0, y + 60)
      bodyGrad.addColorStop(0, "#2dd4bf") // teal top
      bodyGrad.addColorStop(1, "#16a34a") // green bottom
      ctx!.fillStyle = bodyGrad
      ctx!.beginPath()
      ctx!.ellipse(w / 2, y + 10, 80, 58, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()

      // head (slightly smaller, on top)
      const headGrad = ctx!.createLinearGradient(0, y - 60, 0, y + 20)
      headGrad.addColorStop(0, "#34d399")
      headGrad.addColorStop(1, "#10b981")
      ctx!.fillStyle = headGrad
      ctx!.beginPath()
      ctx!.ellipse(w / 2, y - 22, 70, 48, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()

      // belly
      ctx!.fillStyle = "#f4efe6"
      ctx!.beginPath()
      ctx!.ellipse(w / 2, y + 18, 45, 34, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()

      // simple arms (little ovals) + feet
      ctx!.fillStyle = "#0ea766"
      // left arm
      ctx!.beginPath()
      ctx!.ellipse(w / 2 - 58, y + 10, 14, 8, 0.5, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()
      // right arm
      ctx!.beginPath()
      ctx!.ellipse(w / 2 + 58, y + 10, 14, 8, -0.5, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()
      // feet
      ctx!.beginPath()
      ctx!.ellipse(w / 2 - 35, y + 56, 18, 8, 0.1, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()
      ctx!.beginPath()
      ctx!.ellipse(w / 2 + 35, y + 56, 18, 8, -0.1, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()

      // cheeks
      ctx!.fillStyle = "rgba(244,114,182,0.35)" // pink
      ctx!.beginPath()
      ctx!.ellipse(w / 2 - 32, y - 16, 10, 7, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.beginPath()
      ctx!.ellipse(w / 2 + 32, y - 16, 10, 7, 0, 0, Math.PI * 2)
      ctx!.fill()

      // eyes (with wink)
      const winking = winkFramesRef.current > 0
      const eyeY = y - 32
      ctx!.fillStyle = outline
      if (winking) {
        ctx!.lineWidth = 3
        ctx!.beginPath()
        ctx!.moveTo(w / 2 - 28 - 7, eyeY)
        ctx!.lineTo(w / 2 - 28 + 7, eyeY)
        ctx!.stroke()
      } else {
        ctx!.beginPath()
        ctx!.arc(w / 2 - 28, eyeY, 7, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.beginPath()
      ctx!.arc(w / 2 + 28, eyeY, 7, 0, Math.PI * 2)
      ctx!.fill()

      // tiny pupils (gives friendliness)
      ctx!.fillStyle = "#ffffff"
      if (!winking) {
        ctx!.beginPath()
        ctx!.arc(w / 2 - 31, eyeY - 2, 2, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.beginPath()
      ctx!.arc(w / 2 + 25, eyeY - 2, 2, 0, Math.PI * 2)
      ctx!.fill()

      // smile
      ctx!.strokeStyle = outline
      ctx!.lineWidth = 3
      ctx!.beginPath()
      ctx!.arc(w / 2, y - 10, 16, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx!.stroke()

      // subtle sparkle particles
      if (!reduceMotion) {
        ctx!.fillStyle = "rgba(124,58,237,.28)"
        for (let i = 0; i < 8; i++) {
          const px = (i * 63 + t * 26) % (w + 40) - 20
          const py = 20 + ((i * 34) % (h * 0.38))
          ctx!.beginPath()
          ctx!.arc(px, py, 1.5, 0, Math.PI * 2)
          ctx!.fill()
        }
      }
    }

    const loop = (ts: number) => {
      if (startRef.current == null) startRef.current = ts
      const elapsed = (ts - startRef.current) / 1000

      // decay interactions
      if (winkFramesRef.current > 0) winkFramesRef.current -= 1
      if (jumpBoostRef.current > 0) jumpBoostRef.current = Math.max(0, jumpBoostRef.current - 0.045)

      draw(elapsed)
      if (!reduceMotion && !document.hidden) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    if (reduceMotion) {
      draw(0)
    } else {
      rafRef.current = requestAnimationFrame(loop)
    }

    // Cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVis)
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("dblclick", onDblClick)
      canvas.removeEventListener("pointerenter", onPointerEnter)
    }
  }, [width, height, speed, onError])

  return (
    <div
      className={clsx(
        "rounded-2xl border-2 border-black shadow-[0_8px_0_#000] overflow-hidden",
        // card frame with on-brand night gradient/glass vibe
        "bg-[radial-gradient(60%_140%_at_12%_-10%,rgba(124,58,237,.22),transparent),radial-gradient(60%_140%_at_88%_-10%,rgba(14,165,233,.20),transparent),linear-gradient(180deg,#0b1220,#0f172a)]",
        className
      )}
      style={{ width, height }}
      role="img"
      aria-label="Animated Toby frog mascot bouncing"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  )
}
