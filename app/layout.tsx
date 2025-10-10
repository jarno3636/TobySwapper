import "./globals.css";
import Brand from "@/components/Brand";
import Background from "@/components/Background";
import { WalletProvider } from "@/components/Wallet";

// Keep head lightweight to speed up TTFB/FCP
export const metadata = {
  title: "Toby Swapper",
  description: "Swap on Base with auto-TOBY burn",
  openGraph: {
    title: "Toby Swapper",
    description: "Swap USDC/ETH ↔️ TOBY · PATIENCE · TABOSHI. 1% auto-burn to TOBY.",
    images: ["/og.PNG"],
  },
  twitter: { card: "summary_large_image", images: ["/og.PNG"] },
  // Farcaster-friendly meta (basic)
  other: {
    "fc:frame": "vNext",
    "og:image": "/og.PNG",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Prevent SSR/client mismatch from freezing wagmi hooks + quicker first paint */}
      <body suppressHydrationWarning className="safe-pb">
        <WalletProvider>
          {/* Background below everything; doesn’t block input */}
          <Background />
          <div className="relative z-10">
            <Brand />
            <main className="mx-auto max-w-5xl px-4 py-8 content-visible">
              {children}
            </main>
          </div>
        </WalletProvider>

        {/* Preconnect helps wallet RPCs begin faster on navigation */}
        <link rel="preconnect" href="https://mainnet.base.org" crossOrigin="" />
      </body>
    </html>
  );
}
