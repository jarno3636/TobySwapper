"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useChainId } from "wagmi";
import {
  RainbowKitProvider,
  darkTheme,
  useChainModal,
  useConnectModal,
} from "@rainbow-me/rainbowkit";
import { base } from "viem/chains";
import { wagmiConfig } from "@/lib/wallet";
import FarcasterMiniBridge from "@/components/FarcasterMiniBridge";
import FarcasterMiniAutoConnect from "@/components/FarcasterMiniAutoConnect";

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

/* Theme */
const rkTheme = darkTheme({
  accentColor: "#79ffe1", // match your --accent
  accentColorForeground: "#0a0b12", // on-accent
  borderRadius: "large",
  overlayBlur: "small",
});

/* Optional: soft Base gate toast */
function ChainGate({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();

  const onBase = chainId === base.id;

  return (
    <>
      {children}
      {!onBase && (
        <div className="fixed bottom-3 inset-x-0 z-[60] flex justify-center px-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/70 px-3 py-1.5 text-xs text-amber-200 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {isConnected ? (
              <>
                <span>Wrong network — switch to Base</span>
                <button
                  onClick={openChainModal}
                  className="rounded-full border border-amber-400/50 px-2 py-0.5 hover:bg-amber-400/10"
                >
                  Switch
                </button>
              </>
            ) : (
              <>
                <span>Connect your wallet</span>
                <button
                  onClick={openConnectModal}
                  className="rounded-full border border-amber-400/50 px-2 py-0.5 hover:bg-amber-400/10"
                >
                  Connect
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  const theme = useMemo(() => rkTheme, []);
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider
          theme={theme}
          initialChain={base}
          modalSize="compact"
          appInfo={{ appName: "TobySwapper" }}
        >
          {/* ✅ Farcaster Mini support */}
          <FarcasterMiniBridge />
          <FarcasterMiniAutoConnect />

          <ChainGate>{children}</ChainGate>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
