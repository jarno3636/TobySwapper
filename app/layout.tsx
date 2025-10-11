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

// ---------------- Root Layout ----------------
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Farcaster Mini App embed info (for rich previews & app launch)
  const miniAppEmbed = {
    version: "1",
    imageUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/og/miniapp-3x2.png`,
    button: {
      title: "Open Toby Swapper",
      action: {
        type: "launch_frame",
        name: "Toby Swapper",
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/`,
        splashImageUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/icons/toby-splash-200.png`,
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

            {/* --- Share bar with scroll + icons --- */}
            <div className="w-full overflow-x-auto no-scrollbar py-3 mb-2">
              <div className="flex justify-center gap-2 min-w-max px-4">
                {/* Farcaster pill */}
                <a
                  href="https://warpcast.com/~/compose?text=%F0%9F%94%A5%20Swap%20on%20TobySwap%20(Base)%20%E2%80%94%201%%20auto-burn%20to%20%24TOBY.%20Join%20the%20lore%20%F0%9F%90%B8%20https://tobyswap.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pill pill-opaque hover:opacity-90 text-xs flex items-center gap-1"
                >
                  <span className="text-[#8A63D2]">🌀</span>
                  Spread the Lore
                </a>

                {/* X / Twitter pill */}
                <a
                  href="https://twitter.com/intent/tweet?text=%F0%9F%94%A5%20Swap%20on%20TobySwap%20(Base)%20%E2%80%94%201%%20auto-burn%20to%20%24TOBY.%20Join%20the%20lore%20%F0%9F%90%B8&url=https://tobyswap.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pill pill-opaque hover:opacity-90 text-xs flex items-center gap-1"
                >
                  <span>𝕏</span>
                  Share on X
                </a>
              </div>
            </div>

            <main className="mx-auto max-w-5xl px-4 py-8 w-full">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
