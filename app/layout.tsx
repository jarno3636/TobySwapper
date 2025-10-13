// app/layout.tsx
import "./globals.css";
import Brand from "@/components/Brand";
import Background from "@/components/Background";
import Providers from "./providers";

export const metadata = {
  title: "Toby Swapper",
  description: "Swap on Base with auto-TOBY burn",
  openGraph: {
    title: "Toby Swapper",
    description:
      "Swap USDC/ETH ↔️ TOBY · PATIENCE · TABOSHI. 1% auto-burn to TOBY.",
    images: ["/og/tobyswap-card-1200x630.png"], // ✅ new image
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/tobyswap-card-1200x630.png"], // ✅ new image
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${process.env.NEXT_PUBLIC_SITE_URL}/api/frame/image`,
    "fc:frame:button:1": "Open Toby Swapper",
    "fc:frame:button:1:action": "post",
    "og:image": "/og/tobyswap-card-1200x630.png", // ✅ new image
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

  // Farcaster Mini App embed info (for rich previews & launch)
  const miniAppEmbed = {
    version: "1",
    imageUrl: `${site}/og/miniapp-3x2.png`, // ✅ new miniapp image (3:2)
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
        {/* ✅ PWA / Base app */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/toby-192.png" />
        <meta name="theme-color" content="#79ffe1" />

        {/* ✅ Farcaster Mini App embed meta */}
        <meta name="fc:miniapp" content={JSON.stringify(miniAppEmbed)} />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <Background />
          <div className="relative z-10 flex flex-col items-center w-full">
            <Brand />
            <main className="mx-auto max-w-5xl px-4 py-8 w-full">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
