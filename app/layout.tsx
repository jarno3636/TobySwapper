import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "@/components/Providers"
import { ToastProvider } from "@/components/ToastProvider"
import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import ThemeToggle from "@/components/ThemeToggle"
import BurnCounter from "@/components/BurnCounter"
import MobileNav from "@/components/MobileNav"

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
          <ToastProvider>
            {/* Site-wide Header */}
            <header className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <Image src="/toby-logo.svg" alt="TOBY" width={52} height={52} />
                <div className="text-3xl font-extrabold tracking-tight">Toby Swapper</div>
              </Link>

              <div className="flex items-center gap-3">
                <ThemeToggle />
                <BurnCounter />
                <nav className="hidden md:flex gap-3">
                  <Link className="pill" href="/links">Links</Link>
                  <a className="pill" href="https://toadgod.xyz" target="_blank" rel="noreferrer">Site</a>
                  <a className="pill" href="https://x.com/toadgod1017" target="_blank" rel="noreferrer">X</a>
                  <a className="pill" href="https://t.me/toadgang/212753" target="_blank" rel="noreferrer">Telegram</a>
                </nav>
                <MobileNav />
              </div>
            </header>

            {children}

            {/* Footer */}
            <footer className="mx-auto max-w-6xl px-4 pb-10 flex flex-col sm:flex-row items-center gap-3 justify-between text-sm text-white/70">
              <div>Built for the <b>TobyWorld</b> community. ✨</div>
              <div className="flex flex-wrap gap-3">
                <a className="pill" href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c" target="_blank" rel="noreferrer">Swapper Contract</a>
                <a className="pill" href="https://basescan.org/address/0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" target="_blank" rel="noreferrer">Router</a>
              </div>
            </footer>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
