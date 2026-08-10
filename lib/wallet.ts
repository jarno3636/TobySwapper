// lib/wallet.ts
"use client";

import { http, fallback, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";

// ➊ RainbowKit wallet factories (modal buttons)
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,        // shows "Browser Wallet" in the modal (Base/CB injection lives here)
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

// ➋ Plain wagmi injected connector so we can *prefer* the Coinbase/Base injection at runtime
import { injected } from "@wagmi/connectors";

import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||
  "";

// ---- RainbowKit wallet groups (use FACTORY functions; options passed below) ----
const walletGroups = [
  {
    groupName: "Popular",
    wallets: [
      injectedWallet,     // Browser Wallet (picks up Base / CB / MM injections)
      metaMaskWallet,
      coinbaseWallet,
      rainbowWallet,
      rabbyWallet,
      walletConnectWallet,
    ],
  },
];

// Convert to wagmi connectors (v2.2.x: pass options in 2nd arg)
const rkConnectors = connectorsForWallets(walletGroups, {
  appName: "TobySwapper",
  projectId,
});

// ---- Final wagmi config ----
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: fallback([
      // First choice: our same-origin server proxy. It can use a private BASE_RPC_URL
      // or ALCHEMY_API_KEY and rotates to public Base RPCs if the provider is down.
      http("/api/rpc", { timeout: 10_000, retryCount: 1 }),
      ...(process.env.NEXT_PUBLIC_BASE_RPC_URL
        ? [http(process.env.NEXT_PUBLIC_BASE_RPC_URL, { timeout: 10_000, retryCount: 1 })]
        : []),
      http("https://mainnet.base.org", { timeout: 10_000, retryCount: 1 }),
      http("https://base-rpc.publicnode.com", { timeout: 10_000, retryCount: 1 }),
      http("https://1rpc.io/base", { timeout: 10_000, retryCount: 1 }),
    ], { rank: true }),
  },
  connectors: [
    // Prefer Mini-App when inside Warpcast (no effect on web)
    miniAppConnector(),

    // Prefer Coinbase/Base injection first so the “Connect” click latches onto Base app if it’s injected
    injected({
      target: "coinbaseWallet",   // explicitly target the CB/Base injected provider when present
      shimDisconnect: true,
    }),

    // Full RainbowKit set (MetaMask, Coinbase Wallet SDK, Rainbow, Rabby, WalletConnect, and Browser Wallet)
    ...rkConnectors,
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
