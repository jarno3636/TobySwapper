import "./globals.css";
import "./premium-theme.css";
import Brand from "@/components/Brand";
import Background from "@/components/Background";
import Providers from "./providers";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

const themeBoot = `
(function () {
  try {
    var saved = localStorage.getItem("tobyswap-theme");
    var theme = saved === "dark" || saved === "light"
      ? saved
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = "light";
  }
})();`;

export const metadata = {
  metadataBase: new URL(SITE),
  title: "TobySwapper · Tobyworld Community",
  description: "Explore Tobyworld Lore Lands, Keeper Marks, canonical signs, community paths and pond utilities on Base.",
  manifest: "/site.webmanifest",
  themeColor: "#faf9f6",
  openGraph: {
    title: "TobySwapper · Tobyworld Community",
    description: "Explore all 2,869 Lore Lands, Keeper Marks, canonical signs and community paths through Tobyworld.",
    images: [`${SITE}/og/tobyswap-card-1200x630.png`],
  },
  twitter: {
    card: "summary_large_image",
    title: "TobySwapper · Tobyworld Community",
    description: "Explore Lore Lands, Keeper Marks and Tobyworld community paths on Base.",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <meta name="theme-color" content="#faf9f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/toby-icon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/toby-icon-16.png" />
        <meta name="fc:miniapp" content={JSON.stringify(miniAppEmbed)} />
        <meta name="fc:frame" content={JSON.stringify(miniAppEmbed)} />
      </head>
      <body suppressHydrationWarning>
        <a className="skip-link" href="#app-main">Skip to content</a>
        <Providers>
          <Background />
          <div className="relative z-10 flex w-full flex-col items-center">
            <Brand />
            <main id="app-main" className="w-full">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
