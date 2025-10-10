// components/Wallet.tsx
"use client";

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

/* ───────── Injected-first Pill + <details> popover ─────────
   - One-click connect (no auto-connect)
   - Always shows "Not Connected" when not connected
   - Popover: Copy / Switch to Base / Disconnect
   - Catches all connector errors to avoid client-side exception
---------------------------------------------------------------- */
export function WalletPill() {
  const mounted = useMounted();

  const { address, isConnected, status: accountStatus } = useAccount();
  const chainId = useChainId();

  const {
    connectors,
    connect,
    status: connectStatus, // 'idle' | 'pending' | 'success' | 'error'
    error,
    reset,
  } = useConnect();

  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  // Prefer injected, otherwise fall back to the first connector (if any)
  const injected = useMemo(
    () => connectors?.find?.((c) => c.id === "injected") ?? null,
    [connectors]
  );
  const fallback = useMemo(
    () => injected ?? (connectors && connectors[0]) ?? null,
    [injected, connectors]
  );

  // Soft switch to Base once connected (best-effort)
  useEffect(() => {
    (async () => {
      if (!isConnected) return;
      if (chainId === base.id) return;
      try {
        await switchChainAsync({ chainId: base.id });
      } catch {
        // ignored – user stays on current chain, UI still works
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
    } catch (e) {
      // fully swallow to avoid "Application error"
      // (optional) console.debug("connect error", e);
    }
  };

  const onConnect = () => {
    if (connecting) return;
    void safeConnect();
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
  // - Not connected → click attempts connect (does NOT open menu)
  // - Connected → click toggles the <details> menu
  const onSummaryClick: React.MouseEventHandler<HTMLElement> = (e) => {
    if (!isConnected) {
      e.preventDefault(); // stop <details> from toggling
      if (!connecting) onConnect();
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
        aria-label={isConnected ? "
