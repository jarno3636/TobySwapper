"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, ConnectButton, darkTheme } from "@rainbow-me/rainbowkit";
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
        {/* Minimal change: dark theme only (keeps default modal behavior) */}
        <RainbowKitProvider
          initialChain={base}
          theme={darkTheme({
            accentColor: "#2ea0ff",            // matches your blue
            accentColorForeground: "#0a0b12",  // readable on blue
            borderRadius: "large",
            overlayBlur: "large",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Desktop header button — styled as opaque pill to match theme */
export function WalletPill() {
  return (
    <div className="pill pill-opaque">
      <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
    </div>
  );
}

/** Mobile menu button — same pill styling, no custom modal logic */
export function ConnectPill(_props?: { onBeforeOpen?: () => void }) {
  return (
    <div className="w-full flex justify-center">
      <div className="pill pill-opaque w-full justify-center">
        <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
      </div>
    </div>
  );
}
