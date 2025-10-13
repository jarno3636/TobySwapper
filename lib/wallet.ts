"use client";

import { http, cookieStorage, createStorage } from "wagmi";
import { base } from "viem/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||
  "";

if (!projectId) {
  console.warn("⚠️ WalletConnect disabled: missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
}

// 1️⃣ Start from RainbowKit’s ready-made config
const rainbowConfig = getDefaultConfig({
  appName: "TobySwapper",
  projectId,
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

// 2️⃣ Prepend Farcaster Mini-App connector to RainbowKit’s list
rainbowConfig.connectors = [
  miniAppConnector(),
  ...rainbowConfig.connectors,
];

// 3️⃣ Export Wagmi config for <WagmiProvider>
export const wagmiConfig = rainbowConfig;
