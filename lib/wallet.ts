// lib/wallet.ts
"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||
  "";

/** 1) Define wallet groups using FACTORY FUNCTIONS (do NOT call them here) */
const walletGroups = [
  {
    groupName: "Popular",
    wallets: [
      metaMaskWallet,
      coinbaseWallet,
      rainbowWallet,
      rabbyWallet,
      walletConnectWallet,
    ],
  },
];

/** 2) Convert to wagmi connectors — pass options as the 2nd arg */
const rkConnectors = connectorsForWallets(walletGroups, {
  appName: "TobySwapper",
  projectId,
});

/** 3) Final wagmi config (Farcaster first, then RainbowKit’s set) */
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors: [
    miniAppConnector(),  // preferred inside Warpcast; harmless elsewhere
    ...rkConnectors,     // MetaMask, Coinbase, Rainbow, Rabby, WalletConnect
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
