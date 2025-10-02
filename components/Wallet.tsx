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

  // Toby-styled RainbowKit theme (opaque, centered modal)
  const tobyTheme: Theme = useMemo(() => {
    const t = darkTheme({
      accentColor: "#2ea0ff",
      accentColorForeground: "#0a0b12",
      borderRadius: "large",
      overlayBlur: "large",
    });
    return {
      ...t,
      colors: {
        ...t.colors,
        overlayBackground: "rgba(0,0,0,0.75)",
        modalBackground: "rgba(15,15,20,0.98)",
        modalBorder: "rgba(255,255,255,0.08)",
        generalBorder: "rgba(255,255,255,0.10)",
        menuItemBackground: "rgba(255,255,255,0.08)",
        closeButtonBackground: "rgba(255,255,255,0.10)",
        connectButtonBackground: "rgba(255,255,255,0.10)",
      },
      radii: { ...t.radii, modal: "20px", connectButton: "9999px" },
    };
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        {/* IMPORTANT: no modalSize="compact" → forces centered modal instead of mobile bottom-sheet */}
        <RainbowKitProvider theme={tobyTheme} initialChain={base}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Desktop connect pill
export function WalletPill() {
  return (
    <div className="pill pill-opaque">
      <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
    </div>
  );
}

// Mobile menu connect button (closes sheet before opening modal)
export function ConnectPill({ onBeforeOpen }: { onBeforeOpen?: () => void }) {
  const { openConnectModal } = useConnectModal();
  return (
    <button
      className="pill pill-opaque w-full justify-center"
      onClick={() => {
        onBeforeOpen?.();
        openConnectModal?.();
      }}
    >
      Connect Wallet
    </button>
  );
}
