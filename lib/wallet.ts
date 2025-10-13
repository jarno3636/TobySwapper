// lib/wallet.ts
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

/**
 * Connector order:
 *  1) Farcaster Mini-App
 *  2) Injected (Coinbase-targeted)  → Base/CB Smart Wallet
 *  3) Injected (generic)            → MetaMask/Rabby/etc.
 *  4) WalletConnect (QR)            → if projectId set
 *  5) Coinbase Wallet connector
 */
const connectors = [
  miniAppConnector(),
  injected({ target: "coinbaseWallet", shimDisconnect: true }),
  injected({ shimDisconnect: true }),
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

export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors,
  ssr: true,
  // ❌ remove autoConnect here (not supported by your wagmi build)
  storage: createStorage({ storage: cookieStorage }),
});
