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
          {/* LEFT */}
          <div className="flex flex-col items-center md:items-start">
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

            <h1 className="text-3xl font-bold mb-4 text-center md:text-left">Swap. Burn. Spread the Lore.</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6 w-full">
              <span className="pill bg-[var(--glass)] text-sm">1% auto-burn to $TOBY 🔥</span>
              <span className="pill bg-[var(--glass)] text-sm">Swap USDC, WETH, Patience, Taboshi</span>
              <span className="pill bg-[var(--glass)] text-sm">Fuel the meme · Join the lore 🐸</span>
            </div>

            <div className="w-full max-w-full sm:max-w-[520px]">
              <SwapForm />
              <TokensBurned />
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex w-full justify-center">
            <div className="w-full max-w-full sm:max-w-[520px]">
              <InfoWheel />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
