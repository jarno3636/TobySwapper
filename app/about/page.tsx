// app/about/page.tsx
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "About — TobySwap",
};

export default function AboutPage() {
  const items = [
    {
      src: "/tokens/toby.PNG",
      title: "TOBY",
      href: "https://basescan.org/address/0xb8D98a102b0079B69FFbc760C8d857A31653e56e",
    },
    {
      src: "/tokens/patience.PNG",
      title: "PATIENCE",
      href: "https://basescan.org/address/0x6D96f18F00B815B2109A3766E79F6A7aD7785624",
    },
    {
      src: "/tokens/taboshi.PNG",
      title: "TABOSHI",
      href: "https://basescan.org/address/0x3a1a33cf4553db61f0db2c1e1721cd480b02789f",
    },
    {
      src: "/tokens/usdc.PNG",
      title: "USDC",
      href: "https://basescan.org/address/0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913",
    },
    {
      src: "/tokens/weth.PNG",
      title: "WETH",
      href: "https://basescan.org/address/0x4200000000000000000000000000000000000006",
    },
    {
      src: "/toby2.PNG",
      title: "Swapper",
      href: "https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c#code",
    },
  ];

  const pills = [
    "Base-native swapping, Toby style",
    "1% fee auto-buys $TOBY → burn",
    "USDC / WETH ↔ TOBY · PATIENCE · TABOSHI",
    "Dark glass + playful pips",
  ];

  return (
    <section className="space-y-8">
      {/* Hero */}
      <div className="glass rounded-3xl p-6 shadow-soft">
        <h1 className="text-3xl font-bold mb-3">About TobySwap</h1>
        <div className="flex flex-wrap gap-3 mb-4">
          {pills.map((p) => (
            <span key={p} className="pill bg-[var(--glass)] text-sm">
              {p}
            </span>
          ))}
        </div>
        <p className="text-inkSub">
          TobySwap routes trades on Base and uses a 1% fee to market-buy <span className="font-semibold">$TOBY</span>, then burns it.
          It’s a simple, meme-fueled flywheel: swap → buy $TOBY → burn → lore.
        </p>
      </div>

      {/* Contract cards */}
      <div className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="font-semibold mb-6">Contracts</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((token, i) => (
            <a
              key={i}
              href={token.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center group"
            >
              <div className="aspect-square glass rounded-2xl overflow-hidden relative mb-2 transition-transform group-hover:scale-105">
                <Image
                  src={token.src}
                  alt={token.title}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-ink group-hover:text-accent">
                {token.title}
              </p>
            </a>
          ))}
        </div>
      </div>

      {/* CTA back home */}
      <div className="glass rounded-3xl p-6 shadow-soft text-center">
        <p className="text-sm text-inkSub mb-3">
          Ready to add to the flames?
        </p>
        <Link href="/" className="pill pill-opaque hover:opacity-90 text-sm">
          Burn more TOBY 🔥
        </Link>
      </div>
    </section>
  );
}
