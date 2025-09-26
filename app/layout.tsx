// app/layout.tsx
import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "@/components/Providers"
import { ToastProvider } from "@/components/ToastProvider"
import { Metadata } from "next"
import MobileNav from "@/components/MobileNav"

export const metadata: Metadata = {
  title: "Toby Swapper",
  description:
    "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
  themeColor: "#0a0b12",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Toby Swapper",
    description:
      "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
    images: ["/og.PNG"], // note .PNG
  },
  twitter: {
    card: "summary_large_image",
    title: "Toby Swapper",
    description:
      "Swap USDC/ETH ↔ TOBY/PATIENCE/TABOSHI on Base. 1% auto-buys TOBY and burns.",
    images: ["/og.PNG"], // note .PNG
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-cyan-300/40 selection:text-white">
        <Providers>
          <ToastProvider>
            {/* Sticky premium header: brand left, menu trigger right (rendered by <MobileNav/>) */}
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:border-2 focus:border-black focus:bg-white focus:px-3 focus:py-1 focus:text-black focus:shadow-[0_4px_0_#000]"
            >
              Skip to content
            </a>

            <header
              className="
                sticky top-0 z-40
                border-b-2 border-black
                bg-[radial-gradient(120%_160%_at_0%_-40%,rgba(124,58,237,.35),transparent),radial-gradient(120%_160%_at_100%_-20%,rgba(14,165,233,.30),transparent),linear-gradient(180deg,#0a0b12,#0b1220)]
                backdrop-blur-xl
              "
            >
              <div className="maxw py-4">
                <MobileNav />
              </div>
            </header>

            <main id="main">{children}</main>

            {/* Footer — subtle, glassy pills; generous spacing */}
            <footer
              className="
                mt-16
                border-t-2 border-black
                bg-[radial-gradient(120%_160%_at_0%_140%,rgba(196,181,253,.25),transparent),radial-gradient(120%_160%_at_100%_120%,rgba(34,211,238,.22),transparent),linear-gradient(180deg,#0b1220,#0a0b12)]
              "
            >
              <div className="maxw py-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-white/80">
                  Built for the <b>TobyWorld</b> community. ✨
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    className="nav-pill no-underline"
                    href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c"
                    target="_blank"
                    rel="noreferrer"
                    title="View Swapper on BaseScan"
                  >
                    Swapper Contract →
                  </a>
                  <a
                    className="nav-pill no-underline"
                    href="https://basescan.org/address/0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"
                    target="_blank"
                    rel="noreferrer"
                    title="View Router on BaseScan"
                  >
                    Router →
                  </a>
                  <a
                    className="glass-chip no-underline"
                    href="https://warpcast.com/~/compose?text=In%20the%20swamp%2C%20every%20trade%20feeds%20the%20flame.%20%F0%9F%94%A5%20%23TobyWorld"
                    target="_blank"
                    rel="noreferrer"
                    title="Cast to Farcaster"
                  >
                    ✨ Cast about Toby
                  </a>
                </div>
              </div>
            </footer>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
