import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "@/components/Providers"
import { ToastProvider } from "@/components/ToastProvider"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Toby Swapper",
  description: "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
  themeColor: "#0a0b12",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Toby Swapper",
    description: "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Toby Swapper",
    description: "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
    images: ["/og.png"],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
