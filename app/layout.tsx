import "./globals.css";
import Brand from "@/components/Brand";
import Background from "@/components/Background";
import dynamic from "next/dynamic";

// Client-only WalletProvider to avoid indexedDB on server
const WalletProvider = dynamic(
  () => import("@/components/Wallet").then((m) => m.WalletProvider),
  { ssr: false }
);

export const metadata = {
  title: "Toby Swapper",
  description: "Swap on Base with auto-TOBY burn",
  openGraph: {
    title: "Toby Swapper",
    description: "Swap USDC/ETH ↔️ TOBY · PATIENCE · TABOSHI. 1% auto-burn to TOBY.",
    images: ["/og.PNG"],
  },
  twitter: { card: "summary_large_image", images: ["/og.PNG"] },
  other: { "fc:frame": "vNext", "og:image": "/og.PNG" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          {/* Background sits behind everything */}
          <Background />
          {/* Foreground wrapper ensures content is above bg */}
          <div className="relative z-10">
            <Brand />
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
