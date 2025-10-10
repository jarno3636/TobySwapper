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

/* ───────── Injected-first Pill + popover ─────────
   - One-click connect (no auto-connect)
   - Disconnected label: "Not Connected"
   - Popover (only when connected): Copy / Switch to Base / Disconnect
   - Catches errors from wagmi to avoid client-side exceptions
---------------------------------------------------------------- */
export function WalletPill() {
  const mounted = useMounted();

  const { address, isConnected, status: accountStatus } = useAccount();
  const chainId = useChainId();

  const {
    connectors = [],
    connect,
    status: connectStatus, // 'idle' | 'pending' | 'success' | 'error'
    error,
    reset,
  } = useConnect();

  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  // Prefer injected; else first connector if present
  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected") ?? null,
    [connectors]
  );
  const fallback = useMemo(
    () => injected ?? (connectors.length ? connectors[0] : null),
    [injected, connectors]
  );

  // Soft switch to Base once connected (best-effort)
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

  // Popover helpers
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => detailsRef.current?.removeAttribute("open");

  const safeConnect = async () => {
    try {
      if (error) reset(); // clear stale errors
      if (!fallback) return;
      await connect({ connector: fallback });
    } catch {
      // swallow errors so they never bubble to the app
    }
  };

  const onConnect = () => {
    if (!connecting) void safeConnect();
  };

  const onDisconnect = () => {
    try {
      disconnect();
    } catch {}
    closeMenu();
  };

  const onSwitchBase = async () => {
    try {
      await switchChainAsync({ chainId: base.id });
    } catch {}
    closeMenu();
  };

  // One-click behavior:
  // - Not connected → clicking the pill attempts connect (does NOT open menu)
  // - Connected → click toggles the <details> menu
  const onSummaryClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!isConnected) {
      e.preventDefault(); // stop <details> from toggling
      onConnect();
    }
  };

  return (
    <details ref={detailsRef} className="relative group">
      <summary
        className={[
          "list-none inline-flex items-center gap-1 cursor-pointer select-none",
          "pill",
          isConnected ? "pill-nav" : "pill-opaque",
        ].join(" ")}
        onClick={onSummaryClick}
        aria-label={isConnected ? "Wallet menu" : "Connect wallet"}
      >
        <span aria-hidden className={`block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="ml-1.5">{label}</span>
      </summary>

      {/* Popover panel (rendered only when connected) */}
      {isConnected && address ? (
        <div
          className="absolute right-0 mt-2 min-w-[220px] rounded-2xl glass shadow-soft p-2 z-50"
          onKeyDown={(e) => {
            if (e.key === "Escape") closeMenu();
          }}
        >
          <div className="px-2 py-1.5 text-xs text-inkSub break-all">{address}</div>

          <button
            className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(address);
              } catch {}
              closeMenu();
            }}
          >
            Copy Address
          </button>

          {chainId !== base.id && (
            <button
              className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
              onClick={onSwitchBase}
              disabled={switching}
              aria-busy={switching}
            >
              {switching ? "Switching…" : "Switch to Base"}
            </button>
          )}

          <button
            className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1 text-danger"
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </details>
  );
}
