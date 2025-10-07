// app/page.tsx
import Image from "next/image";
import SwapForm from "@/components/SwapForm";
import TokensBurned from "@/components/TokensBurned";
import Footer from "@/components/Footer";
import InfoWheel from "@/components/InfoWheel";

export default function Page() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* LEFT SIDE */}
          <div className="flex flex-col items-center md:items-start">
            {/* Hero image */}
            <div className="glass rounded-3xl overflow-hidden mb-6 relative aspect-[4/3] w-full max-w-full sm:max-w-[520px]">
              <Image
                src="/toby-hero.PNG"
                alt="Toby hero"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 520px"
                className="object-contain"
                priority
              />
            </div>

            {/* Header + Pills */}
            <h1 className="text-3xl font-bold mb-4 text-center md:text-left">
              Swap. Burn. Spread the Lore.
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6 w-full">
              <span className="pill bg-[var(--glass)] text-sm">1% auto-burn to $TOBY 🔥</span>
              <span className="pill bg-[var(--glass)] text-sm">
                Swap USDC, WETH, Patience, Taboshi
              </span>
              <span className="pill bg-[var(--glass)] text-sm">
                Fuel the meme · Join the lore 🐸
              </span>
            </div>

            {/* Swap form + Tokens burned */}
            <div className="w-full max-w-full sm:max-w-[520px]">
              <SwapForm />
              <TokensBurned />
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex flex-col items-center gap-8">
            {/* Wheel centered and constrained for mobile */}
            <div className="w-full flex justify-center">
              <div className="w-full max-w-full sm:max-w-[520px]">
                <InfoWheel />
              </div>
            </div>

            {/* Contracts card */}
            <div className="glass rounded-3xl p-6 shadow-soft w-full max-w-full sm:max-w-[520px]">
              <h3 className="font-semibold mb-6 text-center">Contracts</h3>

              <div className="grid grid-cols-3 gap-4 justify-items-center">
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
                    className="text-center group w-full"
                  >
                    <div className="w-full aspect-square glass rounded-2xl overflow-hidden relative mb-2 transition-transform group-hover:scale-105 max-w-[96px] sm:max-w-[120px] mx-auto">
                      <Image
                        src={token.src}
                        alt={token.title}
                        fill
                        sizes="(max-width: 640px) 96px, 120px"
                        className="object-cover"
                      />
                    </div>
                    <p className="text-xs font-semibold text-[var(--ink)] group-hover:text-accent">
                      {token.title}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
