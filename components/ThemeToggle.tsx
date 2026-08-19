"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const KEY = "tobyswap-theme";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  try {
    localStorage.setItem(KEY, theme);
  } catch {}

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#081416" : "#faf9f6";

  window.dispatchEvent(
    new CustomEvent("tobyswap:theme-change", { detail: { theme } }),
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(currentTheme());

    function onTheme(event: Event) {
      const value = (event as CustomEvent<{ theme?: Theme }>).detail?.theme;
      if (value === "light" || value === "dark") setTheme(value);
    }

    window.addEventListener("tobyswap:theme-change", onTheme);
    return () => window.removeEventListener("tobyswap:theme-change", onTheme);
  }, []);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-orbit" />
        <span className="theme-toggle-icon">
          {theme === "dark" ? (
            <svg viewBox="0 0 24 24">
              <path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M20 15.1A8.4 8.4 0 0 1 8.9 4a8.6 8.6 0 1 0 11.1 11.1Z" />
            </svg>
          )}
        </span>
      </span>
      <span className="theme-toggle-label">{theme === "dark" ? "Night" : "Day"}</span>
    </button>
  );
}
