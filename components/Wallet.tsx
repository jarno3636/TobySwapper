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
import { wagmiConfig } from "@/lib/wallet";
import { base } from "viem/chains";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

const pretty = (a?: `0x${string}`) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const useMounted = () => {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
};
const isWalletBrowser = () => {
  if (typeof window === "undefined") return false;
  const eth: any = (window as any).ethereum;
  // any injected EIP-1193 provider counts
  return !!eth || /MetaMask|Rabby|OKX|CoinbaseWallet/i.test(navigator.userAgent);
};

export function WalletPill() {
  const mounted = useMounted();
  const inWalletUa = isWalletBrowser();

  const { connectors, connect, status, isPending, error, reset } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();

  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected"),
    [connectors]
  );

  // 1) Auto-connect in wallet UAs (once)
  useEffect(() => {
    if (!mounted || !injected?.ready || !inWalletUa) return;
    if (isConnected) return;
    try {
      connect({ connector: injected });
    } catch {
      /* some wallets require user gesture; button below remains */
    }
  }, [mounted, injected, inWalletUa, isConnected, connect]);

  // 2) Auto-switch to Base once connected
  useEffect(() => {
    if (!isConnected) return;
    if (chainId !== base.id) {
      try {
        switchChain({ chainId: base.id });
      } catch {}
    }
  }, [isConnected, chainId, switchChain]);

  if (!mounted) return null;

  // connected state
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

  // not connected — show a clear instruction based on environment
  if (!injected?.ready) {
    // no injected provider => tell user how to open the dapp
    return (
      <a
        className="pill pill-opaque"
        href={typeof window !== "undefined" ? window.location.href : "/"}
        title="Open this link inside your wallet’s in-app browser (MetaMask, Coinbase, Rabby)"
      >
        Open in Wallet App
      </a>
    );
  }

  const label = isPending || status === "pending" ? "Connecting…" : "Connect";
  return (
    <button
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
