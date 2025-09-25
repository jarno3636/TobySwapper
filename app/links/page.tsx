"use client"

import Link from "next/link"

export default function LinksPage() {
  return (
    <main className="min-h-screen mx-auto max-w-6xl px-4 pb-16">
      <section className="cel-card p-6 md:p-8 space-y-6">
        <div className="section-title">Ecosystem Links</div>
        <p className="text-sm text-black/80">
          Official links and contracts for the TobyWorld ecosystem.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Ecosystem */}
          <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_6px_0_#000]">
            <div className="font-extrabold mb-3">Community</div>
            <ul className="space-y-2 text-sm text-black/85">
              <li><a className="pill" href="https://toadgod.xyz" target="_blank" rel="noreferrer">Creator Website</a></li>
              <li><a className="pill" href="https://x.com/toadgod1017" target="_blank" rel="noreferrer">Creator on X</a></li>
              <li><a className="pill" href="https://t.me/toadgang/212753" target="_blank" rel="noreferrer">Toby Telegram</a></li>
            </ul>
          </div>

          {/* Contracts */}
          <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_6px_0_#000]">
            <div className="font-extrabold mb-3">Contracts</div>
            <ul className="space-y-2 text-sm text-black/85">
              <li><a className="pill" href="https://basescan.org/address/0xb8D98a102b0079B69FFbc760C8d857A31653e56e" target="_blank" rel="noreferrer">$TOBY</a></li>
              <li><a className="pill" href="https://basescan.org/address/0x6D96f18F00B815B2109A3766E79F6A7aD7785624" target="_blank" rel="noreferrer">$PATIENCE</a></li>
              <li><a className="pill" href="https://basescan.org/address/0x3a1a33cf4553db61f0db2c1e1721cd480b02789f" target="_blank" rel="noreferrer">$TABOSHI</a></li>
              <li><a className="pill" href="https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" target="_blank" rel="noreferrer">USDC (Base)</a></li>
              <li><a className="pill" href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c" target="_blank" rel="noreferrer">Swapper</a></li>
              <li><a className="pill" href="https://basescan.org/address/0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" target="_blank" rel="noreferrer">Router</a></li>
            </ul>
            <p className="text-xs text-black/60 mt-3">
              The 1% fee is handled on-chain by the Swapper contract and routed to buy TOBY then burn to 0x…dEaD.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
