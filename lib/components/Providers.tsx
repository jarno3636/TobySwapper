"use client"
import { ReactNode } from "react"
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"
import { WagmiProvider } from "wagmi"
import { base } from "viem/chains"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const config = getDefaultConfig({
  appName: "Toby Swapper",
  projectId: "TobySwapper-Local", // replace later with WC projectId
  chains: [base],
  ssr: true
})
const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
