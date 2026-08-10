// components/TokenSelect.tsx
"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { TOKENS, type TokenAddress } from "@/lib/addresses";
import type { Address } from "viem";
import { useMemo, useEffect, useState } from "react";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { formatUnits } from "viem";

const iconMap: Record<string, string> = {
  ETH: "/tokens/baseeth.PNG",
  WETH: "/tokens/baseeth.PNG",
  USDC: "/tokens/usdc.PNG",
  TOBY: "/tokens/toby.PNG",
  PATIENCE: "/tokens/patience.PNG",
  TABOSHI: "/tokens/taboshi.PNG",
};

const tokenCopy: Record<string, string> = {
  ETH: "Base native asset",
  USDC: "USD Coin on Base",
  TOBY: "Tobyworld",
  PATIENCE: "Patience",
  TABOSHI: "Taboshi",
};

const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

const preferredAddressForSymbol: Partial<Record<string, Address>> = {
  ETH: (TOKENS.find((t) => t.symbol === "WETH")?.address ??
    "0x0000000000000000000000000000000000000000") as Address,
};

const symbolOrder = ["ETH", "USDC", "TOBY", "PATIENCE", "TABOSHI"];

export default function TokenSelect({
  user,
  value,
  onChange,
  exclude,
  balance,
  collapseETH = true,
  forceBlur = false,
}: {
  user?: Address;
  value: Address;
  onChange: (a: Address) => void;
  exclude?: Address | string;
  balance?: string;
  collapseETH?: boolean;
  forceBlur?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceBlur) setOpen(false);
  }, [forceBlur]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = useMemo(() => {
    const fromList = TOKENS.find((t) => eq(t.address, value));
    if (fromList) return fromList;
    return { symbol: "UNKNOWN", address: value, decimals: 18 } as (typeof TOKENS)[number];
  }, [value]);

  const displaySymbol = selected.symbol === "WETH" ? "ETH" : (selected.symbol ?? "Unknown");

  const { value: hookBal, decimals: hookDec } = useTokenBalance(
    user,
    selected.address as TokenAddress,
    { chainId: 8453 }
  );

  const autoBal =
    hookBal !== undefined && hookDec !== undefined
      ? formatUnits(hookBal, hookDec)
      : undefined;

  const balText = useMemo(() => {
    const src = balance ?? autoBal;
    if (src == null) return "—";
    const n = Number(src);
    if (!Number.isFinite(n)) return src;
    if (n === 0) return "0";
    if (n < 0.000001) return "<0.000001";
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }, [balance, autoBal]);

  const availableTokens = useMemo(() => {
    const filtered = TOKENS.filter((t) => !exclude || !eq(t.address, String(exclude)));
    const deduped: (typeof TOKENS)[number][] = [];

    if (collapseETH) {
      const seen = new Set<string>();
      for (const t of filtered) {
        const label = t.symbol === "WETH" ? "ETH" : t.symbol;
        if (seen.has(label)) continue;
        seen.add(label);
        const preferred = preferredAddressForSymbol[label] &&
          filtered.find((x) => eq(x.address, preferredAddressForSymbol[label]!));
        deduped.push(preferred ?? t);
      }
    } else {
      deduped.push(...filtered);
    }

    const rank = (sym: string) => {
      const label = sym === "WETH" ? "ETH" : sym;
      const i = symbolOrder.indexOf(label);
      return i === -1 ? 999 : i;
    };

    return deduped.sort((a, b) => {
      const A = a.symbol === "WETH" ? "ETH" : a.symbol;
      const B = b.symbol === "WETH" ? "ETH" : b.symbol;
      const r = rank(A) - rank(B);
      return r !== 0 ? r : A.localeCompare(B);
    });
  }, [exclude, collapseETH]);

  function choose(next: Address) {
    const entry = TOKENS.find((t) => eq(t.address, next));
    const label = entry?.symbol === "WETH" ? "ETH" : entry?.symbol;
    onChange(label === "ETH" && preferredAddressForSymbol.ETH ? preferredAddressForSymbol.ETH : next);
    setOpen(false);
  }

  const modal = open && typeof document !== "undefined" ? createPortal(
    <div className="token-modal fixed inset-0 z-[12000] flex items-end sm:items-center justify-center p-3 sm:p-6">
      <button className="absolute inset-0 bg-[#1c2933]/25 backdrop-blur-[3px]" aria-label="Close token selector" onClick={() => setOpen(false)} />
      <div role="dialog" aria-modal="true" aria-label="Choose a token" className="token-modal-card relative z-10 w-full max-w-md p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="world-kicker">TOBYWORLD ASSETS</div>
            <h3 className="text-xl font-black tracking-[-.03em] mt-1">Choose a token</h3>
          </div>
          <button type="button" className="metal-button compact-metal px-3" onClick={() => setOpen(false)}>Close</button>
        </div>

        <div className="token-modal-list">
          {availableTokens.map((t) => {
            const label = t.symbol === "WETH" ? "ETH" : t.symbol;
            const val = label === "ETH" && preferredAddressForSymbol.ETH
              ? preferredAddressForSymbol.ETH
              : (t.address as Address);
            const active = eq(val, value);
            return (
              <button
                type="button"
                key={t.address as string}
                className={`token-option ${active ? "token-option-active" : ""}`}
                onClick={() => choose(val)}
              >
                <span className="token-option-icon">
                  <Image src={iconMap[label] ?? "/tokens/baseeth.PNG"} alt="" fill sizes="48px" className="object-contain" />
                </span>
                <span className="min-w-0 text-left flex-1">
                  <span className="block font-black text-[15px]">{label}</span>
                  <span className="block text-[11px] text-inkSub truncate">{tokenCopy[label] ?? "Base asset"}</span>
                </span>
                <span className="token-option-arrow">{active ? "✓" : "›"}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold tracking-[.12em] text-inkSub uppercase">
          <span className="status-dot !mr-0" /> Base network
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        type="button"
        className="token-trigger"
        onClick={() => !forceBlur && setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="token-trigger-icon">
          <Image
            src={iconMap[displaySymbol] ?? "/tokens/baseeth.PNG"}
            alt={displaySymbol}
            fill
            sizes="44px"
            className="object-contain"
          />
        </span>
        <span className="min-w-0 text-left flex-1">
          <span className="token-trigger-symbol">{displaySymbol}</span>
          <span className="token-trigger-balance">Balance {balText}</span>
        </span>
        <span className="token-trigger-chevron">⌄</span>
      </button>
      {modal}
    </>
  );
}
