// components/MiniFrog.tsx
"use client"

import { useEffect, useRef } from "react"
import clsx from "clsx"

type MiniFrogProps = {
  width?: number
  height?: number
  /** Base animation speed multiplier */
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
  const spinRef = useRef(0) // radians to spin down

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext("2d", { alpha: true })
      if (!ctx) throw new Error("no 2d ctx")
    } catch {
      onError?.()
      return
    }

    // DPR sizing
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

    // pause/resume
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

    const triggerSpinIfSecret = () => {
      clickCountRef.current += 1
      if (clickCountRef.current >= 10) {
        // quick celebratory spin (~1.25 turns)
        spinRef.current = Math.PI * 2 * 1.25
        clickCountRef.current = 0
      }
    }

    const onPointerDown = () => {
      const now = performance.now()
      if (now - lastTapRef.current < 300) {
        // double tap
        jump()
      } else {
        wink()
        triggerSpinIfSecret()
      }
      lastTapRef.current = now
    }
    const onDblClick = () => {
      jump()
      triggerSpinIfSecret()
    }
    const onPointerEnter = () => wink()

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("dblclick", onDblClick)
    canvas.addEventListener("pointerenter", onPointerEnter)

    // drawing
    const draw = (t: number) => {
      const w = width
      const h = height
      ctx!.clearRect(0, 0, w, h)

      // KEEP BACKGROUND CONTAINED: draw only inside canvas (no external bleed)
      // Soft dark card backdrop (matches site but with contrast)
      const cardBG = ctx!.createLinearGradient(0, 0, 0, h)
      cardBG.addColorStop(0, "#0b1220")
      cardBG.addColorStop(1, "#0f172a")
      ctx!.fillStyle = cardBG
      ctx!.fillRect(0, 0, w, h)

      // subtle inner glows (violet/cyan) – kept soft to avoid “encroaching” look
      const glowV = ctx!.createRadialGradient(w * 0.18, h * 0.1, 12, w * 0.18, h * 0.1, h * 0.9)
      glowV.addColorStop(0, "rgba(124,58,237,0.22)")
      glowV.addColorStop(1, "rgba(124,58,237,0)")
      ctx!.fillStyle = glowV
      ctx!.fillRect(0, 0, w, h)

      const glowC = ctx!.createRadialGradient(w * 0.82, h * 0.05, 12, w * 0.82, h * 0.05, h * 0.9)
      glowC.addColorStop(0, "rgba(14,165,233,0.20)")
      glowC.addColorStop(1, "rgba(14,165,233,0)")
      ctx!.fillStyle = glowC
      ctx!.fillRect(0, 0, w, h)

      // pronounced bounce
      const baseAmp = reduceMotion ? 2 : 6 // bigger than before
      const jumpAmp = jumpBoostRef.current * 22
      const amp = baseAmp + jumpAmp
      const phase = t * (2.1 * speed)
      const y = h * 0.54 + Math.sin(phase) * amp

      // spin easter egg (decays over time)
      let spinAngle = 0
      if (spinRef.current > 0) {
        spinAngle = spinRef.current
        // ease out the spin: subtract a little each frame
        spinRef.current = Math.max(0, spinRef.current - 0.22)
      }

      // shadow stretches a bit on jump
      ctx!.fillStyle = "rgba(0,0,0,0.28)"
      ctx!.beginPath()
      ctx!.ellipse(w / 2, h * 0.86, 66 + jumpAmp * 0.5, 12 + jumpAmp * 0.25, 0, 0, Math.PI * 2)
      ctx!.fill()

      // ------- Frog (Toby) -------
      // Draw the frog in its own local transform so we can spin without moving background
      ctx!.save()
      ctx!.translate(w / 2, y)
      if (spinAngle) ctx!.rotate(spinAngle)

      const outline = "#0a0a0a"
      ctx!.lineWidth = 4
      ctx!.strokeStyle = outline

      // body (chunky)
      const bodyGrad = ctx!.createLinearGradient(0, -20, 0, 80)
      bodyGrad.addColorStop(0, "#35e0b9") // teal
      bodyGrad.addColorStop(1, "#16a34a") // green
      ctx!.fillStyle = bodyGrad
      ctx!.beginPath()
      ctx!.ellipse(0, 18, 86, 64, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()

      // head (round, a bit wider – Toby vibe)
      const headGrad = ctx!.createLinearGradient(0, -80, 0, -10)
      headGrad.addColorStop(0, "#3be7a7")
      headGrad.addColorStop(1, "#12b981")
      ctx!.fillStyle = headGrad
      ctx!.beginPath()
      ctx!.ellipse(0, -26, 78, 56, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()

      // belly
      ctx!.fillStyle = "#f5efe6"
      ctx!.beginPath()
      ctx!.ellipse(0, 28, 52, 38, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.stroke()

      // little hands
      ctx!.fillStyle = "#14b86f"
      ctx!.beginPath()
      ctx!.ellipse(-68, 10, 16, 9, 0.4, 0, Math.PI * 2)
      ctx!.fill(); ctx!.stroke()
      ctx!.beginPath()
      ctx!.ellipse(68, 10, 16, 9, -0.4, 0, Math.PI * 2)
      ctx!.fill(); ctx!.stroke()

      // feet
      ctx!.beginPath()
      ctx!.ellipse(-38, 70, 20, 9, 0.1, 0, Math.PI * 2)
      ctx!.fill(); ctx!.stroke()
      ctx!.beginPath()
      ctx!.ellipse(38, 70, 20, 9, -0.1, 0, Math.PI * 2)
      ctx!.fill(); ctx!.stroke()

      // cheeks
      ctx!.fillStyle = "rgba(244,114,182,0.45)"
      ctx!.beginPath()
      ctx!.ellipse(-36, -10, 11, 8, 0, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.beginPath()
      ctx!.ellipse(36, -10, 11, 8, 0, 0, Math.PI * 2)
      ctx!.fill()

      // eyes (wink)
      const winking = winkFramesRef.current > 0
      ctx!.fillStyle = outline
      const eyeY = -32
      if (winking) {
        ctx!.lineWidth = 3
        ctx!.beginPath()
        ctx!.moveTo(-30 - 8, eyeY)
        ctx!.lineTo(-30 + 8, eyeY)
        ctx!.stroke()
      } else {
        ctx!.beginPath()
        ctx!.arc(-30, eyeY, 8.2, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.beginPath()
      ctx!.arc(30, eyeY, 8.2, 0, Math.PI * 2)
      ctx!.fill()
      // shiny pupils
      ctx!.fillStyle = "#ffffff"
      if (!winking) {
        ctx!.beginPath()
        ctx!.arc(-33, eyeY - 2.5, 2.2, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.beginPath()
      ctx!.arc(27, eyeY - 2.5, 2.2, 0, Math.PI * 2)
      ctx!.fill()

      // smile (slightly wider)
      ctx!.strokeStyle = outline
      ctx!.lineWidth = 3
      ctx!.beginPath()
      ctx!.arc(0, -6, 18, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx!.stroke()

      ctx!.restore()

      // subtle sparkle particles
      if (!reduceMotion) {
        ctx!.fillStyle = "rgba(124,58,237,0.22)"
        for (let i = 0; i < 10; i++) {
          const px = (i * 67 + t * 30) % (w + 30) - 15
          const py = 16 + ((i * 39) % (h * 0.42))
          ctx!.beginPath()
          ctx!.arc(px, py, 1.6, 0, Math.PI * 2)
          ctx!.fill()
        }
      }
    }

    const loop = (ts: number) => {
      if (startRef.current == null) startRef.current = ts
      const elapsed = (ts - startRef.current) / 1000

      if (winkFramesRef.current > 0) winkFramesRef.current -= 1
      if (jumpBoostRef.current > 0) jumpBoostRef.current = Math.max(0, jumpBoostRef.current - 0.05)

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
        // premium card frame: strong contrast, rounded, hover edge glow
        "rounded-3xl border-2 border-black shadow-[0_10px_0_#000] overflow-hidden",
        "transition-shadow duration-150",
        "hover:shadow-[0_10px_0_#000,0_0_0_2px_rgba(255,255,255,0.18),0_0_40px_rgba(121,255,225,0.15)]",
        // slight glassy top to contrast the canvas bg
        "bg-[radial-gradient(60%_140%_at_12%_-10%,rgba(124,58,237,.18),transparent),radial-gradient(60%_140%_at_88%_-10%,rgba(14,165,233,.15),transparent),linear-gradient(180deg,#0a0f1c,#0a0b12)]",
        className
      )}
      style={{ width, height }}
      role="img"
      aria-label="Animated Toby frog bouncing; tap to wink, double-tap to jump"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  )
}
