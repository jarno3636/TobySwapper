// /app/layout.tsx
import "./globals.css";
import Brand from "@/components/Brand";
import Background from "@/components/Background";
import Providers from "./providers"; // ✅ new RainbowKit/Wagmi wrapper

export const metadata = {
  title: "Toby Swapper",
  description: "Swap on Base with auto-TOBY burn",
  openGraph: {
    title: "Toby Swapper",
    description:
      "Swap USDC/ETH ↔️ TOBY · PATIENCE · TABOSHI. 1% auto-burn to TOBY.",
    images: ["/og.PNG"],
  },
  twitter: { card: "summary_large_image", images: ["/og.PNG"] },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${process.env.NEXT_PUBLIC_SITE_URL}/api/frame/image`,
    "fc:frame:button:1": "Open Toby Swapper",
    "fc:frame:button:1:action": "post",
    "og:image": "/og.PNG",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {/* Wrap everything inside Providers instead of WalletProvider */}
        <Providers>
          <Background />
          <div className="relative z-10">
            <Brand />
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
