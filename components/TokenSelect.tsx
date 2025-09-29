"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { type Address } from "viem"
import { TOKENS } from "@/lib/addresses"

type SymbolKey = "USDC" | "WETH" | "TOBY" | "PATIENCE" | "TABOSHI"

const SYMBOL_TO_META: Record<
  SymbolKey,
  { symbol: SymbolKey; address: Address; decimals: number; icon: string }
> = {
  USDC:     { ...TOKENS.USDC,     icon: "/tokens/usdc.PNG"     } as any,
  WETH:     { ...TOKENS.WETH,     icon: "/tokens/weth.PNG"     } as any,
  TOBY:     { ...TOKENS.TOBY,     icon: "/tokens/toby.PNG"     } as any,
  PATIENCE: { ...TOKENS.PATIENCE, icon: "/tokens/patience.PNG" } as any,
  TABOSHI:  { ...TOKENS.TABOSHI,  icon: "/tokens/taboshi.PNG"  } as any,
}

function symbolFromAddress(addr: Address): SymbolKey | null {
  const entry = Object.entries(SYMBOL_TO_META).find(
    ([, v]) => v.address.toLowerCase() === addr.toLowerCase(),
  )
  return (entry?.[0] as SymbolKey) ?? null
}
function addressFromSymbol(sym: SymbolKey): Address {
  return SYMBOL_TO_META[sym].address
}

export default function TokenSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Search tokens…",
}: {
  label: string
  value: Address
  onChange: (v: Address) => void
  options: SymbolKey[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)

  const btnRef  = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const infoRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const currentSym = useMemo(
    () => (symbolFromAddress(value) as SymbolKey | null) ?? options[0],
    [value, options],
  )
  const items = useMemo(() => options.map((s) => SYMBOL_TO_META[s]), [options])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.trim().toLowerCase()
    return items.filter((t) => t.symbol.toLowerCase().includes(q))
  }, [items, query])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (open && listRef.current && btnRef.current) {
        if (!listRef.current.contains(t) && !btnRef.current.contains(t)) setOpen(false)
      }
      if (infoOpen && infoRef.current && btnRef.current) {
        if (!infoRef.current.contains(t) && !btnRef.current.contains(t)) setInfoOpen(false)
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setInfoOpen(false) }
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open, infoOpen])

  useEffect(() => {
    if (!open) return
    itemRefs.current[activeIdx]?.scrollIntoView({ block: "nearest" })
  }, [activeIdx, open])

  function openList() {
    setOpen(true)
    setQuery("")
    setActiveIdx(0)
    setTimeout(() => {
      const input = listRef.current?.querySelector<HTMLInputElement>("input[data-role='search']")
      input?.focus()
    }, 10)
  }

  const triggerClasses = [
    "w-full flex items-center justify-between gap-3 rounded-2xl border-2 border-black px-3 py-2",
    "shadow-[0_6px_0_#000] active:translate-y-[2px] active:shadow-[0_3px_0_#000] transition",
    // dark glass
    "bg-[linear-gradient(180deg,rgba(11,18,32,.96),rgba(15,23,42,.96))] text-slate-100",
  ].join(" ")

  return (
    <div className="w-full">
      <label className="block mb-1 text-sm font-semibold text-slate-200">
        {label}
      </label>

      <div className="relative flex items-center gap-2">
        {/* Trigger */}
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openList())}
          className={triggerClasses}
        >
          <div className="flex items-center gap-3 min-w-0">
            <TokenIcon symbol={currentSym || options[0]} />
            <span className="font-extrabold truncate">{currentSym}</span>
          </div>
          <span className="opacity-80">▾</span>
        </button>

        {/* Info button (address popover) */}
        <button
          type="button"
          title="Show token address"
          aria-label="Show token address"
          onClick={() => setInfoOpen((v) => !v)}
          className="inline-grid place-items-center h-9 w-9 rounded-xl border-2 border-black shadow-[0_4px_0_#000] active:translate-y-[2px] active:shadow-[0_2px_0_#000] bg-[linear-gradient(180deg,#0f172a,#121826)] text-slate-100"
        >
          ⓘ
        </button>

        {/* Address popover */}
        {infoOpen && currentSym && (
          <div
            ref={infoRef}
            className="absolute right-0 top-[calc(100%+6px)] z-30 w-[min(92vw,360px)] rounded-2xl border-2 border-black p-3 shadow-[0_10px_0_#000] text-slate-100 bg-[linear-gradient(180deg,rgba(11,18,32,.98),rgba(15,23,42,.98))]"
          >
            <div className="mb-2 flex items-center gap-2">
              <TokenIcon symbol={currentSym} />
              <div className="font-extrabold">{currentSym}</div>
            </div>
            <code className="block break-all rounded-xl bg-black/30 px-2 py-1.5 text-xs">
              {SYMBOL_TO_META[currentSym].address}
            </code>
            <div className="mt-2 flex justify-end">
              <button
                className="rounded-lg border-2 border-black bg-white/90 px-2 py-1 text-xs font-extrabold text-black shadow-[0_3px_0_#000] active:translate-y-[1px] active:shadow-none"
                onClick={() => navigator.clipboard?.writeText(SYMBOL_TO_META[currentSym].address)}
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* List sheet */}
        {open && (
          <div
            ref={listRef}
            role="listbox"
            aria-label={`${label} options`}
            tabIndex={-1}
            className="absolute z-30 mt-2 w-full rounded-2xl border-2 border-black p-2 shadow-[0_10px_0_#000] max-h-[360px] overflow-auto
                       text-slate-100
                       bg-[radial-gradient(60%_120%_at_10%_0%,rgba(124,58,237,.18),transparent),linear-gradient(180deg,rgba(11,18,32,.98),rgba(15,23,42,.98))]"
          >
            {items.length > 5 && (
              <div className="sticky top-0 z-10 mb-2 rounded-xl border-2 border-black bg-black/30 px-2 py-1.5 shadow-[0_4px_0_#000]">
                <input
                  data-role="search"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIdx(0) }}
                  placeholder={placeholder}
                  className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400/60"
                  aria-label="Search tokens"
                />
              </div>
            )}

            {filtered.length === 0 && (
              <div className="px-3 py-6 text-sm text-slate-300/80">No matches.</div>
            )}

            {filtered.map((it, i) => {
              const selected = currentSym === it.symbol
              const active = i === activeIdx
              return (
                <button
                  key={it.symbol}
                  ref={(el) => { itemRefs.current[i] = el }}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => { onChange(addressFromSymbol(it.symbol)); setOpen(false) }}
                  className={[
                    "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                    active ? "ring-2 ring-black bg-white/5" : "hover:bg-white/5",
                  ].join(" ")}
                >
                  <TokenIcon symbol={it.symbol} />
                  <span className="font-extrabold">{it.symbol}</span>
                  {selected && <span className="ml-auto text-xs opacity-80">Selected</span>}
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
  const fallback =
    symbol === "USDC" ? "U" :
    symbol === "WETH" ? "Ξ" :
    symbol === "TOBY" ? "🐸" :
    symbol === "PATIENCE" ? "△" : "🌱"

  return err ? (
    <div className="grid place-items-center w-8 h-8 rounded-xl border-2 border-black bg-white text-base">
      {fallback}
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
