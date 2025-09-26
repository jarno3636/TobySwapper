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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* scrim */}
      <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close settings" />
      {/* panel */}
      <div
        className="
          w-full max-w-sm rounded-2xl border-2 border-black p-4
          bg-[linear-gradient(180deg,rgba(10,16,28,.96),rgba(5,10,20,.96))]
          text-slate-100 shadow-[0_10px_0_#000,0_24px_54px_rgba(0,0,0,.55)]
          relative
        "
      >
        <div className="flex items-center justify-between mb-3">
          <div className="font-black text-lg">Settings</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
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
