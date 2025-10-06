"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  ConnectButton,   // ← keep this
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

/** ---- Desktop header button — themed pill wrapper ---- */
export function WalletPill() {
  return (
    <div className="pill pill-opaque">
      <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
    </div>
  );
}

/** ---- Mobile pill using ConnectButton.Custom ---- */
export function ConnectPill(props?: { onBeforeOpen?: () => void }) {
  return (
    <div className="w-full flex justify-center">
      <ConnectButton.Custom>
        {({ mounted, account, chain, openConnectModal }) => {
          if (!mounted) return <div className="pill pill-opaque w-full justify-center">Connect</div>;

          const connected = !!(account && chain);
          const handleClick = () => {
            props?.onBeforeOpen?.();
            openConnectModal();
          };

          return (
            <button
              type="button"
              onClick={handleClick}
              className="pill pill-opaque w-full justify-center"
              aria-label={connected ? "Wallet connected" : "Connect wallet"}
            >
              {connected ? account.displayName : "Connect"}
            </button>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
