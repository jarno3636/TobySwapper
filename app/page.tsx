// app/page.tsx
import Image from "next/image";
import SwapForm from "@/components/SwapForm";

export default function Page() {
  return (
    <div className="grid md:grid-cols-2 gap-8 items-start">
      <div>
        <div className="glass rounded-3xl overflow-hidden mb-6 relative aspect-[16/10]">
          <Image
            src="/toby-hero.PNG"
            alt="Toby hero"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            /* removed onError (server components can't take event handlers) */
          />
        </div>

        <h1 className="text-3xl font-bold mb-3">Swap with Toby Magic 🐸✨</h1>
        <p className="text-inkSub mb-6">
          Dark glass. Color pips. 1% of every swap buys $TOBY and burns it.
        </p>
        <SwapForm />
      </div>

      <div className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="font-semibold mb-3">Quick Links</h3>
        <ul className="space-y-2 text-sm">
          <li><a className="underline" href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c#code" target="_blank">Swapper Contract (BaseScan)</a></li>
          <li><a className="underline" href="https://toadgod.xyz" target="_blank">toadgod.xyz</a></li>
          <li><a className="underline" href="https://x.com/toadgod1017" target="_blank">@toadgod1017 on X</a></li>
          <li><a className="underline" href="https://t.me/toadgang/212753" target="_blank">Toby Telegram</a></li>
        </ul>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {["/tokens/toby.PNG","/tokens/patience.PNG","/tokens/taboshi.PNG","/tokens/usdc.PNG","/tokens/weth.PNG","/toby.PNG"].map((src, i) => (
            <div key={src+i} className="aspect-square glass rounded-2xl overflow-hidden relative">
              <Image src={src} alt="token art" fill sizes="160px" className="object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
