"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  ConnectButton,
  darkTheme,
  ConnectButtonCustom,
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

  // single QC instance; avoids cache resets across re-renders
  const qc = useMemo(() => new QueryClient(), []);

  // theme integrated w/ your CSS vars (no default blue)
  const rkTheme = useMemo(
    () =>
      darkTheme({
        accentColor: "var(--accent)",            // your theme accent
        accentColorForeground: "var(--ink)",     // your light ink text
        borderRadius: "large",
        overlayBlur: "large",
      }),
    []
  );

  if (!mounted) return null; // prevents SSR/CSR mismatch + hook timing issues

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

/** ---- Mobile pill with guaranteed modal open ----
 * Uses ConnectButton.Custom so a tap always opens the modal,
 * even if default button UI changes.
 */
export function ConnectPill(props?: { onBeforeOpen?: () => void }) {
  return (
    <div className="w-full flex justify-center">
      <ConnectButton.Custom>
        {({ mounted, account, chain, openConnectModal }) => {
          // while unmounted (SSR/first paint), render nothing interactive
          if (!mounted) {
            return <div className="pill pill-opaque w-full justify-center">Connect</div>;
          }

          const connected = mounted && account && chain;

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
              {connected ? `${account.displayName}` : "Connect"}
            </button>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
