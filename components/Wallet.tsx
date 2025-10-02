"use client";
import {
  RainbowKitProvider,
  darkTheme,
  Theme,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wallet";
import { base } from "viem/chains";
import { useMemo, useState } from "react";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());

  // Toby blue + opaque modal
  const tobyTheme: Theme = useMemo(() => {
    const baseTheme = darkTheme({
      accentColor: "#2ea0ff",           // Toby blue accent
      accentColorForeground: "#0a0b12",
      borderRadius: "large",
      overlayBlur: "large",
    });
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        modalBackground: "rgba(15,15,20,0.98)", // nearly opaque
        modalBorder: "rgba(255,255,255,0.06)",
        menuItemBackground: "rgba(255,255,255,0.08)",
        closeButtonBackground: "rgba(255,255,255,0.08)",
        connectButtonBackground: "rgba(255,255,255,0.08)",
        generalBorder: "rgba(255,255,255,0.08)",
      },
      radii: {
        ...baseTheme.radii,
        modal: "20px",
        connectButton: "9999px",
      },
    };
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider
          theme={tobyTheme}
          modalSize="compact"
          initialChain={base}
          appInfo={{ appName: "TobySwap" }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
