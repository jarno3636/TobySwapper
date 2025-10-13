// components/ConnectPill.tsx
"use client";

import * as React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { base } from "viem/chains";

function truncate(addr?: string, left = 4, right = 2) {
  if (!addr) return "";
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

export default function ConnectPill({ compact = false }: { compact?: boolean }) {
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

        const onClick = showSwitch
          ? openChainModal
          : connected
          ? openAccountModal
          : openConnectModal;

        // Short labels to avoid a very wide pill
        const text = showSwitch
          ? "Switch"
          : connected
          ? truncate(account?.address)
          : "Connect";

        const hidden: React.CSSProperties = ready
          ? {}
          : { opacity: 0, pointerEvents: "none" };

        return (
          <button
            type="button"
            onClick={onClick}
            style={hidden}
            title={connected ? account?.address : "Connect wallet"}
            aria-label={connected ? "Wallet menu" : "Connect wallet"}
            className={[
              "pill",                             // your theme
              connected ? "pill-nav" : "pill-opaque",
              "inline-flex items-center whitespace-nowrap",
              "leading-none text-[11px] gap-1.5",
              "!px-3 !py-1.5 !h-7 !rounded-full", // compact but not tiny
              "!w-auto !min-w-0",                 // never force a fixed width
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
