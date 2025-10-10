"use client";

import { useEffect } from "react";
import { WagmiProvider, useAccount, useConnect, useDisconnect } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wallet";
import { base } from "viem/chains";

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/* Auto-connect pill: instantly connects if injected wallet is available */
export function WalletPill() {
  const { connect, connectors, isPending } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const injected = connectors.find((c) => c.id === "injected");

  useEffect(() => {
    if (!isConnected && injected?.ready) {
      connect({ connector: injected });
    }
  }, [isConnected, injected, connect]);

  if (!injected?.ready) {
    return (
      <button className="pill pill-opaque opacity-70 cursor-not-allowed">
        No Wallet Detected
      </button>
    );
  }

  if (isConnected) {
    return (
      <button
        className="pill pill-nav"
        onClick={() => disconnect()}
        disabled={isPending}
      >
        {address?.slice(0, 6)}…{address?.slice(-4)} (Disconnect)
      </button>
    );
  }

  return (
    <button
      className="pill pill-opaque"
      disabled={isPending}
      onClick={() => connect({ connector: injected })}
    >
      {isPending ? "Connecting…" : "Connect"}
    </button>
  );
}
