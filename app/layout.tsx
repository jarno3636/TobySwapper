// app/layout.tsx
import "./globals.css";
import Brand from "@/components/Brand";
import Background from "@/components/Background";
import Providers from "./providers";

// ---------------- Metadata ----------------
export const metadata = {
  title: "Toby Swapper",
  description: "Swap on Base with auto-TOBY burn",
  openGraph: {
    title: "Toby Swapper",
    description:
      "Swap USDC/ETH ↔️ TOBY · PATIENCE · TABOSHI. 1% auto-burn to TOBY.",
    images: ["/og/tobyswap-frame-3x2.png"], // ✅ Updated OG image
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/tobyswap-frame-3x2.png"], // ✅ Consistent with OG
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${process.env.NEXT_PUBLIC_SITE_URL}/api/frame/image`,
    "fc:frame:button:1": "Open Toby Swapper",
    "fc:frame:button:1:action": "post",
    "og:image": "/og/tobyswap-frame-3x2.png", // ✅ Updated image reference
  },
};

// ---------------- Root Layout ----------------
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // ✅ Farcaster Mini App embed info (for rich previews & launch)
  const miniAppEmbed = {
    version: "1",
    imageUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/og/tobyswap-frame-3x2.png`, // ✅ Updated
    button: {
      title: "Open Toby Swapper",
      action: {
        type: "launch_frame",
        name: "Toby Swapper",
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/`,
        splashImageUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/icons/icon-512.png`, // ✅ Updated splash icon
        splashBackgroundColor: "#0b0b0b",
      },
    },
  };

  return (
    <html lang="en">
      <head>
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
