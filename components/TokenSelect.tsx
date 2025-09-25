"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { type Address } from "viem"
import { TOKENS } from "@/lib/addresses"

type SymbolKey = "USDC" | "WETH" | "TOBY" | "PATIENCE" | "TABOSHI"

const SYMBOL_TO_META: Record<SymbolKey, { symbol: SymbolKey; address: Address; decimals: number; icon: string }> = {
  USDC:     { ...TOKENS.USDC,     icon: "/tokens/usdc.png"     } as any,
  WETH:     { ...TOKENS.WETH,     icon: "/tokens/weth.png"     } as any,
  TOBY:     { ...TOKENS.TOBY,     icon: "/tokens/toby.png"     } as any,
  PATIENCE: { ...TOKENS.PATIENCE, icon: "/tokens/patience.png" } as any,
  TABOSHI:  { ...TOKENS.TABOSHI,  icon: "/tokens/taboshi.png"  } as any,
}

function symbolFromAddress(addr: Address): SymbolKey | null {
  const entry = Object.entries(SYMBOL_TO_META).find(([, v]) => v.address.toLowerCase() === addr.toLowerCase())
  return (entry?.[0] as SymbolKey) ?? null
}
function addressFromSymbol(sym: SymbolKey): Address {
  return SYMBOL_TO_META[sym].address
}

export default function TokenSelect({
  label,
  value,
  onChange,
  options, // e.g. ["USDC","WETH","TOBY","PATIENCE","TABOSHI"]
}: {
  label: string
  value: Address
  onChange: (v: Address) => void
  options: SymbolKey[]
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const currentSym = useMemo(() => symbolFromAddress(value) as SymbolKey | null, [value])
  const items = useMemo(() => options.map((s) => SYMBOL_TO_META[s]), [options])

  // Close on outside click / ESC
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return
      if (!listRef.current || !btnRef.current) return
      const t = e.target as Node
      if (!listRef.current.contains(t) && !btnRef.current.contains(t)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  // keyboard focus management
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === " " || e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault()
      setOpen((s) => !s)
    }
  }

  function pick(sym: SymbolKey) {
    const addr = addressFromSymbol(sym)
    onChange(addr)
    setOpen(false)
  }

  return (
    <div className="w-full">
      <label className="block mb-1 text-sm font-semibold text-black/80">{label}</label>

      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
          onKeyDown={onKeyDown}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border-2 border-black bg-white px-3 py-2 shadow-[0_6px_0_#000] hover:brightness-[.99] active:translate-y-[2px] active:shadow-[0_3px_0_#000] transition"
        >
          <div className="flex items-center gap-3">
            <TokenIcon symbol={currentSym ?? options[0]} />
            <span className="font-bold text-black">{currentSym ?? options[0]}</span>
          </div>
          <span className="text-black/70">▾</span>
        </button>

        {open && (
          <div
            ref={listRef}
            role="listbox"
            className="absolute z-30 mt-2 w-full rounded-2xl border-2 border-black bg-white p-2 shadow-[0_10px_0_#000] max-h-[300px] overflow-auto"
          >
            {items.map((it) => {
              const selected = currentSym === it.symbol
              return (
                <button
                  key={it.symbol}
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(it.symbol)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                    selected ? "bg-black/5 ring-2 ring-black" : "hover:bg-black/5"
                  }`}
                >
                  <TokenIcon symbol={it.symbol} />
                  <div className="flex flex-col">
                    <span className="font-bold text-black">{it.symbol}</span>
                    <span className="text-xs text-black/60 break-all">{it.address}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TokenIcon({ symbol }: { symbol: SymbolKey }) {
  const src = SYMBOL_TO_META[symbol].icon
  const [err, setErr] = useState(false)
  const initials =
    symbol === "USDC" ? "U" :
    symbol === "WETH" ? "Ξ" :
    symbol === "TOBY" ? "🐸" :
    symbol === "PATIENCE" ? "△" :
    "🌱"

  return err ? (
    <div className="grid place-items-center w-8 h-8 rounded-xl border-2 border-black bg-white text-base">
      {initials}
    </div>
  ) : (
    <Image
      src={src}
      alt={`${symbol} logo`}
      width={28}
      height={28}
      className="rounded-md border-2 border-black bg-white"
      onError={() => setErr(true)}
      priority={symbol === "TOBY"}
    />
  )
}
