"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useMemo, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useChainId } from "wagmi";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
  useChainModal,
  useConnectModal,
} from "@rainbow-me/rainbowkit";
import { base } from "viem/chains";
import { wagmiConfig } from "@/lib/wallet";

import FarcasterMiniBridge from "@/components/FarcasterMiniBridge";
import FarcasterMiniAutoConnect from "@/components/FarcasterMiniAutoConnect";
import FarcasterProfileMemory from "@/components/FarcasterProfileMemory";
import WalletSessionResilience from "@/components/WalletSessionResilience";

/* ---------------- React Query ---------------- */

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

/* ---------------- RainbowKit Theme ---------------- */

const rkLightTheme = lightTheme({
  accentColor: "#179ee6",
  accentColorForeground: "#ffffff",
  borderRadius: "large",
  overlayBlur: "small",
});

const rkDarkTheme = darkTheme({
  accentColor: "#55c8d8",
  accentColorForeground: "#071719",
  borderRadius: "large",
  overlayBlur: "small",
});

/* ---------------- Base chain soft gate ---------------- */

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
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/30 bg-white/95 px-3 py-1.5 text-xs text-amber-800 shadow-soft backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {isConnected ? (
              <>
                <span>Wrong network — switch to Base</span>
                <button
                  onClick={openChainModal}
                  className="rounded-full border border-amber-500/30 px-2 py-0.5 hover:bg-amber-500/10"
                >
                  Switch
                </button>
              </>
            ) : (
              <>
                <span>Connect your wallet</span>
                <button
                  onClick={openConnectModal}
                  className="rounded-full border border-amber-500/30 px-2 py-0.5 hover:bg-amber-500/10"
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

/* ---------------- ROOT PROVIDERS ---------------- */

export default function Providers({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme === "dark");
    read();

    const onTheme = () => read();
    window.addEventListener("tobyswap:theme-change", onTheme);
    return () => window.removeEventListener("tobyswap:theme-change", onTheme);
  }, []);

  const theme = useMemo(() => (dark ? rkDarkTheme : rkLightTheme), [dark]);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <WalletSessionResilience />
        <RainbowKitProvider
          theme={theme}
          initialChain={base}
          modalSize="compact"
          appInfo={{ appName: "TobySwapper" }}
        >
          {/* Mini App bootstrapping */}
          <FarcasterMiniBridge />
          <FarcasterMiniAutoConnect />
          <FarcasterProfileMemory />

          <ChainGate>{children}</ChainGate>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
