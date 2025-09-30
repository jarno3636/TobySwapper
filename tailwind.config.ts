import type { Config } from "tailwindcss";

export default <Config>{
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0b12",
        ink: "#e5e7eb",
        inkSub: "#9aa4b2",
        glass: "rgba(255,255,255,.08)",
        accent: "#79ffe1",
        accent2: "#ffd1dc",
        accent3: "#c4b5fd",
        success: "#22c55e",
        warn: "#f59e0b",
        danger: "#ef4444",
      },
      boxShadow: {
        strong: "0 12px 0 #0b0b0b",
        soft: "0 16px 40px rgba(0,0,0,.45)",
      },
      borderRadius: {
        pill: "9999px",
      },
    },
  },
  plugins: [],
};
