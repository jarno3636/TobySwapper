// components/ConnectPill.tsx
"use client";

import * as React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { base } from "viem/chains";
import { useConnect, type Connector } from "wagmi";

function truncate(addr?: string, left = 4, right = 2) {
  if (!addr) return "";
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

function isFarcasterUA() {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent);
}

/** Pick a preferred connector for web clicks (not for Warpcast) */
function choosePreferred(connectors: readonly Connector[] = []) {
  // Prefer a Coinbase-injected (helps Base/CB Smart Wallet on web)
  const cbInjected = connectors.find(
    (c) => c.id === "injected" && c.name.toLowerCase().includes("coinbase")
  );
  if (cbInjected) return cbInjected;

  // Then generic injected (MetaMask/Rabby/etc.)
  const injected = connectors.find((c) => c.id === "injected");
  if (injected) return injected;

  // Then WalletConnect QR
  const wc = connectors.find((c) => c.id.toLowerCase().includes("walletconnect"));
  if (wc) return wc;

  // Then Coinbase Wallet connector
  const cbw = connectors.find((c) => c.id.toLowerCase().includes("coinbasewallet"));
  if (cbw) return cbw;

  // Fallback: first available
  return connectors[0] ?? null;
}

export default function ConnectPill({ compact = false }: { compact?: boolean }) {
  // We’ll “preflight connect” for web when user clicks Connect
  const { connectors, connectAsync } = useConnect();

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
        const ready = mounted;
        const connected = ready && !!account?.address;
        const onBase = connected && chain?.id === base.id && !chain?.unsupported;

        const showSwitch = connected && !onBase;
        const dot = showSwitch
          ? "bg-amber-400"
          : connected
          ? "bg-[var(--accent)]"
          : "bg-[var(--danger)]";

        const hidden: React.CSSProperties = ready
          ? {}
          : { opacity: 0, pointerEvents: "none" };

        const onClick = async () => {
          if (showSwitch) return openChainModal();
          if (connected) return openAccountModal();

          // Not connected:
          // If we're NOT in Warpcast, try a preferred injected connector silently first.
          if (!isFarcasterUA()) {
            const preferred = choosePreferred(connectors);
            if (preferred) {
              try {
                await connectAsync({ connector: preferred });
                return; // success => no modal
              } catch {
                // fall through to modal
              }
            }
          }
          // Open RainbowKit modal with full wallet options
          openConnectModal();
        };

        // Short labels to avoid a very wide pill
        const text = showSwitch
          ? "Switch"
          : connected
          ? truncate(account?.address, compact ? 4 : 6, compact ? 2 : 4)
          : "Connect";

        return (
          <button
            type="button"
            onClick={onClick}
            style={hidden}
            title={connected ? account?.address : "Connect wallet"}
            aria-label={connected ? "Wallet menu" : "Connect wallet"}
            className={[
              "pill",
              connected ? "pill-nav" : "pill-opaque",
              "inline-flex items-center whitespace-nowrap",
              "leading-none text-[11px] gap-1.5",
              "!px-3 !py-1.5 !h-7 !rounded-full",
              "!w-auto !min-w-0",
            ].join(" ")}
          >
            <span className={`block h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
            <span className="truncate">{text}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
