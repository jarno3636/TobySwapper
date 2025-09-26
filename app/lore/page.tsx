// app/lore/page.tsx
import Image from "next/image"
import Link from "next/link"

const OFFICIAL = [
  { label: "Site", href: "https://toadgod.xyz" },
  { label: "X", href: "https://x.com/toadgod1017" },
  { label: "Telegram", href: "https://t.me/toadgang/212753" },
]

const CONTRACTS = [
  {
    label: "$TOBY",
    href: "https://basescan.org/address/0xb8D98a102b0079B69FFbc760C8d857A31653e56e",
    addr: "0xb8D98a102b0079B69FFbc760C8d857A31653e56e",
    icon: "/tokens/toby.PNG",
  },
  {
    label: "$PATIENCE",
    href: "https://basescan.org/address/0x6D96f18F00B815B2109A3766E79F6A7aD7785624",
    addr: "0x6D96f18F00B815B2109A3766E79F6A7aD7785624",
    icon: "/tokens/patience.PNG",
  },
  {
    label: "$TABOSHI",
    href: "https://basescan.org/address/0x3a1a33cf4553db61f0db2c1e1721cd480b02789f",
    addr: "0x3a1a33cf4553db61f0db2c1e1721cd480b02789f",
    icon: "/tokens/taboshi.PNG",
  },
  {
    label: "USDC",
    href: "https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    addr: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    icon: "/tokens/usdc.PNG",
  },
  {
    label: "Swapper Contract",
    href: "https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c",
    addr: "0x6da391f470a00a206dded0f5fc0f144cae776d7c",
    icon: "/tokens/weth.PNG", // neutral gear icon not available; reusing WETH style as placeholder
  },
  {
    label: "Router",
    href: "https://basescan.org/address/0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    addr: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    icon: "/tokens/weth.PNG",
  },
]

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function LorePage() {
  return (
    <main className="maxw py-10">
      {/* Title / Intro */}
      <section
        className="mb-6 rounded-3xl border-2 border-black p-6 md:p-8 shadow-[0_10px_0_#000]
                   bg-[radial-gradient(80%_140%_at_10%_0%,rgba(124,58,237,.25),transparent),linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.08))]">
        <h1 className="brand-title mb-1">TobyWorld Lore & Links</h1>
        <p className="text-sm md:text-base text-white/80">
          Everything official in one place—socials, contracts, and a quick peek under the hood.
        </p>
      </section>

      <div className="grid gap-6">
        {/* Official */}
        <section
          className="rounded-3xl border-2 border-black p-6 md:p-8 shadow-[0_10px_0_#000]
                     bg-[radial-gradient(70%_120%_at_12%_0%,rgba(34,211,238,.25),transparent),linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.86))] text-black">
          <h2 className="section-title mb-2">Official</h2>
          <p className="text-black/70 mb-4 text-sm">
            Primary touchpoints for announcements, vibes, and community coordination.
          </p>
          <div className="flex flex-wrap gap-2">
            {OFFICIAL.map((x) => (
              <a
                key={x.label}
                className="nav-pill"
                href={x.href}
                target="_blank"
                rel="noreferrer"
              >
                {x.label} →
              </a>
            ))}
          </div>
        </section>

        {/* Contracts (with token badges) */}
        <section
          className="rounded-3xl border-2 border-black p-6 md:p-8 shadow-[0_10px_0_#000]
                     bg-[radial-gradient(70%_130%_at_85%_0%,rgba(196,181,253,.28),transparent),linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.9))] text-black">
          <h2 className="section-title mb-2">Contracts (Base)</h2>
          <p className="text-black/70 mb-4 text-sm">
            Verified addresses for core tokens and infrastructure. Always confirm on BaseScan before interacting.
          </p>

          {/* Badge Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CONTRACTS.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border-2 border-black p-3 shadow-[0_6px_0_#000]
                           bg-[linear-gradient(135deg,rgba(255,255,255,.96),rgba(255,255,255,.9))]"
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={c.icon}
                    alt={`${c.label} icon`}
                    width={32}
                    height={32}
                    className="rounded-md border-2 border-black bg-white"
                    priority={c.label === "$TOBY"}
                  />
                  <div className="min-w-0">
                    <div className="font-extrabold leading-tight text-black">{c.label}</div>
                    <div className="text-[11px] text-black/60 break-all">{short(c.addr)}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noreferrer"
                    className="nav-pill w-full justify-center no-underline"
                    title={`Open ${c.label} on BaseScan`}
                  >
                    View on BaseScan
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-black/60">
            Tip: Save these as “trusted” in your wallet/UI so you don’t get caught by lookalikes.
          </div>
        </section>

        {/* Explainer */}
        <section
          className="rounded-3xl border-2 border-black p-6 md:p-8 shadow-[0_10px_0_#000]
                     bg-[radial-gradient(90%_120%_at_15%_0%,rgba(121,255,225,.28),transparent),linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.92))] text-black">
          <h2 className="section-title mb-2">How the Swapper Burns</h2>
          <div className="grid md:grid-cols-[auto,1fr] gap-5 items-start">
            <div className="rounded-2xl border-2 border-black bg-white px-3 py-2 shadow-[0_6px_0_#000] text-xs font-bold text-black/70">
              🔥 Burn Flow
            </div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-black/80">
              <li>Every swap takes a <b>1% fee</b> inside the Swapper contract.</li>
              <li>The fee is routed via the Base router to <b>buy $TOBY</b>.</li>
              <li>Purchased $TOBY is sent to the burn wallet <code className="pill">0x…dEaD</code>.</li>
              <li>Burns reduce circulating supply over time. <b>Supply down, vibes up.</b></li>
            </ul>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="nav-pill" href="/">Open Swapper</Link>
            <a
              className="nav-pill"
              href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c"
              target="_blank"
              rel="noreferrer"
            >
              View Swapper on BaseScan
            </a>
          </div>
        </section>

        {/* Safety note */}
        <section
          className="rounded-3xl border-2 border-black p-4 md:p-6 shadow-[0_8px_0_#000]
                     bg-[radial-gradient(60%_140%_at_80%_0%,rgba(248,113,113,.25),transparent),linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.88))] text-black">
          <div className="text-xs text-black/70">
            <b>Heads up:</b> Always verify token contracts and router addresses before approving. Never share private keys or seed phrases.
          </div>
        </section>
      </div>
    </main>
  )
}
