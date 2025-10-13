"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";
import { injected, walletConnect, coinbaseWallet } from "@wagmi/connectors";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||
  "";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

// Build web connectors unconditionally (SSR-safe)
// - Injected: browser wallets
// - WalletConnect: only if projectId provided
// - Coinbase Wallet: always available
const webConnectors = [
  injected(),
  ...(projectId
    ? [
        walletConnect({
          projectId,
          showQrModal: true,
          metadata: {
            name: "TobySwap",
            description: "Swap on Base with auto-TOBY burn",
            url: siteUrl,
            icons: [`${siteUrl}/favicon.ico`],
          },
        }),
      ]
    : []),
  coinbaseWallet({ appName: "TobySwap" }),
];

// Final Wagmi config:
// - Always include the Farcaster Mini-App connector (it no-ops on web)
// - Then add normal web connectors so users can connect on a regular page
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors: [
    miniAppConnector(), // preferred when running inside Warpcast
    ...webConnectors,   // web wallet options on normal pages
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
