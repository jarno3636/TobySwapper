"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  ConnectButton,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wallet";
import { base } from "viem/chains";
import { useEffect, useMemo, useState } from "react";

/** ---- Provider Root (stable QC + mounted guard) ---- */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const qc = useMemo(() => new QueryClient(), []);
  const rkTheme = useMemo(
    () =>
      darkTheme({
        accentColor: "var(--accent)",
        accentColorForeground: "var(--ink)",
        borderRadius: "large",
        overlayBlur: "large",
      }),
    []
  );

  if (!mounted) return null;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider
          modalSize="compact"
          initialChain={base}
          appInfo={{ appName: "Toby Swapper" }}
          theme={rkTheme}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Reusable pill renderer for both desktop + mobile */
function PillButton({ fullWidth = false }: { fullWidth?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({
        mounted,
        account,
        chain,
        openConnectModal,
        openAccountModal,
      }) => {
        const connected = mounted && !!account && !!chain;

        const onClick = () =>
          connected ? openAccountModal() : openConnectModal();

        const label = connected ? account.displayName : "Connect";

        return (
          <button
            type="button"
            onClick={onClick}
            className={`pill pill-opaque ${
              fullWidth ? "w-full justify-center" : ""
            }`}
            aria-label={connected ? "Manage wallet" : "Connect wallet"}
            title={connected ? "Manage / Disconnect" : "Connect wallet"}
          >
            {label}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

export function WalletPill() {
  return <PillButton />;
}

export function ConnectPill() {
  return (
    <div className="w-full flex justify-center">
      <PillButton fullWidth />
    </div>
  );
}
