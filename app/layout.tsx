// app/layout.tsx
import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "@/components/Providers"
import { ToastProvider } from "@/components/ToastProvider"
import { Metadata } from "next"
import MobileNav from "@/components/MobileNav"

export const metadata: Metadata = {
  title: "Toby Swapper",
  description: "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
  themeColor: "#0a0b12",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Toby Swapper",
    description: "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
    images: ["/og.PNG"], // note .PNG
  },
  twitter: {
    card: "summary_large_image",
    title: "Toby Swapper",
    description: "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
    images: ["/og.PNG"], // note .PNG
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ToastProvider>
            {/* Single global header (uses only MobileNav) */}
            <header className="maxw py-5 flex items-center justify-between">
              <MobileNav />
            </header>

            {children}

            <footer className="maxw pb-10 mt-10 flex flex-col sm:flex-row items-center gap-3 justify-between text-sm text-white/70">
              <div>Built for the <b>TobyWorld</b> community. ✨</div>
              <div className="flex flex-wrap gap-3">
                <a
                  className="pill"
                  href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c"
                  target="_blank"
                  rel="noreferrer"
                >
                  Swapper Contract
                </a>
                <a
                  className="pill"
                  href="https://basescan.org/address/0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"
                  target="_blank"
                  rel="noreferrer"
                >
                  Router
                </a>
              </div>
            </footer>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
