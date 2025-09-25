"use client"

import { useEffect, useState } from "react"

type Theme = "night" | "neon" | "pastel"
const KEY = "toby-theme"

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("night")

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme) || "night"
    setTheme(saved)
    document.documentElement.setAttribute("data-theme", saved)
  }, [])

  function cycle() {
    const next: Theme = theme === "night" ? "neon" : theme === "neon" ? "pastel" : "night"
    setTheme(next)
    localStorage.setItem(KEY, next)
    document.documentElement.setAttribute("data-theme", next)
  }

  const label = theme === "night" ? "Night" : theme === "neon" ? "Neon" : "Pastel"

  return (
    <button
      onClick={cycle}
      className="pill"
      title="Switch theme"
      aria-label="Switch theme"
    >
      🎨 {label}
    </button>
  )
}
