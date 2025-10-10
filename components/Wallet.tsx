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
import { wagmiConfig } from "@/lib/wallet";
import { base } from "viem/chains";

/* -------------------- Query client (cache tuning) -------------------- */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10_000,
      gcTime: 60 * 60 * 1000,
    },
  },
});

/* -------------------- Root provider -------------------- */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/* -------------------- Helpers -------------------- */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function pretty(addr?: `0x${string}`) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

/* -------------------- Wallet Pill -------------------- */
export function WalletPill() {
  const mounted = useMounted();

  const { connectors, connect, isPending, status, error, reset } = useConnect();
  const { address, isConnected, isReconnecting } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  // Prefer the injected connector (MetaMask, Rabby, Coinbase in-app, etc.)
  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected"),
    [connectors]
  );

  /* ---------- 1. Auto-connect injected ---------- */
  useEffect(() => {
    if (!mounted) return;
    if (!injected?.ready) return; // no provider in runtime
    if (isConnected || isReconnecting) return;
    try {
      connect({ connector: injected });
    } catch {
      /* ignore */
    }
  }, [mounted, injected, isConnected, isReconnecting, connect]);

  /* ---------- 2. Auto-switch to Base ---------- */
  useEffect(() => {
    if (!isConnected) return;
    if (chainId !== base.id) {
      try {
        switchChain({ chainId: base.id });
      } catch {
        /* ignore */
      }
    }
  }, [isConnected, chainId, switchChain]);

  /* ---------- 3. Render states ---------- */
  if (!mounted) return null;

  // No injected wallet found (plain browser)
  if (!injected?.ready) {
    return (
      <button
        className="pill pill-opaque opacity-70 cursor-not-allowed"
        title="Open this site in your wallet’s in-app browser (MetaMask, Coinbase Wallet, Rabby) to auto-connect."
        aria-disabled
      >
        No Wallet Detected
      </button>
    );
  }

  // Connected
  if (isConnected) {
    const wrongNet = chainId !== base.id;
    return (
      <div className="flex items-center gap-2">
        <button
          className={`pill ${wrongNet ? "pill-nav" : "pill-opaque"}`}
          onClick={() =>
            wrongNet ? switchChain({ chainId: base.id }) : disconnect()
          }
          disabled={isPending || switching}
          title={wrongNet ? "Switch to Base" : "Disconnect"}
        >
          {wrongNet ? "Switch to Base" : `${pretty(address)} · Disconnect`}
        </button>
      </div>
    );
  }

  // Disconnected – show connect button
  const label = isPending ? "Connecting…" : "Connect Wallet";

  return (
    <button
      className="pill pill-opaque"
      disabled={isPending}
      onClick={() => {
        if (error) reset();
        try {
          connect({ connector: injected });
        } catch {
          /* ignore */
        }
      }}
      title="Connect injected wallet"
    >
      {label}
    </button>
  );
}
