import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "@/components/Providers"

export const metadata = {
  title: "Toby Swapper",
  description: "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
