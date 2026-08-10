import "./globals.css";
import Brand from "@/components/Brand";
import Background from "@/components/Background";
import Providers from "./providers";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

export const metadata = {
  metadataBase: new URL(SITE),
  title: "Toby Swapper",
  description: "Swap ETH, WETH, TOBY, PATIENCE and TABOSHI on Base with an automatic TOBY burn.",
  manifest: "/site.webmanifest",
  themeColor: "#faf9f6",
  openGraph: {
    title: "Toby Swapper",
    description: "Swap across the Tobyworld pond on Base. TOBY, PATIENCE, TABOSHI, ETH and WETH.",
    images: [`${SITE}/og/tobyswap-card-1200x630.png`],
  },
  twitter: {
    card: "summary_large_image",
    title: "Toby Swapper",
    description: "Swap across the Tobyworld pond on Base.",
    images: [`${SITE}/og/tobyswap-card-1200x630.png`],
  },
} as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const miniAppEmbed = {
    version: "1",
    imageUrl: `${SITE}/og/miniapp-3x2.png`,
    button: {
      title: "Open Toby Swapper",
      action: {
        type: "launch_frame",
        name: "Toby Swapper",
        url: `${SITE}/`,
        splashImageUrl: `${SITE}/icons/toby-splash-200.png`,
        splashBackgroundColor: "#faf9f6",
      },
    },
  };

  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/toby-icon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/toby-icon-16.png" />
        <meta name="fc:miniapp" content={JSON.stringify(miniAppEmbed)} />
        <meta name="fc:frame" content={JSON.stringify(miniAppEmbed)} />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <Background />
          <div className="relative z-10 flex w-full flex-col items-center">
            <Brand />
            <main className="w-full">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
