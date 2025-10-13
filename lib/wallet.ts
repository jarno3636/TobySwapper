"use client";

import { http, createStorage, cookieStorage, createConfig } from "wagmi";
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

// ✅ Chains go here — inside getDefaultWallets
const { wallets } = getDefaultWallets({
  appName: "TobySwapper",
  projectId,
  chains: [base],
});

// ❌ Remove 'chains' here — it is not a valid parameter for connectorsForWallets
const rkConnectors = connectorsForWallets(wallets, {
  appName: "TobySwapper",
  projectId,
});

// Final Wagmi config with the Farcaster Mini-App connector first
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors: [
    // Prefer Mini-App connector when running inside Farcaster
    miniAppConnector(),
    // Then all RainbowKit wallets
    ...rkConnectors,
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }), // SSR-safe
});
