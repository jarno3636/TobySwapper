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
  width = 340,
  height = 220,
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
    if (!ctx) { onError?.(); return }

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
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    resize()
    const onResize = () => resize()
    window.addEventListener("resize", onResize)

    // pause/resume on tab visibility
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

    // interactions
    const wink = () => { winkFramesRef.current = 22 }
    const jump = () => { jumpBoostRef.current = 1 }
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
    const onDblClick = () => { jump(); secret() }
    const onPointerEnter = () => wink()

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("dblclick", onDblClick)
    canvas.addEventListener("pointerenter", onPointerEnter)

    // colors to match reference
    const BLUE = "#1e5f85"    // Toby blue
    const BLUE_DARK = "#15465f"
    const BELLY = "#eee7dc"
    const OUTLINE = "#0b0b0b"

    function drawFrog(t: number) {
      const w = width
      const h = height

      // background (contained, premium, matches site)
      const vignette = ctx.createRadialGradient(w * 0.5, h * 0.45, 30, w * 0.5, h * 0.45, Math.max(w, h))
      vignette.addColorStop(0, "#0b1220")
      vignette.addColorStop(1, "#070a12")
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, w, h)

      // soft cyan/violet inner glow (very subtle)
      const glowA = ctx.createRadialGradient(w * 0.18, h * 0.1, 5, w * 0.18, h * 0.1, h * 0.9)
      glowA.addColorStop(0, "rgba(124,58,237,0.18)")
      glowA.addColorStop(1, "rgba(124,58,237,0)")
      ctx.fillStyle = glowA; ctx.fillRect(0, 0, w, h)
      const glowB = ctx.createRadialGradient(w * 0.82, h * 0.05, 5, w * 0.82, h * 0.05, h * 0.9)
      glowB.addColorStop(0, "rgba(14,165,233,0.16)")
      glowB.addColorStop(1, "rgba(14,165,233,0)")
      ctx.fillStyle = glowB; ctx.fillRect(0, 0, w, h)

      // bounce / jump
      const baseAmp = reduceMotion ? 2 : 7
      const jumpAmp = jumpBoostRef.current * 24
      const y = h * 0.58 + Math.sin(t * 2.1 * speed) * (baseAmp + jumpAmp)

      // ground shadow
      ctx.fillStyle = "rgba(0,0,0,0.28)"
      ctx.beginPath()
      ctx.ellipse(w / 2, h * 0.89, 72 + jumpAmp * 0.6, 13 + jumpAmp * 0.3, 0, 0, Math.PI * 2)
      ctx.fill()

      // draw frog with its own transform (for spin)
      ctx.save()
      ctx.translate(w / 2, y)
      if (spinRef.current > 0) {
        ctx.rotate(spinRef.current)
        spinRef.current = Math.max(0, spinRef.current - 0.22)
      }

      ctx.lineWidth = 6
      ctx.strokeStyle = OUTLINE

      // ---------- BODY SHAPE (closer to reference) ----------
      // torso (squat)
      const torsoGrad = ctx.createLinearGradient(0, -30, 0, 90)
      torsoGrad.addColorStop(0, BLUE)
      torsoGrad.addColorStop(1, BLUE_DARK)
      ctx.fillStyle = torsoGrad
      ctx.beginPath()
      ctx.moveTo(-85, 35)
      ctx.bezierCurveTo(-95, 5, -70, -30, -40, -40) // left shoulder to head
      ctx.bezierCurveTo(-25, -60, -10, -68, 0, -68) // left head bump approach
      ctx.bezierCurveTo(10, -68, 25, -60, 40, -40)  // right head bump approach
      ctx.bezierCurveTo(70, -30, 95, 5, 85, 35)     // right shoulder down
      ctx.bezierCurveTo(88, 80, -88, 80, -85, 35)   // bottom arc back to start
      ctx.closePath()
      ctx.fill(); ctx.stroke()

      // belly (cream oval with outline)
      ctx.fillStyle = BELLY
      ctx.beginPath()
      ctx.ellipse(0, 28, 54, 42, 0, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()

      // thighs (side lobes)
      ctx.fillStyle = BLUE
      ctx.beginPath() // left thigh
      ctx.ellipse(-60, 38, 26, 34, 0.12, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      ctx.beginPath() // right thigh
      ctx.ellipse(60, 38, 26, 34, -0.12, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()

      // arms (small inner arcs)
      ctx.beginPath()
      ctx.moveTo(-30, 18); ctx.lineTo(-38, 58); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(30, 18); ctx.lineTo(38, 58); ctx.stroke()

      // feet / toes (cartoony)
      const drawFoot = (xSign: number) => {
        ctx.beginPath()
        ctx.ellipse(30 * xSign, 70, 22, 10, 0, 0, Math.PI * 2)
        ctx.fillStyle = BLUE; ctx.fill(); ctx.stroke()
        // three toes
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath()
          ctx.ellipse((30 + i * 10) * xSign, 80, 6.5, 4.2, 0, 0, Math.PI * 2)
          ctx.fillStyle = BLUE; ctx.fill(); ctx.stroke()
        }
      }
      drawFoot(-1)
      drawFoot(1)

      // ---------- FACE ----------
      // head bumps (circles behind eyes to suggest silhouette)
      ctx.beginPath()
      ctx.arc(-40, -54, 22, 0, Math.PI * 2)
      ctx.fillStyle = BLUE; ctx.fill(); ctx.stroke()
      ctx.beginPath()
      ctx.arc(40, -54, 22, 0, Math.PI * 2)
      ctx.fillStyle = BLUE; ctx.fill(); ctx.stroke()

      // eyes
      const eyeOpen = (x: number) => {
        ctx.fillStyle = "#000"
        ctx.beginPath(); ctx.arc(x, -54, 10, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = "#fff"
        ctx.beginPath(); ctx.arc(x - 3, -57, 3.2, 0, Math.PI * 2); ctx.fill()
      }
      const winking = winkFramesRef.current > 0
      if (winking) {
        ctx.strokeStyle = "#000"; ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(-52, -54); ctx.lineTo(-28, -54); ctx.stroke()
      } else {
        eyeOpen(-40)
      }
      eyeOpen(40)

      // nostrils
      ctx.fillStyle = "#000"
      ctx.beginPath(); ctx.arc(-8, -38, 2.2, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(8, -38, 2.2, 0, Math.PI * 2); ctx.fill()

      // smile – long, thick
      ctx.strokeStyle = "#000"; ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(-45, -28)
      ctx.bezierCurveTo(-25, -10, 25, -10, 45, -28)
      ctx.stroke()

      ctx.restore()

      // sparkles (subtle)
      if (!reduceMotion) {
        ctx.fillStyle = "rgba(121,255,225,0.18)"
        for (let i = 0; i < 10; i++) {
          const px = (i * 61 + t * 26) % (w + 30) - 15
          const py = 12 + ((i * 37) % (h * 0.42))
          ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    const loop = (ts: number) => {
      if (startRef.current == null) startRef.current = ts
      const elapsed = (ts - startRef.current) / 1000

      if (winkFramesRef.current > 0) winkFramesRef.current -= 1
      if (jumpBoostRef.current > 0) jumpBoostRef.current = Math.max(0, jumpBoostRef.current - 0.05)

      drawFrog(elapsed)
      if (!reduceMotion && !document.hidden) rafRef.current = requestAnimationFrame(loop)
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
        "transition-shadow duration-150",
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
