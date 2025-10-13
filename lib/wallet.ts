"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";
import { getDefaultWallets, connectorsForWallets } from "@rainbow-me/rainbowkit";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||
  "";

if (!projectId) {
  console.warn("⚠️ WalletConnect disabled: missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
}

/**
 * 1) Build RainbowKit wallet groups.
 *    ✅ chains belong here for v2.2.x
 */
const { wallets } = getDefaultWallets({
  appName: "TobySwapper",
  projectId,
  chains: [base],
});

/**
 * 2) Convert to Wagmi connectors.
 *    ❌ DO NOT pass `chains` here (TS error you saw).
 */
const rkConnectors = connectorsForWallets(wallets, {
  appName: "TobySwapper",
  projectId,
});

/**
 * 3) Create Wagmi config without mutating anything, and
 *    prepend the Farcaster Mini-App connector.
 */
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors: [
    miniAppConnector(), // preferred in Farcaster
    ...rkConnectors,    // RainbowKit’s (Injected, WC, Coinbase, etc.)
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
