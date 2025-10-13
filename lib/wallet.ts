"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";
import {
  connectorsForWallets,
  getDefaultWallets,
} from "@rainbow-me/rainbowkit";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||
  "";

if (!projectId) {
  console.warn("⚠️ WalletConnect disabled: missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
}

// ✅ Step 1 — Build the wallet groups (no chains here)
const { wallets } = getDefaultWallets({
  appName: "TobySwapper",
  projectId,
});

// ✅ Step 2 — Pass chains into connectorsForWallets (required in RainbowKit 2.x)
const rkConnectors = connectorsForWallets(wallets, {
  appName: "TobySwapper",
  projectId,
  chains: [base],
});

// ✅ Step 3 — Create the final Wagmi config
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors: [
    // Farcaster Mini-App connector first (auto-connect inside Farcaster)
    miniAppConnector(),
    ...rkConnectors,
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
