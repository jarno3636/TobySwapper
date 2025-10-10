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

/* ---------- Providers ---------- */

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

/* ---------- Small helpers ---------- */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/* ---------- Injected-only, auto-connect pill ---------- */
export function WalletPill() {
  const mounted = useMounted();

  const { address, isConnected, isReconnecting } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected"),
    [connectors]
  );

  // Auto-connect to injected if available
  useEffect(() => {
    if (!mounted) return;
    if (!injected || !(injected as any).ready) return;
    if (isConnected || isReconnecting) return;
    try {
      connect({ connector: injected });
    } catch {
      /* some wallets require user gesture; ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, injected, isConnected, isReconnecting]);

  // After connect, quietly switch to Base if needed (best effort)
  useEffect(() => {
    if (!isConnected) return;
    if (chainId === base.id) return;
    switchChainAsync({ chainId: base.id }).catch(() => {});
  }, [isConnected, chainId, switchChainAsync]);

  if (!mounted) return null;

  // No wallet detected
  if (!injected || !(injected as any).ready) {
    return (
      <button
        type="button"
        className="pill pill-opaque opacity-70 cursor-not-allowed"
        title="Open this site in your wallet’s in-app browser or install a wallet extension"
        aria-disabled="true"
      >
        No Wallet Detected
      </button>
    );
  }

  // Connected
  if (isConnected) {
    const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Wallet";
    return (
      <button
        type="button"
        className="pill pill-nav"
        onClick={() => disconnect()}
        title="Disconnect wallet"
      >
        {short} (Disconnect)
      </button>
    );
  }

  // Disconnected
  const label = isPending ? "Connecting…" : "Connect";
  return (
    <button
      type="button"
      className="pill pill-opaque"
      disabled={isPending}
      onClick={() => {
        if (error) reset();
        connect({ connector: injected });
      }}
      title="Connect injected wallet"
    >
      {label}
    </button>
  );
}
