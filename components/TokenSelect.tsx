"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { NATIVE_ETH, TOKENS, type TokenAddress } from "@/lib/addresses";
import type { Address } from "viem";
import { useMemo, useEffect, useState } from "react";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { formatUnits } from "viem";

export type TokenChoice = Address | "ETH";

const iconMap: Record<string, string> = {
  ETH: "/tokens/baseeth.PNG",
  WETH: "/tokens/baseeth.PNG",
  USDC: "/ui/usdc.webp",
  TOBY: "/tokens/toby.PNG",
  PATIENCE: "/ui/patience.webp",
  TABOSHI: "/ui/taboshi.webp",
};

const tokenCopy: Record<string, string> = {
  ETH: "Native ETH on Base",
  WETH: "Wrapped ETH · ERC-20",
  USDC: "USD Coin on Base",
  TOBY: "Tobyworld token",
  PATIENCE: "Patience",
  TABOSHI: "Taboshi · strongest WETH route",
};

const symbolOrder = ["ETH", "WETH", "USDC", "TOBY", "PATIENCE", "TABOSHI"];
const eqAddr = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function choiceForToken(token: (typeof TOKENS)[number]): TokenChoice {
  return token.address === NATIVE_ETH ? "ETH" : (token.address as Address);
}

function sameChoice(a?: TokenChoice, b?: TokenChoice | string) {
  if (!a || !b) return false;
  if (a === "ETH" || b === "ETH") return a === b;
  return eqAddr(a, b);
}

export default function TokenSelect({
  user,
  value,
  onChange,
  exclude,
  balance,
  forceBlur = false,
}: {
  user?: Address;
  value: TokenChoice;
  onChange: (a: TokenChoice) => void;
  exclude?: TokenChoice | string;
  balance?: string;
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
    if (value === "ETH") return TOKENS.find((t) => t.address === NATIVE_ETH)!;
    return TOKENS.find((t) => t.address !== NATIVE_ETH && eqAddr(String(t.address), value)) ?? {
      symbol: "UNKNOWN",
      address: value,
      decimals: 18,
    };
  }, [value]);

  const tokenForBalance = selected.address as TokenAddress;
  const { value: hookBal, decimals: hookDec } = useTokenBalance(user, tokenForBalance, { chainId: 8453 });

  const autoBal = hookBal !== undefined && hookDec !== undefined ? formatUnits(hookBal, hookDec) : undefined;
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
    return [...TOKENS]
      .filter((token) => !exclude || !sameChoice(choiceForToken(token), exclude))
      .sort((a, b) => symbolOrder.indexOf(a.symbol) - symbolOrder.indexOf(b.symbol));
  }, [exclude]);

  function choose(next: TokenChoice) {
    onChange(next);
    setOpen(false);
  }

  const modal = open && typeof document !== "undefined" ? createPortal(
    <div className="token-modal fixed inset-0 z-[12000] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button className="absolute inset-0 bg-[#1c2933]/25 backdrop-blur-[3px]" aria-label="Close token selector" onClick={() => setOpen(false)} />
      <div role="dialog" aria-modal="true" aria-label="Choose a token" className="token-modal-card relative z-10 w-full max-w-md p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="world-kicker">BASE + TOBYWORLD</div>
            <h3 className="mt-1 text-xl font-black tracking-[-.03em]">Choose a token</h3>
            <p className="mt-1 text-[11px] text-inkSub">WETH is listed separately from native ETH for direct liquidity routes.</p>
          </div>
          <button type="button" className="metal-button compact-metal px-3" onClick={() => setOpen(false)}>Close</button>
        </div>

        <div className="token-modal-list">
          {availableTokens.map((token) => {
            const choice = choiceForToken(token);
            const active = sameChoice(choice, value);
            return (
              <button
                type="button"
                key={`${token.symbol}:${String(token.address)}`}
                className={`token-option ${active ? "token-option-active" : ""}`}
                onClick={() => choose(choice)}
              >
                <span className={`token-option-icon token-option-icon-${token.symbol.toLowerCase()}`}>
                  <Image src={iconMap[token.symbol] ?? "/tokens/baseeth.PNG"} alt="" fill sizes="48px" className="object-contain" />
                  {token.symbol === "WETH" && <i className="wrapped-token-ring" aria-hidden="true">W</i>}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-black text-[15px]">{token.symbol}</span>
                  <span className="block truncate text-[11px] text-inkSub">{tokenCopy[token.symbol] ?? "Base asset"}</span>
                </span>
                {token.symbol === "WETH" && <span className="token-route-chip">TABOSHI route</span>}
                <span className="token-option-arrow">{active ? "✓" : "›"}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-inkSub">
          <span className="status-dot !mr-0" /> Base network
        </div>
      </div>
    </div>,
    document.body,
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
        <span className={`token-trigger-icon token-trigger-icon-${selected.symbol.toLowerCase()}`}>
          <Image src={iconMap[selected.symbol] ?? "/tokens/baseeth.PNG"} alt={selected.symbol} fill sizes="44px" className="object-contain" />
          {selected.symbol === "WETH" && <i className="wrapped-token-ring wrapped-token-ring-small" aria-hidden="true">W</i>}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="token-trigger-symbol">{selected.symbol}</span>
          <span className="token-trigger-balance">Balance {balText}</span>
        </span>
        <span className="token-trigger-chevron">⌄</span>
      </button>
      {modal}
    </>
  );
}
