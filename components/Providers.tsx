// components/Providers.tsx
"use client"

import { ReactNode } from "react"
import "@rainbow-me/rainbowkit/styles.css"
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit"
import { WagmiProvider } from "wagmi"
import { base } from "viem/chains"
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"

// --- WalletConnect project id (prod-ready via ENV, safe dev fallback) ---
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID || "TobySwapper-Local"

// --- Wagmi + RainbowKit config (Base only) ---
const config = getDefaultConfig({
  appName: "Toby Swapper",
  projectId: WC_PROJECT_ID,
  chains: [base],
  ssr: true,
})

// --- React Query tuned to feel snappy and stable (less refetch flicker) ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,           // 15s: plenty for on-chain UI
      refetchOnWindowFocus: false, // no surprise refetch when tab refocuses
      refetchOnReconnect: "always",
      retry: 2,
    },
  },
})

// --- Brand-matched RainbowKit theme ---
const rkTheme = darkTheme({
  accentColor: "#79ffe1",           // your --accent
  accentColorForeground: "#0a0b12", // dark ink foreground
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={rkTheme}
          modalSize="compact"
          initialChain={base}
          appInfo={{
            appName: "Toby Swapper",
            learnMoreUrl: "/lore",
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
