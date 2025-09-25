// components/MiniFrog.tsx
"use client"

import { useEffect, useRef } from "react"

export default function MiniFrog({ onError }: { onError?: () => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    try {
      const c = ref.current!
      const ctx = c.getContext("2d")!
      let raf = 0
      let t = 0

      function draw() {
        t += 0.02
        const w = c.width, h = c.height
        ctx.clearRect(0, 0, w, h)

        // shadow
        ctx.fillStyle = "rgba(0,0,0,.25)"
        ctx.beginPath()
        ctx.ellipse(w/2, h*0.78, 60, 14, 0, 0, Math.PI*2)
        ctx.fill()

        // frog body bounce
        const bounce = Math.sin(t) * 4
        const y = h*0.45 + bounce

        // body
        ctx.fillStyle = "#1f6aa3"
        ctx.strokeStyle = "#0a0a0a"
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.ellipse(w/2, y, 75, 55, 0, 0, Math.PI*2)
        ctx.fill(); ctx.stroke()

        // belly
        ctx.fillStyle = "#f5efe3"
        ctx.beginPath()
        ctx.ellipse(w/2, y+5, 46, 34, 0, 0, Math.PI*2)
        ctx.fill(); ctx.stroke()

        // eyes
        ctx.fillStyle = "#0a0a0a"
        ctx.beginPath(); ctx.arc(w/2-30, y-40, 8, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.arc(w/2+30, y-40, 8, 0, Math.PI*2); ctx.fill()

        // smile
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.arc(w/2, y-18, 18, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke()

        raf = requestAnimationFrame(draw)
      }

      const dpr = Math.max(1, window.devicePixelRatio || 1)
      const resize = () => {
        const W = 340, H = 220
        c.width = W * dpr; c.height = H * dpr
        c.style.width = W + "px"; c.style.height = H + "px"
        ctx.scale(dpr, dpr)
      }
      resize()
      raf = requestAnimationFrame(draw)
      return () => cancelAnimationFrame(raf)
    } catch {
      onError?.()
    }
  }, [onError])

  return <canvas ref={ref} className="rounded-2xl border-2 border-black bg-white/90 shadow-[0_8px_0_#000]" />
}
