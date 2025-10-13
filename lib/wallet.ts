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

function inFarcaster() {
  if (typeof window === "undefined") return false;
  try {
    const ua = navigator.userAgent || "";
    if (/Warpcast|Farcaster/i.test(ua)) return true;
    return !!(window as any)?.farcaster?.miniapp;
  } catch {
    return false;
  }
}

const connectors = [
  ...(inFarcaster() ? [miniAppConnector()] : []), // only add in-app
  injected(),
  walletConnect({
    projectId,
    metadata: {
      name: "TobySwap",
      description: "Swap on Base with auto-TOBY burn",
      url: siteUrl,
      icons: [`${siteUrl}/favicon.ico`],
    },
    showQrModal: true,
  }),
  coinbaseWallet({ appName: "TobySwap" }),
];

export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
