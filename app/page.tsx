import Image from "next/image";
import SwapForm from "@/components/SwapForm";
import TokensBurned from "@/components/TokensBurned";
import Footer from "@/components/Footer";
import AboutTeaser from "@/components/AboutTeaser";

export default function Page() {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* LEFT SIDE */}
        <div>
          {/* Hero image - smaller so it doesn’t crop */}
          <div className="glass rounded-3xl overflow-hidden mb-6 relative aspect-[4/3]">
            <Image
              src="/toby-hero.PNG"
              alt="Toby hero"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain"
            />
          </div>

          {/* Header + Pills */}
          <h1 className="text-3xl font-bold mb-4">Swap. Burn. Spread the Lore.</h1>
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="pill bg-[var(--glass)] text-sm">1% auto-burn to $TOBY 🔥</span>
            <span className="pill bg-[var(--glass)] text-sm">Swap USDC, WETH, Patience, Taboshi</span>
            <span className="pill bg-[var(--glass)] text-sm">Fuel the meme · Join the lore 🐸</span>
          </div>

          <SwapForm />

          {/* 🔥 Burn tracker + share CTAs */}
          <TokensBurned />

          {/* Teaser → About (client push) */}
          <AboutTeaser />
        </div>

        {/* RIGHT SIDE - Contracts */}
        <div className="glass rounded-3xl p-6 shadow-soft">
          <h3 className="font-semibold mb-6">Contracts</h3>

          <div className="grid grid-cols-3 gap-4">
            {[
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
            ].map((token, i) => (
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
      </div>

      {/* Footer */}
      <Footer />
    </>
  );
}
