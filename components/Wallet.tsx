// components/Wallet.tsx
"use client";
import {
  RainbowKitProvider,
  darkTheme,
  Theme,
  ConnectButton,
  useConnectModal,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wallet";
import { base } from "viem/chains";
import { useMemo, useState } from "react";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());

  const tobyTheme: Theme = useMemo(() => {
    const baseT = darkTheme({
      accentColor: "#2ea0ff",
      accentColorForeground: "#0a0b12",
      borderRadius: "large",
      overlayBlur: "large",
    });
    return {
      ...baseT,
      colors: {
        ...baseT.colors,
        modalBackground: "rgba(15,15,20,0.98)",
        modalBorder: "rgba(255,255,255,0.06)",
        menuItemBackground: "rgba(255,255,255,0.08)",
        generalBorder: "rgba(255,255,255,0.08)",
      },
      radii: {
        ...baseT.radii,
        modal: "20px",
        connectButton: "9999px",
      },
    };
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={tobyTheme} modalSize="compact" initialChain={base}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Desktop chip — simple RainbowKit button inside a pill */
export function WalletPill() {
  return (
    <div className="pill glass">
      <span className="pip pip-a" />
      <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
    </div>
  );
}

/** Mobile-friendly chip — closes any sheet first, then opens RainbowKit modal */
export function ConnectPill({ onBeforeOpen }: { onBeforeOpen?: () => void }) {
  const { openConnectModal } = useConnectModal();
  return (
    <button
      className="pill glass w-full justify-center"
      onClick={() => {
        onBeforeOpen?.();
        openConnectModal?.();
      }}
    >
      <span className="pip pip-a" />
      Connect Wallet
    </button>
  );
}
