// /components/ConnectPill.tsx
"use client";

import * as React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { base } from "viem/chains";

function truncate(addr?: string, left = 6, right = 4) {
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

        // STATUS
        const showSwitch = connected && !onBase;
        const label = connected ? truncate(account?.address) : "Not Connected";
        const dot =
          showSwitch ? "bg-amber-400" : connected ? "bg-[var(--accent)]" : "bg-[var(--danger)]";

        // ACTION
        const onClick = showSwitch
          ? openChainModal
          : connected
          ? openAccountModal
          : openConnectModal;

        // TEXT
        const text = showSwitch
          ? "Switch to Base"
          : connected
          ? compact
            ? label
            : label
          : "Not Connected";

        // Hydration guard — avoid flicker
        const hidden = ready ? {} : { opacity: 0, pointerEvents: "none" };

        return (
          <button
            type="button"
            onClick={onClick}
            style={hidden}
            className={[
              "pill",
              connected ? "pill-nav" : "pill-opaque",
              "inline-flex items-center gap-1 text-xs",
            ].join(" ")}
            title={connected ? account?.address : "Connect wallet"}
            aria-label={connected ? "Wallet menu" : "Connect wallet"}
          >
            <span className={`block h-2 w-2 rounded-full ${dot}`} aria-hidden />
            <span className="truncate">{text}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
