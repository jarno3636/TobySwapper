// app/share/page.tsx
export const metadata = {
  title: "Toby Swapper — Share",
  description: "Swap on Base with auto-TOBY burn",
  openGraph: {
    title: "Toby Swapper",
    description:
      "Swap USDC/ETH ↔️ TOBY · PATIENCE · TABOSHI. 1% auto-burn to TOBY.",
    images: ["/og/tobyswap-card-1200x630.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/tobyswap-card-1200x630.png"],
  },
};

export default function ShareLanding() {
  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-2xl font-bold mb-2">Toby Swapper</h1>
      <p className="opacity-80">
        Swap on Base with 1% auto-burn to $TOBY. Join the lore. 🐸
      </p>
      <a className="pill pill-nav inline-block mt-6" href="/">
        Open the App
      </a>
    </main>
  );
}
