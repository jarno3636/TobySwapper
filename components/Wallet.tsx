// components/Wallet.tsx
"use client";

import "@rainbow-me/rainbowkit/styles.css";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import {
  RainbowKitProvider,
  darkTheme,
  useChainModal,
  useConnectModal,
} from "@rainbow-me/rainbowkit";
import { base } from "viem/chains";
import { wagmiConfig } from "@/lib/wallet";
import { useAccount, useChainId } from "wagmi";

// ✅ Import Connect for local use in this file
import Connect from "./Connect";

// (re-)export for other files to import if they want
export { default as Connect } from "./Connect";

/* React Query */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: { retry: 0 },
  },
});

/* RainbowKit theme */
const rkTheme = darkTheme({
  accentColor: "var(--accent)",
  accentColorForeground: "var(--ink)",
  borderRadius: "large",
  overlayBlur: "small",
});

/* Soft chain gate helper */
function ChainGate({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();
  const onBase = chainId === base.id;

  return (
    <>
      {children}
      <div
        aria-live="polite"
        className={[
          "pointer-events-none fixed inset-x-0 bottom-2 z-[9999] flex justify-center px-2",
          onBase ? "hidden" : "",
        ].join(" ")}
      >
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/70 px-3 py-1.5 text-xs text-amber-200 backdrop-blur">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" aria-hidden />
          {isConnected ? (
            <>
              <span>Wrong network — switch to Base</span>
              <button
                onClick={openChainModal}
                className="rounded-full border border-amber-400/50 px-2 py-0.5 text-amber-100 hover:bg-amber-400/10 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
              >
                Switch
              </button>
            </>
          ) : (
            <>
              <span>Connect your wallet to continue</span>
              <button
                onClick={openConnectModal}
                className="rounded-full border border-amber-400/50 px-2 py-0.5 text-amber-100 hover:bg-amber-400/10 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
              >
                Connect
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* Providers root */
export function WalletProvider({ children }: { children: ReactNode }) {
  const theme = useMemo(() => rkTheme, []);
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider
          theme={theme}
          initialChain={base}
          modalSize="compact"
          appInfo={{ appName: "Toby Swapper" }}
        >
          <ChainGate>{children}</ChainGate>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

/* Header buttons */
export function WalletPill() {
  return <Connect />;
}
export function ConnectPill() {
  return <Connect compact />;
}
