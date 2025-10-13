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

        // status styles
        const showSwitch = connected && !onBase;
        const dot = showSwitch
          ? "bg-amber-400"
          : connected
          ? "bg-[var(--accent)]"
          : "bg-[var(--danger)]";

        // actions
        const onClick = showSwitch
          ? openChainModal
          : connected
          ? openAccountModal
          : openConnectModal;

        // super-short labels to reduce width
        const text = showSwitch
          ? "Base" // keep it tiny; user taps to switch
          : connected
          ? truncate(account?.address) // 4…2
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
              // keep your look, but force a smaller size
              "pill",
              connected ? "pill-nav" : "pill-opaque",
              "inline-flex items-center whitespace-nowrap",
              "leading-none text-[10px] gap-1",         // tiny text + tight gap
              "!px-1.5 !py-[3px] !h-6 !rounded-full",   // override base padding/height
              "min-w-0 max-w-[84px]"                    // hard cap width
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
