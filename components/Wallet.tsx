// components/Wallet.tsx
"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  ConnectButton,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider, useConnect, useDisconnect } from "wagmi";
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
        <RainbowKitProvider modalSize="compact" initialChain={base} theme={rkTheme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Reusable pill for header & mobile */
function PillButton({ fullWidth = false }: { fullWidth?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ mounted, account, chain, openConnectModal, openAccountModal }) => {
        const connected = mounted && !!account && !!chain;
        const onClick = () => (connected ? openAccountModal() : openConnectModal());
        const label = connected ? account.displayName : "Connect";
        return (
          <button
            type="button"
            onClick={onClick}
            className={`pill pill-opaque ${fullWidth ? "w-full justify-center" : ""}`}
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

/** ——— Optional tiny helpers used by the Brand debug ——— */
export function ForceInjectedButton() {
  const { connectors, connectAsync } = useConnect();
  const injected = connectors.find((c) => c.type === "injected");
  if (!injected) return null;
  return (
    <button
      className="pill pill-opaque px-3 py-1 text-xs"
      onClick={() => connectAsync({ connector: injected })}
      title="Connect via Injected (in-app browsers / extensions)"
    >
      Use Injected
    </button>
  );
}

export function ForceWalletConnectButton() {
  const { connectors, connectAsync } = useConnect();
  const wc = connectors.find((c) => c.id === "walletConnect");
  if (!wc) return null;
  return (
    <button
      className="pill pill-opaque px-3 py-1 text-xs"
      onClick={() => connectAsync({ connector: wc })}
      title="Open WalletConnect modal"
    >
      Use WalletConnect
    </button>
  );
}

export function ResetWalletCacheButton() {
  const { disconnect } = useDisconnect();
  const reset = async () => {
    try {
      disconnect();
      localStorage.removeItem("wagmi.store");
      localStorage.removeItem("wc");
      // some WC SDKs store with other keys too; clear generically:
      Object.keys(localStorage)
        .filter((k) => k.toLowerCase().includes("walletconnect"))
        .forEach((k) => localStorage.removeItem(k));
      location.reload();
    } catch {
      location.reload();
    }
  };
  return (
    <button className="pill pill-opaque px-3 py-1 text-xs" onClick={reset} title="Clear local wallet cache">
      Reset Wallet Cache
    </button>
  );
}
