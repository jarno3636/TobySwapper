// components/Wallet.tsx
"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  darkTheme,
  ConnectButton,
  useConnectModal,
  useChainModal,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WagmiProvider,
  useAccount,
  useChainId,
  useReconnect,
} from "wagmi";
import { wagmiConfig } from "@/lib/wallet";
import { base } from "viem/chains";
import { useEffect, useMemo } from "react";

/* ---------------- Reconnector (wagmi v2) ----------------
   Restores the last session so RainbowKit shows options
   AND re-enables a clean “Reconnect” after disconnect. */
function Reconnector() {
  const { reconnect } = useReconnect();
  useEffect(() => {
    reconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/* ---------------- Providers root ---------------- */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const qc = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            gcTime: 60 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      }),
    []
  );

  const theme = useMemo(
    () =>
      darkTheme({
        accentColor: "var(--accent)",
        accentColorForeground: "var(--ink)",
        borderRadius: "large",
        overlayBlur: "large",
      }),
    []
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider
          theme={theme}
          initialChain={base}
          modalSize="compact"
          appInfo={{ appName: "Toby Swapper" }}
        >
          <Reconnector />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/* ---------------- Minimal, reliable Connect pill ----------------
   - When disconnected: opens full RK modal (Injected + CB + WC)
   - When connected & wrong chain: opens Switch modal
   - When connected & on Base: opens Account modal (has Disconnect)
*/
function truncate(addr?: string, left = 4, right = 4) {
  if (!addr) return "";
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

export default function Connect({ compact = false }: { compact?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({
        openConnectModal,
        openAccountModal,
        openChainModal,
        mounted,
        account,
        chain,
      }) => {
        const ready = mounted; // hydrate-safe
        const connected = ready && !!account?.address;
        const onBase = connected && chain?.id === base.id && !chain?.unsupported;

        const showSwitch = connected && !onBase;
        const onClick = showSwitch
          ? openChainModal
          : connected
          ? openAccountModal
          : openConnectModal;

        const addr = account?.address;
        const label = connected ? truncate(addr) : "Connect";

        const text = showSwitch
          ? "Switch to Base"
          : connected
          ? compact
            ? (
              <>
                <span className="sm:hidden">Acct</span>
                <span className="hidden sm:inline">{label}</span>
              </>
            )
            : label
          : "Connect";

        const styleGuard: React.CSSProperties = ready
          ? {}
          : { opacity: 0, pointerEvents: "none" };

        const title = showSwitch
          ? "Wrong network — switch to Base"
          : connected
          ? addr
          : "Connect wallet";

        return (
          <button
            type="button"
            onClick={onClick}
            aria-hidden={!ready}
            aria-busy={!ready}
            title={title}
            aria-label={
              showSwitch
                ? "Switch to Base network"
                : connected
                ? `Wallet ${label}`
                : "Connect wallet"
            }
            style={styleGuard}
            className={[
              "pill pill-opaque",
              compact ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm",
            ].join(" ")}
          >
            {text}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

export function WalletPill() {
  return <Connect />;
}

export function ConnectPill() {
  return <Connect compact />;
}
