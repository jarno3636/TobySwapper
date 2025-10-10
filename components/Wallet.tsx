// components/Wallet.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  WagmiProvider,
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { base } from "viem/chains";
import { wagmiConfig } from "@/lib/wallet";

/* ───────── Providers (client-only, SSR-safe) ───────── */

let _qc: QueryClient | null = null;
function getQueryClient() {
  if (_qc) return _qc;
  _qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  });
  return _qc;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/* ───────── Helpers ───────── */

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/* ───────── Injected-first Pill + safe popover ─────────
   - One-click connect (no auto-connect)
   - Disconnected label: "Not Connected"
   - Popover (connected): Copy / Switch to Base / Disconnect
   - All actions wrapped in try/catch to avoid client exceptions
---------------------------------------------------------------- */
export function WalletPill() {
  const mounted = useMounted();

  const { address, isConnected, status: accountStatus } = useAccount();
  const chainId = useChainId();

  const connectApi = useConnect();
  const { connectors = [], connect, status: connectStatus, error, reset } = connectApi;

  const { disconnect } = useDisconnect();
  const switchApi = useSwitchChain();
  const { switchChainAsync, isPending: switching } = switchApi;

  // Prefer injected; else first connector if present
  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected") ?? null,
    [connectors]
  );
  const fallback = useMemo(
    () => injected ?? (connectors.length ? connectors[0] : null),
    [injected, connectors]
  );

  // Soft-switch to Base after connect (best-effort)
  useEffect(() => {
    if (!isConnected || chainId === base.id) return;
    (async () => {
      try {
        await switchChainAsync({ chainId: base.id });
      } catch {
        /* ignore */
      }
    })();
  }, [isConnected, chainId, switchChainAsync]);

  // Avoid SSR/CSR mismatch flash
  if (!mounted) {
    return (
      <button className="pill pill-opaque" style={{ opacity: 0, pointerEvents: "none" }}>
        …
      </button>
    );
  }

  const connecting =
    connectStatus === "pending" ||
    accountStatus === "connecting" ||
    accountStatus === "reconnecting";

  const label = isConnected
    ? `${address?.slice(0, 6)}…${address?.slice(-4)}`
    : connecting
    ? "Connecting…"
    : "Not Connected";

  const dotClass = isConnected ? "bg-[var(--accent)]" : "bg-[var(--danger)]";

  /* ───────── Popover (React state, no <details>) ───────── */
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      const target = e.target as Node | null;
      if (!menuRef.current.contains(target)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const safeConnect = async () => {
    try {
      if (error) reset(); // clear stale errors
      if (!fallback) return; // nothing to do, but don't throw
      await connect({ connector: fallback });
    } catch {
      // swallow errors so they never bubble to the app
    }
  };

  const onMainClick = async () => {
    if (!isConnected) {
      if (!connecting) await safeConnect();
      return; // do not open a menu when disconnected
    }
    setOpen((v) => !v);
  };

  const onCopy = async () => {
    try {
      if (address) await navigator.clipboard.writeText(address);
    } catch {}
    setOpen(false);
  };

  const onSwitchBase = async () => {
    try {
      await switchChainAsync({ chainId: base.id });
    } catch {}
    setOpen(false);
  };

  const onDisconnect = () => {
    try {
      disconnect();
    } catch {}
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={onMainClick}
        className={["pill", isConnected ? "pill-nav" : "pill-opaque"].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isConnected ? "Wallet menu" : "Connect wallet"}
        disabled={connecting}
      >
        <span aria-hidden className={`block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="ml-1.5">{label}</span>
      </button>

      {open && isConnected && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[220px] rounded-2xl glass shadow-soft p-2 z-50"
        >
          <div className="px-2 py-1.5 text-xs text-inkSub break-all">{address}</div>

          <button
            role="menuitem"
            className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
            onClick={onCopy}
          >
            Copy Address
          </button>

          {chainId !== base.id && (
            <button
              role="menuitem"
              className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
              onClick={onSwitchBase}
              disabled={switching}
              aria-busy={switching}
            >
              {switching ? "Switching…" : "Switch to Base"}
            </button>
          )}

          <button
            role="menuitem"
            className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1 text-danger"
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
