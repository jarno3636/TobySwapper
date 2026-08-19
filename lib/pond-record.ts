"use client";

import type { Address } from "viem";

export type PondSwapRecord = {
  hash: `0x${string}`;
  at: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut?: string;
  burnToby?: string;
  route: "pond" | "direct";
};

export type PondRecord = {
  version: 1;
  wallet: string;
  swaps: PondSwapRecord[];
};

const EVENT = "tobyswap:pond-record-updated";
const MAX_SWAPS = 80;

function key(wallet: string) {
  return `tobyswap:pond-record:v1:${wallet.toLowerCase()}`;
}

export function readPondRecord(wallet?: Address | string): PondRecord {
  const clean = wallet?.toLowerCase() || "";
  const empty: PondRecord = { version: 1, wallet: clean, swaps: [] };
  if (!clean || typeof window === "undefined") return empty;
  try {
    const parsed = JSON.parse(localStorage.getItem(key(clean)) || "null") as PondRecord | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.swaps)) return empty;
    return { ...empty, ...parsed, wallet: clean, swaps: parsed.swaps.slice(0, MAX_SWAPS) };
  } catch {
    return empty;
  }
}

export function recordConfirmedSwap(wallet: Address | string, swap: PondSwapRecord) {
  if (typeof window === "undefined") return;
  const current = readPondRecord(wallet);
  const deduped = current.swaps.filter((item) => item.hash.toLowerCase() !== swap.hash.toLowerCase());
  const next: PondRecord = { version: 1, wallet: wallet.toLowerCase(), swaps: [swap, ...deduped].slice(0, MAX_SWAPS) };
  try {
    localStorage.setItem(key(wallet), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { wallet: wallet.toLowerCase() } }));
  } catch {}
}

export function listenForPondRecord(wallet: Address | string | undefined, onChange: (record: PondRecord) => void) {
  if (typeof window === "undefined" || !wallet) return () => {};
  const normalized = wallet.toLowerCase();
  const refresh = () => onChange(readPondRecord(wallet));
  const onEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ wallet?: string }>).detail;
    if (!detail?.wallet || detail.wallet === normalized) refresh();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === key(normalized)) refresh();
  };
  window.addEventListener(EVENT, onEvent);
  window.addEventListener("storage", onStorage);
  refresh();
  return () => {
    window.removeEventListener(EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
