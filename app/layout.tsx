import "./globals.css";
import Brand from "@/components/Brand";
import Background from "@/components/Background";
import Providers from "./providers";

export const metadata = {
  title: "Toby Swapper",
  description: "Swap on Base with auto-TOBY burn",
  manifest: "/site.webmanifest", // ✅ App Router manifest route
  themeColor: "#0b0b0b",         // ✅ consistent across PWA + Base
  openGraph: {
    title: "Toby Swapper",
    description:
      "Swap USDC/ETH ↔️ TOBY · PATIENCE · TABOSHI. 1% auto-burn to TOBY.",
    images: [
      `${process.env.NEXT_PUBLIC_SITE_URL}/og/tobyswap-card-1200x630.png`,
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      `${process.env.NEXT_PUBLIC_SITE_URL}/og/tobyswap-card-1200x630.png`,
    ],
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${process.env.NEXT_PUBLIC_SITE_URL}/api/frame/image`,
    "fc:frame:button:1": "Open Toby Swapper",
    "fc:frame:button:1:action": "post",
    "og:image": `${process.env.NEXT_PUBLIC_SITE_URL}/og/tobyswap-card-1200x630.png`,
  },
} as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

  // ✅ Farcaster Mini App Embed object
  const miniAppEmbed = {
    version: "1",
    imageUrl: `${site}/og/miniapp-3x2.png`,
    button: {
      title: "Open Toby Swapper",
      action: {
        type: "launch_frame",
        name: "Toby Swapper",
        url: `${site}/`,
        splashImageUrl: `${site}/icons/toby-192.png`,
        splashBackgroundColor: "#0b0b0b",
      },
    },
  };

  return (
    <html lang="en">
      <head>
        {/* ✅ iOS / Safari */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/toby-192.png" />

        {/* ✅ Favicon set */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/toby-icon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/toby-icon-16.png" />

        {/* ✅ Farcaster Mini App embed meta */}
        <meta name="fc:miniapp" content={JSON.stringify(miniAppEmbed)} />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <Background />
          <div className="relative z-10 flex flex-col items-center w-full">
            <Brand />
            <main className="mx-auto max-w-5xl px-4 py-8 w-full">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
