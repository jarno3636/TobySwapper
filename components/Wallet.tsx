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

/* ───────────────────────── Providers ───────────────────────── */

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

/** Wrap app with Wagmi + React Query (client only). */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/* ───────────────────────── Injected-only Pill ─────────────────────────
   - Auto-connect to injected when available (DApp browsers)
   - Soft-switch to Base after connection
   - Connected state shows address + clear Disconnect
   - Status dot: accent (light blue) when connected, red when not
----------------------------------------------------------------------- */
export function WalletPill() {
  const mounted = useMounted();

  const { address, isConnected, status: accountStatus } = useAccount(); // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  const chainId = useChainId();

  const {
    connectors,
    connect,
    status: connectStatus, // 'idle' | 'pending' | 'success' | 'error'
    error,
    reset,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected"),
    [connectors]
  );

  // 1) Auto-connect to injected if available (only after mount to avoid SSR mismatch)
  useEffect(() => {
    if (!mounted) return;
    if (!injected || !(injected as any).ready) return;
    if (isConnected || accountStatus === "reconnecting" || accountStatus === "connecting") return;
    try {
      // Some wallets require a user gesture; if they block this, it's fine—UI still works on click.
      connect({ connector: injected });
    } catch {
      /* ignored */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, injected, isConnected, accountStatus]);

  // 2) After connect, softly switch to Base (no hard error if it fails)
  useEffect(() => {
    if (!isConnected) return;
    if (chainId === base.id) return;
    switchChainAsync({ chainId: base.id }).catch(() => {});
  }, [isConnected, chainId, switchChainAsync]);

  // 3) Prevent SSR/CSR mismatch flicker
  if (!mounted) {
    return (
      <button className="pill pill-opaque" style={{ opacity: 0, pointerEvents: "none" }}>
        …
      </button>
    );
  }

  // Status helpers
  const connecting = connectStatus === "pending" || accountStatus === "connecting" || accountStatus === "reconnecting";
  const dotClassConnected = "bg-[var(--accent)]"; // light blue from your theme
  const dotClassDisconnected = "bg-[var(--danger)]"; // red from your theme

  // 4) No injected wallet detected
  if (!injected || !(injected as any).ready) {
    return (
      <button
        type="button"
        className="pill pill-opaque opacity-70 cursor-not-allowed"
        title="Open this site in your wallet’s in-app browser or install a wallet extension"
        aria-disabled="true"
      >
        <span aria-hidden className={`block h-2 w-2 rounded-full ${dotClassDisconnected}`} />
        <span className="ml-1.5">No Wallet Detected</span>
      </button>
    );
  }

  // 5) Connected: show address + clear Disconnect
  if (isConnected && address) {
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    return (
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={`block h-2 w-2 rounded-full ${dotClassConnected}`}
          title="Connected"
        />
        <button
          type="button"
          className="pill pill-nav"
          onClick={() => disconnect()}
          title="Disconnect wallet"
          aria-label="Disconnect wallet"
        >
          {short}
          <span className="opacity-80 text-xs ml-1.5">· Disconnect</span>
        </button>
      </div>
    );
  }

  // 6) Disconnected: connect injected on click
  const label = connecting ? "Connecting…" : "Connect Wallet";
  return (
    <button
      type="button"
      className="pill pill-opaque"
      disabled={connecting}
      onClick={() => {
        if (error) reset(); // clear stale error state
        connect({ connector: injected });
      }}
      title="Connect injected wallet"
      aria-busy={connecting}
    >
      <span
        aria-hidden
        className={`block h-2 w-2 rounded-full ${dotClassDisconnected}`}
      />
      <span className="ml-1.5">{label}</span>
    </button>
  );
}
