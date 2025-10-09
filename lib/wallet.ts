// lib/wallet.ts
"use client";

import { http } from "wagmi";
import { base } from "viem/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
if (!WC_ID) {
  console.warn("⚠ NEXT_PUBLIC_WC_PROJECT_ID is missing. WalletConnect wallets may not work.");
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tobyswap.vercel.app"; // <- add this env in Vercel
const APP_ICON = `${APP_URL}/toby2.PNG`; // absolute URL is best for WC metadata icons
const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

// getDefaultConfig enables Injected + WalletConnect wallets out of the box.
// We pass explicit WC metadata to keep mobile deep linking happy.
export const wagmiConfig = getDefaultConfig({
  appName: "Toby Swapper",
  projectId: WC_ID || "missing-project-id",
  chains: [base],
  transports: { [base.id]: http(BASE_RPC) },
  ssr: true,
  // @ts-expect-error: newer RainbowKit accepts walletConnectParameters in config
  walletConnectParameters: {
    projectId: WC_ID || "missing-project-id",
    metadata: {
      name: "Toby Swapper",
      description: "Swap on Base with auto-TOBY burn.",
      url: APP_URL,      // MUST match the domain you open in the wallet
      icons: [APP_ICON], // 512x512 preferred
    },
  },
});
