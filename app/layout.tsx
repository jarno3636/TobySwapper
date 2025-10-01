import "./globals.css";
import Brand from "@/components/Brand";
import { WalletProvider } from "@/components/Wallet";

export const metadata = {
  title: "Toby Swapper",
  description: "Swap on Base with auto-TOBY burn",
  openGraph: {
    title: "Toby Swapper",
    description: "Swap USDC/ETH ↔️ TOBY · PATIENCE · TABOSHI. 1% auto-burn to TOBY.",
    images: ["/og.PNG"], // ← your blue frog OG
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.PNG"],
  },
  other: {
    "fc:frame": "vNext",
    "og:image": "/og.PNG",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Brand />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
