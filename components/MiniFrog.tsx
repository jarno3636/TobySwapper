// components/MiniFrog.tsx
"use client"

import { useEffect, useRef } from "react"
import clsx from "clsx"

type MiniFrogProps = {
  width?: number
  height?: number
  speed?: number
  className?: string
  onError?: () => void
}

export default function MiniFrog({
  width = 360,
  height = 260,
  speed = 1,
  className,
  onError,
}: MiniFrogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  // interactions
  const winkFramesRef = useRef(0)
  const jumpBoostRef = useRef(0)
  const lastTapRef = useRef(0)
  const clickCountRef = useRef(0)
  const spinRef = useRef(0) // radians remaining

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) {
      onError?.()
      return
    }
    const context: CanvasRenderingContext2D = ctx

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    // DPR-safe sizing
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.scale(dpr, dpr)
    }
    resize()
    const onResize = () => resize()
    window.addEventListener("resize", onResize)

    // pause/resume on tab visibility
    const onVis = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current!)
        rafRef.current = null
      } else {
        startRef.current = null
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    document.addEventListener("visibilitychange", onVis)

    // interactions
    const wink = () => (winkFramesRef.current = 22)
    const jump = () => (jumpBoostRef.current = 1)
    const secret = () => {
      clickCountRef.current += 1
      if (clickCountRef.current >= 10) {
        spinRef.current = Math.PI * 2 * 1.25 // ~1.25 spins
        clickCountRef.current = 0
      }
    }

    const onPointerDown = () => {
      const now = performance.now()
      if (now - lastTapRef.current < 300) jump()
      else wink()
      secret()
      lastTapRef.current = now
    }
    const onDblClick = () => {
      jump()
      secret()
    }
    const onPointerEnter = () => wink()

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("dblclick", onDblClick)
    canvas.addEventListener("pointerenter", onPointerEnter)

    // palette
    const BLUE = "#1e5f85"
    const BLUE_DARK = "#15465f"
    const BELLY = "#eee7dc"
    const OUTLINE = "#0b0b0b"

    function drawFrog(t: number) {
      const w = width
      const h = height

      // contained background (matches app vibe)
      const vignette = context.createRadialGradient(
        w * 0.5,
        h * 0.45,
        30,
        w * 0.5,
        h * 0.45,
        Math.max(w, h)
      )
      vignette.addColorStop(0, "#0b1220")
      vignette.addColorStop(1, "#070a12")
      context.fillStyle = vignette
      context.fillRect(0, 0, w, h)

      // subtle stars
      if (!reduceMotion) {
        context.fillStyle = "rgba(124,58,237,.16)"
        for (let i = 0; i < 10; i++) {
          const px = (i * 63 + t * 25) % (w + 30) - 15
          const py = 10 + ((i * 37) % (h * 0.42))
          context.beginPath()
          context.arc(px, py, 1.5, 0, Math.PI * 2)
          context.fill()
        }
      }

      // bounce / jump amplitude
      const baseAmp = reduceMotion ? 2 : 10
      const jumpAmp = jumpBoostRef.current * 26
      const y = h * 0.58 + Math.sin(t * 2.1 * speed) * (baseAmp + jumpAmp)

      // ground shadow
      context.fillStyle = "rgba(0,0,0,0.28)"
      context.beginPath()
      context.ellipse(w / 2, h * 0.9, 78 + jumpAmp * 0.6, 14 + jumpAmp * 0.3, 0, 0, Math.PI * 2)
      context.fill()

      // draw frog
      context.save()
      context.translate(w / 2, y)
      if (spinRef.current > 0) {
        context.rotate(spinRef.current)
        spinRef.current = Math.max(0, spinRef.current - 0.22)
      }

      context.lineWidth = 6
      context.strokeStyle = OUTLINE

      // torso (squat oval-ish)
      const torsoGrad = context.createLinearGradient(0, -40, 0, 90)
      torsoGrad.addColorStop(0, BLUE)
      torsoGrad.addColorStop(1, BLUE_DARK)
      context.fillStyle = torsoGrad
      context.beginPath()
      context.moveTo(-92, 30)
      context.bezierCurveTo(-100, 0, -70, -40, -35, -55)
      context.quadraticCurveTo(0, -70, 35, -55)
      context.bezierCurveTo(70, -40, 100, 0, 92, 30)
      context.bezierCurveTo(90, 86, -90, 86, -92, 30)
      context.closePath()
      context.fill()
      context.stroke()

      // belly
      context.fillStyle = BELLY
      context.beginPath()
      context.ellipse(0, 28, 58, 44, 0, 0, Math.PI * 2)
      context.fill()
      context.stroke()

      // thighs
      context.fillStyle = BLUE
      context.beginPath()
      context.ellipse(-64, 38, 28, 36, 0.1, 0, Math.PI * 2)
      context.fill()
      context.stroke()
      context.beginPath()
      context.ellipse(64, 38, 28, 36, -0.1, 0, Math.PI * 2)
      context.fill()
      context.stroke()

      // arms
      context.beginPath()
      context.moveTo(-30, 15)
      context.lineTo(-40, 58)
      context.stroke()
      context.beginPath()
      context.moveTo(30, 15)
      context.lineTo(40, 58)
      context.stroke()

      // feet + toes
      const foot = (sx: number) => {
        context.beginPath()
        context.ellipse(32 * sx, 72, 24, 11, 0, 0, Math.PI * 2)
        context.fillStyle = BLUE
        context.fill()
        context.stroke()
        for (let i = -1; i <= 1; i++) {
          context.beginPath()
          context.ellipse((32 + i * 11) * sx, 83, 6.8, 4.4, 0, 0, Math.PI * 2)
          context.fillStyle = BLUE
          context.fill()
          context.stroke()
        }
      }
      foot(-1)
      foot(1)

      // head bumps (behind eyes)
      context.fillStyle = BLUE
      context.beginPath()
      context.arc(-42, -58, 24, 0, Math.PI * 2)
      context.fill()
      context.stroke()
      context.beginPath()
      context.arc(42, -58, 24, 0, Math.PI * 2)
      context.fill()
      context.stroke()

      // eyes
      const wink = winkFramesRef.current > 0
      const eyeOpen = (x: number) => {
        context.fillStyle = "#000"
        context.beginPath()
        context.arc(x, -58, 10.5, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = "#fff"
        context.beginPath()
        context.arc(x - 3, -61, 3.4, 0, Math.PI * 2)
        context.fill()
      }
      if (wink) {
        context.strokeStyle = "#000"
        context.lineWidth = 3
        context.beginPath()
        context.moveTo(-54, -58)
        context.lineTo(-28, -58)
        context.stroke()
      } else {
        eyeOpen(-42)
      }
      eyeOpen(42)

      // nostrils
      context.fillStyle = "#000"
      context.beginPath()
      context.arc(-8, -40, 2.2, 0, Math.PI * 2)
      context.fill()
      context.beginPath()
      context.arc(8, -40, 2.2, 0, Math.PI * 2)
      context.fill()

      // smile
      context.strokeStyle = "#000"
      context.lineWidth = 5
      context.beginPath()
      context.moveTo(-48, -30)
      context.bezierCurveTo(-22, -10, 22, -10, 48, -30)
      context.stroke()

      context.restore()
    }

    const loop = (ts: number) => {
      if (startRef.current == null) startRef.current = ts
      const elapsed = (ts - startRef.current) / 1000

      if (winkFramesRef.current > 0) winkFramesRef.current -= 1
      if (jumpBoostRef.current > 0) {
        jumpBoostRef.current = Math.max(0, jumpBoostRef.current - 0.05)
      }

      drawFrog(elapsed)
      if (!reduceMotion && !document.hidden) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    reduceMotion ? drawFrog(0) : (rafRef.current = requestAnimationFrame(loop))

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
        "rounded-3xl border-2 border-black shadow-[0_10px_0_#000] overflow-hidden",
        "transition-[box-shadow,transform] duration-150",
        "hover:shadow-[0_10px_0_#000,0_0_0_2px_rgba(255,255,255,0.18),0_0_38px_rgba(121,255,225,0.16)]",
        "bg-[radial-gradient(60%_140%_at_12%_-10%,rgba(124,58,237,.14),transparent),radial-gradient(60%_140%_at_88%_-10%,rgba(14,165,233,.12),transparent),linear-gradient(180deg,#0a0f1c,#0a0b12)]",
        className
      )}
      style={{ width, height }}
      role="img"
      aria-label="Toby the blue frog; tap to wink, double-tap to jump; 10 taps to spin"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  )
}
