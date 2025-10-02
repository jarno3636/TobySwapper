// components/Wallet.tsx
"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wallet";
import { base } from "viem/chains";
import { useState } from "react";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        {/* Default RainbowKit (no custom theme). */}
        <RainbowKitProvider initialChain={base}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Simple connect button for desktop header */
export function WalletPill() {
  return <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />;
}

/** Simple connect button for the mobile menu (keeps your API, no custom modal logic) */
export function ConnectPill(_props?: { onBeforeOpen?: () => void }) {
  return (
    <div className="w-full flex justify-center">
      <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
    </div>
  );
}
