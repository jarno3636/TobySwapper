// lib/wallet.ts
"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";

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

/** 1) Build RainbowKit wallets (branded options) */
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

/** 2) Convert to wagmi connectors — v2.2.x requires the options as 2nd arg */
const rkConnectors = connectorsForWallets(wallets, {
  appName: "TobySwap",
  projectId,
});

/** 3) Final wagmi config (Farcaster first, then full RainbowKit set) */
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors: [
    miniAppConnector(), // preferred inside Warpcast; harmless elsewhere
    ...rkConnectors,
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
