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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 10_000 },
  },
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/* small helpers */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
const pretty = (a?: `0x${string}`) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/** Detect Coinbase Wallet in-app browser. */
function isCoinbaseEnv() {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!w.ethereum?.isCoinbaseWallet || /CoinbaseWallet/i.test(navigator.userAgent);
}

export function WalletPill() {
  const mounted = useMounted();

  const { connectors, connect, isPending, status, error, reset } = useConnect();
  const { address, isConnected, isReconnecting } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  // pick best connector for this environment
  const cb = useMemo(
    () => connectors.find((c) => c.id === "coinbaseWalletSDK"),
    [connectors]
  );
  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected"),
    [connectors]
  );
  const preferred = isCoinbaseEnv() && cb?.ready ? cb : injected?.ready ? injected : undefined;

  /* 1) Auto-connect only once when we have a ready connector. */
  useEffect(() => {
    if (!mounted || !preferred) return;
    if (isConnected || isReconnecting) return;
    // Some wallets require a user gesture; if this throws we simply show the button.
    try {
      connect({ connector: preferred });
    } catch {
      /* ignored */
    }
  }, [mounted, preferred, isConnected, isReconnecting, connect]);

  /* 2) Auto-switch to Base after connect. */
  useEffect(() => {
    if (!isConnected) return;
    if (chainId !== base.id) {
      try {
        switchChain({ chainId: base.id });
      } catch {
        /* ignored */
      }
    }
  }, [isConnected, chainId, switchChain]);

  if (!mounted) return null;

  // No usable connector in this runtime
  if (!preferred) {
    return (
      <button
        className="pill pill-opaque opacity-70 cursor-not-allowed"
        title="Open in your wallet’s in-app browser (MetaMask, Coinbase, Rabby) or install a wallet extension."
        aria-disabled
      >
        No Wallet Detected
      </button>
    );
  }

  // Connected
  if (isConnected) {
    const wrong = chainId !== base.id;
    return (
      <button
        className={`pill ${wrong ? "pill-nav" : "pill-opaque"}`}
        onClick={() => (wrong ? switchChain({ chainId: base.id }) : disconnect())}
        disabled={isPending || switching}
        title={wrong ? "Switch to Base" : "Disconnect"}
      >
        {wrong ? "Switch to Base" : `${pretty(address)} · Disconnect`}
      </button>
    );
  }

  // Disconnected
  const label = isPending || status === "pending" ? "Connecting…" : "Connect";
  return (
    <button
      className="pill pill-opaque"
      disabled={isPending}
      onClick={() => {
        if (error) reset();
        connect({ connector: preferred });
      }}
      title={isCoinbaseEnv() ? "Connect with Coinbase Wallet" : "Connect injected wallet"}
    >
      {label}
    </button>
  );
}
