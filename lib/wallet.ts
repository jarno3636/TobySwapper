// lib/wallet.ts
"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";

// ✅ Use RainbowKit's wallet factories so the modal shows
// branded install buttons, icons, deep links, etc.
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet as rkCoinbaseWallet,
  rainbowWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||
  "";

// Absolute site URL for WC metadata
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

/** 1) Build RainbowKit wallets (branded, with installers) */
const wallets = [
  {
    groupName: "Popular",
    wallets: [
      metaMaskWallet({ projectId }),
      rkCoinbaseWallet({ appName: "TobySwap" }),
      rainbowWallet({ projectId }),
      rabbyWallet(),
      walletConnectWallet({ projectId }),
    ],
  },
];

/** 2) Convert to wagmi connectors (no `chains` here) */
const rkConnectors = connectorsForWallets(wallets);

/** 3) Final wagmi config (Farcaster first, then full RainbowKit set) */
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors: [
    // works only in Warpcast; harmless elsewhere
    miniAppConnector(),
    ...rkConnectors,
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
