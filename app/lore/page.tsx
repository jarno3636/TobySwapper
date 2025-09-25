import Link from "next/link"

export default function LorePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="cel-card p-6 md:p-8">
        <h1 className="section-title mb-1">TobyWorld Lore & Links</h1>
        <p className="text-black/70 mb-6">
          All the official links and contracts across the TobyWorld ecosystem.
        </p>

        <h2 className="font-extrabold text-black mb-2">Official</h2>
        <div className="flex flex-wrap gap-2 mb-6">
          <a className="pill" href="https://toadgod.xyz" target="_blank" rel="noreferrer">Site</a>
          <a className="pill" href="https://x.com/toadgod1017" target="_blank" rel="noreferrer">X</a>
          <a className="pill" href="https://t.me/toadgang/212753" target="_blank" rel="noreferrer">Telegram</a>
        </div>

        <h2 className="font-extrabold text-black mb-2">Contracts (Base)</h2>
        <ul className="space-y-2 text-sm text-black/80">
          <li><a className="pill" href="https://basescan.org/address/0xb8D98a102b0079B69FFbc760C8d857A31653e56e" target="_blank" rel="noreferrer">$TOBY</a></li>
          <li><a className="pill" href="https://basescan.org/address/0x6D96f18F00B815B2109A3766E79F6A7aD7785624" target="_blank" rel="noreferrer">$PATIENCE</a></li>
          <li><a className="pill" href="https://basescan.org/address/0x3a1a33cf4553db61f0db2c1e1721cd480b02789f" target="_blank" rel="noreferrer">$TABOSHI</a></li>
          <li><a className="pill" href="https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" target="_blank" rel="noreferrer">USDC</a></li>
          <li><a className="pill" href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c" target="_blank" rel="noreferrer">Swapper Contract</a></li>
          <li><a className="pill" href="https://basescan.org/address/0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" target="_blank" rel="noreferrer">Router</a></li>
        </ul>

        <div className="mt-6 text-xs text-black/60">
          1% fee from swaps is used to buy TOBY and burn it to <b>0x…dEaD</b>.
        </div>
      </div>
    </main>
  )
}
