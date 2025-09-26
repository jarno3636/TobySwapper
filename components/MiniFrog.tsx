// components/MiniFrog.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import clsx from "clsx"

type MiniFrogProps = {
  width?: number
  height?: number
  className?: string
  /** optional: how “strong” the jump feels (1–2.5). default 1.6 */
  intensity?: number
}

export default function MiniFrog({
  width = 360,
  height = 260,
  className,
  intensity = 1.6,
}: MiniFrogProps) {
  const [winkOn, setWinkOn] = useState(false)
  const [jumpOn, setJumpOn] = useState(false)
  const [spinOn, setSpinOn] = useState(false)
  const tapCount = useRef(0)
  const lastTap = useRef(0)

  // secret: 10 taps => spin
  useEffect(() => {
    if (!spinOn) return
    const t = setTimeout(() => setSpinOn(false), 1400)
    return () => clearTimeout(t)
  }, [spinOn])

  const handlePointerDown = () => {
    const now = performance.now()
    // quick double-tap = jump
    if (now - lastTap.current < 300) {
      setJumpOn(true)
      // stop jump class after animation
      setTimeout(() => setJumpOn(false), 650)
    } else {
      // single tap = wink
      setWinkOn(true)
      setTimeout(() => setWinkOn(false), 250)
    }

    // secret spin counter
    tapCount.current += 1
    if (tapCount.current >= 10) {
      tapCount.current = 0
      setSpinOn(true)
    }
    lastTap.current = now
  }

  return (
    <figure
      onPointerDown={handlePointerDown}
      className={clsx(
        // premium outer card
        "rounded-3xl border-2 border-black overflow-hidden",
        "shadow-[0_12px_0_#000,0_26px_56px_rgba(0,0,0,.48)]",
        // subtle contained background that contrasts with page
        "bg-[radial-gradient(90%_160%_at_20%_-10%,rgba(124,58,237,.18),transparent),radial-gradient(110%_180%_at_80%_0%,rgba(14,165,233,.14),transparent),linear-gradient(180deg,#0b1020,#0a0f1c)]",
        // hover edge highlight
        "transition-shadow duration-200",
        "hover:shadow-[0_12px_0_#000,0_0_0_2px_rgba(255,255,255,.18),0_32px_70px_rgba(121,255,225,.22)]",
        // animations
        spinOn && "animate-spin-secret",
        jumpOn && "animate-bounce-strong",
        className
      )}
      style={{ width, height }}
      role="img"
      aria-label="Toby the blue frog — tap to wink, double tap to jump; 10 taps to spin"
    >
      <div className="w-full h-full grid place-items-center select-none">
        {/* Wink effect = quick vertical squish. It looks natural on the PNG. */}
        <img
          src="/toby.PNG"
          alt="Toby Frog"
          draggable={false}
          className={clsx(
            "pointer-events-none",
            "transition-transform duration-200 ease-out",
            winkOn && "scale-y-90",
            // slight swaying while idle so he feels alive (very subtle)
            "animate-float-soft"
          )}
          style={{
            maxWidth: "88%",
            maxHeight: "88%",
            transformOrigin: "center bottom",
          }}
        />
      </div>

      {/* tiny invisible element to control bounce intensity via CSS var */}
      <style jsx>{`
        figure { --jump-strength: ${intensity}; }
      `}</style>
    </figure>
  )
}
