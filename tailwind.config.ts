import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: { cel: "0 6px 0 #000" },
      backgroundImage: {
        "toby-gradient": "linear-gradient(135deg,#ffd1dc 0%,#a7f3d0 45%,#bfdbfe 100%)",
        "toby-radial": "radial-gradient(1000px 600px at 10% 10%,rgba(255,255,255,.45),rgba(255,255,255,0) 60%)"
      }
    }
  },
  plugins: []
}
export default config
