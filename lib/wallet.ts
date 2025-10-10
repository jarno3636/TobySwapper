// lib/wallet.ts
"use client";

import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { base } from "viem/chains";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";

// ---- ENV ----
const WC_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID || // optional fallback key name
  "";

if (!WC_ID) {
  console.warn(
    "WalletConnect disabled: set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
  );
}

const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ||
  process.env.NEXT_PUBLIC_BASE_RPC ||
  "https://mainnet.base.org";

// ---- Connectors (same recipe as your other project) ----
export const connectors = [
  injected({ shimDisconnect: true }),
  coinbaseWallet({ appName: "Toby Swapper", preference: "all" }),
  ...(WC_ID ? [walletConnect({ projectId: WC_ID })] : []),
];

// ---- wagmi config (v2) ----
export const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http(BASE_RPC) },
  connectors,
  storage: createStorage({ storage: cookieStorage }), // SSR-safe persistence
  ssr: true,
});
