// app/page.tsx
import Image from "next/image";
import SwapForm from "@/components/SwapForm";
import Footer from "@/components/Footer";

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
              className="object-contain" // <-- contain instead of cover
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
                href: "https://basescan.org/address/0xbcad0a417b299f611f386e9ab38a049e06494c0c",
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
                src: "/toby.PNG",
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
