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
 * Connectors order matters:
 *  1) Farcaster Mini-App connector (only engages inside Warpcast)
 *  2) Injected (Coinbase-targeted) → helps auto-inject CB/Base Smart Wallet
 *  3) Injected (generic) → MetaMask / Rabby / etc.
 *  4) WalletConnect (QR) → always shows if projectId set
 *  5) Coinbase Wallet connector
 */
const connectors = [
  // Works only inside Warpcast; present everywhere so it "just works" in-app
  miniAppConnector(),

  // Prefer Coinbase-injected first to catch Base / CB Smart Wallet injections
  injected({
    target: "coinbaseWallet",        // explicitly target Coinbase’s injected provider if present
    shimDisconnect: true,
  }),

  // Generic injected for MetaMask/Rabby/etc
  injected({
    shimDisconnect: true,
  }),

  // WalletConnect QR (shows on web if projectId present)
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

  // Coinbase Wallet connector (desktop extension/app)
  coinbaseWallet({ appName: "TobySwap" }),
];

export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors,
  ssr: true,
  // remember the last-used wallet → auto-connect on revisit (helps “auto inject” feel)
  autoConnect: true,
  storage: createStorage({ storage: cookieStorage }),
});
