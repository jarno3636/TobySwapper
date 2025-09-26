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
    ([, v]) => v.address.toLowerCase() === addr.toLowerCase()
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
  options,           // e.g. ["USDC","WETH","TOBY","PATIENCE","TABOSHI"]
  placeholder = "Search tokens…",
  compact = false,   // smaller trigger if needed
}: {
  label: string
  value: Address
  onChange: (v: Address) => void
  options: SymbolKey[]
  placeholder?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)

  const btnRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const currentSym = useMemo(
    () => (symbolFromAddress(value) as SymbolKey | null) ?? options[0],
    [value, options]
  )
  const items = useMemo(
    () => options.map((s) => SYMBOL_TO_META[s]),
    [options]
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.trim().toLowerCase()
    return items.filter(
      (t) => t.symbol.toLowerCase().includes(q) || t.address.toLowerCase().includes(q)
    )
  }, [items, query])

  /** Close on outside click / ESC */
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return
      if (!listRef.current || !btnRef.current) return
      const t = e.target as Node
      if (!listRef.current.contains(t) && !btnRef.current.contains(t)) {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  /** Ensure active item is scrolled into view */
  useEffect(() => {
    if (!open) return
    const el = itemRefs.current[activeIdx]
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIdx, open])

  function openList() {
    setOpen(true)
    setQuery("")
    setActiveIdx(0)
    // Slight delay so DOM paints then we can focus search on open
    setTimeout(() => {
      const input = listRef.current?.querySelector<HTMLInputElement>("input[data-role='search']")
      input?.focus()
    }, 10)
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === " " || e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault()
      open ? setOpen(false) : openList()
    }
  }

  function choose(sym: SymbolKey) {
    onChange(addressFromSymbol(sym))
    setOpen(false)
    btnRef.current?.focus()
  }

  /** Keyboard in list: arrows & enter */
  function onListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!filtered.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const sym = filtered[activeIdx]?.symbol
      if (sym) choose(sym)
    }
  }

  const triggerClasses = [
    "w-full flex items-center justify-between gap-3 rounded-2xl border-2 border-black px-3 shadow-[0_6px_0_#000] active:translate-y-[2px] active:shadow-[0_3px_0_#000] transition",
    compact ? "py-1.5 bg-white" : "py-2 bg-white",
  ].join(" ")

  return (
    <div className="w-full">
      <label className="block mb-1 text-sm font-semibold text-black/80">
        {label}
      </label>

      <div className="relative">
        {/* Trigger */}
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onTriggerKeyDown}
          className={triggerClasses}
        >
          <div className="flex items-center gap-3 min-w-0">
            <TokenIcon symbol={currentSym} />
            <span className="font-extrabold text-black truncate">{currentSym}</span>
          </div>
          <span className="text-black/70">▾</span>
        </button>

        {/* Sheet / List */}
        {open && (
          <div
            ref={listRef}
            role="listbox"
            aria-label={`${label} options`}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            className="absolute z-30 mt-2 w-full rounded-2xl border-2 border-black p-2 shadow-[0_10px_0_#000] max-h-[360px] overflow-auto
                       text-black
                       bg-[radial-gradient(60%_120%_at_10%_0%,rgba(124,58,237,.18),transparent),linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,255,255,.92))]"
          >
            {/* Search (auto-hides when not needed) */}
            {items.length > 5 && (
              <div className="sticky top-0 z-10 mb-2 rounded-xl border-2 border-black bg-white px-2 py-1.5 shadow-[0_4px_0_#000]">
                <input
                  data-role="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActiveIdx(0)
                  }}
                  placeholder={placeholder}
                  className="w-full bg-transparent outline-none text-sm"
                  aria-label="Search tokens"
                />
              </div>
            )}

            {filtered.length === 0 && (
              <div className="px-3 py-6 text-sm text-black/60">No matches.</div>
            )}

            {filtered.map((it, i) => {
              const selected = currentSym === it.symbol
              const active = i === activeIdx
              return (
                <button
                  key={it.symbol}
                  ref={(el) => (itemRefs.current[i] = el)}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => choose(it.symbol)}
                  className={[
                    "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                    active ? "ring-2 ring-black bg-black/5" : "hover:bg-black/5",
                  ].join(" ")}
                >
                  <TokenIcon symbol={it.symbol} />
                  <div className="flex flex-col min-w-0">
                    <span className="font-extrabold text-black">{it.symbol}</span>
                    <span className="text-[11px] text-black/60 truncate">{it.address}</span>
                  </div>
                  {selected && (
                    <span className="ml-auto text-xs font-extrabold text-black/70">Selected</span>
                  )}
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
