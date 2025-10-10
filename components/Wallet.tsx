// components/Wallet.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

/* ───────── Injected-only Pill with <details> popover ─────────
   - No document listeners (stable in wallet browsers)
   - Auto-connect (best-effort) + soft switch to Base
   - Status dot + Not Connected label
---------------------------------------------------------------- */
export function WalletPill() {
  const mounted = useMounted();

  const { address, isConnected, status: accountStatus } = useAccount(); // 'connected' | 'reconnecting' | 'connecting' | 'disconnected'
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

  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected"),
    [connectors]
  );

  // Auto-connect to injected if available (DApp browsers); safe best-effort
  useEffect(() => {
    if (!mounted) return;
    if (!injected || !(injected as any).ready) return;
    if (isConnected || accountStatus === "reconnecting" || accountStatus === "connecting") return;
    try {
      connect({ connector: injected });
    } catch {
      /* some wallets block programmatic connect; user can click Connect */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, injected, isConnected, accountStatus]);

  // Soft switch to Base after connect
  useEffect(() => {
    if (!isConnected) return;
    if (chainId === base.id) return;
    switchChainAsync({ chainId: base.id }).catch(() => {});
  }, [isConnected, chainId, switchChainAsync]);

  // Prevent SSR/CSR mismatch
  if (!mounted) {
    return (
      <button className="pill pill-opaque" style={{ opacity: 0, pointerEvents: "none" }}>
        …
      </button>
    );
  }

  const notDetected = !injected || !(injected as any).ready;
  const connecting =
    connectStatus === "pending" ||
    accountStatus === "connecting" ||
    accountStatus === "reconnecting";

  const label = isConnected
    ? `${address?.slice(0, 6)}…${address?.slice(-4)}`
    : connecting
    ? "Connecting…"
    : notDetected
    ? "No Wallet Detected"
    : "Not Connected";

  const dotClass = isConnected ? "bg-[var(--accent)]" : "bg-[var(--danger)]";

  // Popover actions
  const onConnect = () => {
    if (!injected) return;
    if (error) reset();
    connect({ connector: injected });
  };
  const onDisconnect = () => disconnect();
  const onSwitchBase = () => switchChainAsync({ chainId: base.id });

  // Native <details> avoids global listeners and is keyboard accessible
  return (
    <details className="relative group">
      <summary
        className={[
          "list-none inline-flex items-center gap-1 cursor-pointer select-none",
          "pill",
          isConnected ? "pill-nav" : "pill-opaque",
          notDetected ? "opacity-70 cursor-not-allowed" : "",
        ].join(" ")}
        // prevent opening when no wallet is detected
        onClick={(e) => {
          if (notDetected) e.preventDefault();
        }}
        aria-label="Wallet menu"
      >
        <span aria-hidden className={`block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="ml-1.5">{label}</span>
      </summary>

      {/* Popover panel */}
      <div
        className="absolute right-0 mt-2 min-w-[220px] rounded-2xl glass shadow-soft p-2 z-50"
        // close the popover when it loses focus
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            (e.currentTarget.parentElement as HTMLDetailsElement)?.removeAttribute("open");
          }
        }}
        // click on any button should close afterwards (native behavior on summary click only)
        onClick={() => {
          // close only if the click is not on the summary (which toggles)
          const d = (event?.currentTarget as HTMLElement)?.closest("details") as HTMLDetailsElement | null;
          d?.removeAttribute("open");
        }}
      >
        {isConnected && address ? (
          <>
            <div className="px-2 py-1.5 text-xs text-inkSub break-all">{address}</div>
            <button
              className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
              onClick={async (e) => {
                e.stopPropagation();
                try { await navigator.clipboard.writeText(address); } catch {}
              }}
            >
              Copy Address
            </button>
            {chainId !== base.id && (
              <button
                className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
                onClick={(e) => { e.stopPropagation(); onSwitchBase(); }}
                disabled={switching}
                aria-busy={switching}
              >
                {switching ? "Switching…" : "Switch to Base"}
              </button>
            )}
            <button
              className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1 text-danger"
              onClick={(e) => { e.stopPropagation(); onDisconnect(); }}
            >
              Disconnect
            </button>
          </>
        ) : notDetected ? (
          <div className="px-2 py-1.5 text-xs text-inkSub">
            No injected wallet detected. Open in a wallet’s in-app browser (MetaMask, Coinbase, Rabby, OKX, etc.) or install an extension.
          </div>
        ) : (
          <>
            <div className="px-2 py-1.5 text-xs text-inkSub">Injected wallet available.</div>
            <button
              className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
              onClick={(e) => { e.stopPropagation(); onConnect(); }}
              disabled={connecting}
              aria-busy={connecting}
            >
              {connecting ? "Connecting…" : "Connect (Injected)"}
            </button>
            <div className="px-2 py-1.5 text-[11px] text-inkSub">
              Tip: if nothing happens, your wallet may require a tap inside its browser.
            </div>
          </>
        )}
      </div>
    </details>
  );
}
