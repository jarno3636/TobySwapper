// components/SwapSettings.tsx
"use client"

import { Dispatch, SetStateAction, useMemo } from "react"
import NumberInput from "./NumberInput"

type Props = {
  open: boolean
  onClose: () => void
  slippagePct: string
  setSlippagePct: Dispatch<SetStateAction<string>>
}

export default function SwapSettings({ open, onClose, slippagePct, setSlippagePct }: Props) {
  if (!open) return null

  const presets = useMemo(() => ["0.5", "1", "1.5", "2"], [])

  return (
    <div
      className="swap-settings fixed inset-0 z-[999] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* scrim / frosted backdrop */}
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close settings"
      />

      {/* panel */}
      <div
        className={[
          "relative w-full max-w-md rounded-3xl border-2 border-black p-6 md:p-7",
          "bg-[radial-gradient(120%_160%_at_15%_-20%,rgba(124,58,237,.20),transparent),radial-gradient(120%_160%_at_85%_-10%,rgba(14,165,233,.16),transparent),linear-gradient(180deg,#0b1220,#0f172a)]",
          "text-slate-100 shadow-[0_12px_0_#000,0_24px_54px_rgba(0,0,0,.65)]",
          "animate-in fade-in zoom-in-95 duration-150",
        ].join(" ")}
      >
        {/* header */}
        <div className="mb-5 flex items-center justify-between">
          <h3
            className="text-[24px] md:text-[28px] font-black leading-none"
            style={{
              background: "linear-gradient(90deg,#a78bfa 0%,#79ffe1 50%,#93c5fd 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: "0 3px 0 rgba(0,0,0,.35)",
            }}
          >
            Swap Settings
          </h3>

          <button
            className="inline-grid h-9 w-9 place-items-center rounded-full border-2 border-black bg-[linear-gradient(180deg,#0f172a,#121826)] text-slate-100 shadow-[0_4px_0_#000] active:translate-y-[2px] active:shadow-[0_2px_0_#000]"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* slippage */}
        <div className="num-glass">
          <NumberInput
            label="Max slippage"
            value={slippagePct}
            onChange={setSlippagePct}
            placeholder="1"
            unit="%"
            decimals={2}
            step="0.1"
            showPercentChips={false}
            help="Most swaps work with 1–2% slippage."
          />
        </div>

        {/* quick presets */}
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((p) => {
            const active = slippagePct === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => setSlippagePct(p)}
                className={[
                  "rounded-full border-2 border-black px-3 py-1.5 text-xs font-extrabold",
                  "bg-[linear-gradient(135deg,#0f172a,#111827)] text-slate-100 shadow-[0_3px_0_#000]",
                  active ? "ring-2 ring-[#79ffe1]" : "",
                ].join(" ")}
              >
                {p}%
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setSlippagePct("1")}
            className="ml-auto rounded-full border-2 border-black px-3 py-1.5 text-xs font-extrabold bg-[linear-gradient(135deg,#0f172a,#111827)] text-slate-100 shadow-[0_3px_0_#000]"
            title="Reset to 1%"
          >
            Reset
          </button>
        </div>

        {/* footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className={[
              "relative overflow-hidden rounded-full border-2 border-black px-5 py-2 font-black",
              "text-[#031611]",
              "shadow-[0_5px_0_#000] active:translate-y-[2px] active:shadow-[0_3px_0_#000]",
              "bg-[linear-gradient(135deg,rgba(16,185,129,.96),rgba(52,211,153,.94))]",
              "before:absolute before:inset-0 before:pointer-events-none before:rounded-full before:opacity-[.22] before:bg-[radial-gradient(120%_150%_at_50%_-20%,#fff,transparent_60%)]",
            ].join(" ")}
          >
            Done
          </button>
        </div>
      </div>

      {/* Scoped style overrides to keep NumberInput dark-glass + no +/- inside settings too */}
      <style jsx global>{`
        .swap-settings .num-glass label > div[class*="shadow-[0_6px_0_#000]"] {
          background: linear-gradient(180deg,#0b1220,#0f172a) !important;
          border-color: #000 !important;
        }
        .swap-settings .num-glass input[type="text"] { color: #e5e7eb !important; }
        .swap-settings .num-glass label > div[class*="shadow-[0_6px_0_#000]"] > button[aria-label="Decrease"],
        .swap-settings .num-glass label > div[class*="shadow-[0_6px_0_#000]"] > button[aria-label="Increase"] {
          display: none !important;
        }
        .swap-settings .num-glass span[aria-hidden] {
          background: linear-gradient(180deg,#0f172a,#121826) !important;
          color: #e5e7eb !important;
        }
      `}</style>
    </div>
  )
}
