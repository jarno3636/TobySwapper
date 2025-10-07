import Image from "next/image";
import dynamic from "next/dynamic";
import SwapForm from "@/components/SwapForm";
import Footer from "@/components/Footer";

// Defer heavy, data-fetching UI to the client
const TokensBurned = dynamic(() => import("@/components/TokensBurned"), {
  ssr: false,
  loading: () => (
    <div className="glass rounded-3xl p-6 shadow-soft mt-6 animate-pulse">
      <div className="h-5 w-40 bg-white/10 rounded mb-4" />
      <div className="h-10 w-64 bg-white/10 rounded mb-3" />
      <div className="h-3 w-full bg-white/10 rounded" />
    </div>
  ),
});

const InfoWheel = dynamic(() => import("@/components/InfoWheel"), {
  ssr: false,
  loading: () => (
    <div className="glass rounded-3xl p-5 shadow-soft w-full" style={{ maxWidth: 380 }}>
      <div className="h-5 w-44 bg-white/10 rounded mb-4" />
      <div className="mx-auto rounded-full bg-white/10" style={{ width: 220, height: 220 }} />
      <div className="mt-3 h-7 bg-white/10 rounded" />
    </div>
  ),
});

// super-tiny blur (1×1) to avoid pulling large placeholder assets
const BLUR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4BwQACgAB3y2e1iAAAAAASUVORK5CYII=";

export default function Page() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* LEFT */}
          <div className="flex flex-col items-center md:items-start">
            {/* Hero image */}
            <div className="glass rounded-3xl overflow-hidden mb-6 relative aspect-[4/3] w-full max-w-full sm:max-w-[520px]">
              <Image
                src="/toby-hero.PNG"
                alt="Toby hero"
                fill
                // keep bandwidth conservative; phones never need > 90vw here
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 520px"
                className="object-contain"
                priority
                placeholder="blur"
                blurDataURL={BLUR}
                // slightly lower quality helps PNGs
                quality={70}
              />
            </div>

            <h1 className="text-3xl font-bold mb-4 text-center md:text-left">
              Swap. Burn. Spread the Lore.
            </h1>

            <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6 w-full">
              <span className="pill bg-[var(--glass)] text-sm">1% auto-burn to $TOBY 🔥</span>
              <span className="pill bg-[var(--glass)] text-sm">Swap USDC, WETH, Patience, Taboshi</span>
              <span className="pill bg-[var(--glass)] text-sm">Fuel the meme · Join the lore 🐸</span>
            </div>

            <div className="w-full max-w-full sm:max-w-[520px]">
              <SwapForm />
              {/* Lazy, client-only to avoid blocking first paint */}
              <TokensBurned />
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex w-full justify-center">
            <div className="w-full" style={{ maxWidth: 380 }}>
              {/* Lazy, compact wheel */}
              <InfoWheel />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
