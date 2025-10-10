// components/Connect.tsx
"use client";

import * as React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { base } from "viem/chains";

/** Nicely truncates 0x… addresses */
function truncate(addr?: string, left = 4, right = 4) {
  if (!addr) return "";
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

/**
 * Compact-aware Connect button using RainbowKit modal controls.
 * - Shows "Switch to Base" when connected to wrong network
 * - Hydration-safe by hiding UI until RainbowKit is mounted
 */
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
        const ready = mounted;
        const connected = ready && !!account?.address;
        const onBase = connected && chain?.id === base.id && !chain?.unsupported;

        const address = account?.address;
        const label = connected ? truncate(address) : "Connect";

        const showSwitch = connected && !onBase;
        const onClick = showSwitch
          ? openChainModal
          : connected
          ? openAccountModal
          : openConnectModal;

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
          ? address
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
              "group inline-flex max-w-[200px] items-center justify-center gap-1",
              "truncate rounded-full px-3 py-1.5 text-xs transition",
              showSwitch
                ? "border border-amber-400/60 bg-amber-400/10 hover:bg-amber-400/20"
                : "border border-[var(--accent)]/60 hover:bg-[var(--accent)]/10",
              "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "block h-2 w-2 rounded-full",
                showSwitch
                  ? "bg-amber-400"
                  : connected
                  ? "bg-[var(--accent)]"
                  : "bg-white/70",
              ].join(" ")}
            />
            <span className="truncate">{text}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
