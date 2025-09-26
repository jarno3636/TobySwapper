// components/ThemeToggle.tsx
"use client"

import { useEffect, useMemo, useState } from "react"

type Theme = "night" | "neon" | "pastel"
const KEY = "toby-theme"

const THEME_META: Record<Theme, { label: string; icon: string; title: string }> = {
  night:  { label: "Night",  icon: "🌙", title: "Dark, high-contrast" },
  neon:   { label: "Neon",   icon: "⚡", title: "Vibrant neon accents" },
  pastel: { label: "Pastel", icon: "🌈", title: "Soft pastel palette" },
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("night")
  const [mounted, setMounted] = useState(false)

  // Read saved theme on mount (SSR-safe)
  useEffect(() => {
    setMounted(true)
    try {
      const saved = (localStorage.getItem(KEY) as Theme) || "night"
      applyTheme(saved)
    } catch {
      applyTheme("night")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Helper to apply + persist + broadcast theme
  function applyTheme(next: Theme) {
    setTheme(next)
    try {
      localStorage.setItem(KEY, next)
    } catch { /* ignore */ }
    document.documentElement.setAttribute("data-theme", next)
    // let other components know (optional)
    window.dispatchEvent(new CustomEvent("toby:theme", { detail: { theme: next } }))
  }

  function cycle() {
    const next: Theme = theme === "night" ? "neon" : theme === "neon" ? "pastel" : "night"
    applyTheme(next)
  }

  // Button a11y/labeling
  const meta = useMemo(() => THEME_META[theme], [theme])

  // Avoid hydration mismatch: render a neutral button until mounted
  if (!mounted) {
    return (
      <button
        className="nav-pill"
        aria-label="Switch theme"
        title="Switch theme"
        type="button"
        disabled
        style={{ opacity: 0.6, cursor: "default" }}
      >
        🎨 Theme
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="nav-pill nav-pill--lg"
      title={`${meta.title} — click to switch`}
      aria-label="Switch theme"
      aria-pressed="true"
    >
      <span aria-hidden>{meta.icon}</span>
      <span className="font-extrabold">{meta.label}</span>
    </button>
  )
}
