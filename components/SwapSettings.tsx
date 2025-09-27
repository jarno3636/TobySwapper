"use client"

import { Dispatch, SetStateAction } from "react"
import NumberInput from "./NumberInput"

type Props = {
  open: boolean
  onClose: () => void
  slippagePct: string
  setSlippagePct: Dispatch<SetStateAction<string>>
}

export default function SwapSettings({ open, onClose, slippagePct, setSlippagePct }: Props) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* scrim */}
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close settings"
      />
      {/* centered panel */}
      <div
        className={[
          "relative w-full max-w-sm rounded-2xl border-2 border-black p-5",
          "bg-[linear-gradient(180deg,rgba(10,16,28,.96),rgba(5,10,20,.96))]",
          "text-slate-100 shadow-[0_12px_0_#000,0_24px_54px_rgba(0,0,0,.65)]",
        ].join(" ")}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="font-black text-lg">Settings</div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-[linear-gradient(180deg,#0f172a,#121826)] shadow-[0_4px_0_#000] text-slate-100 font-black"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <NumberInput
          label="Slippage"
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
    </div>
  )
}
