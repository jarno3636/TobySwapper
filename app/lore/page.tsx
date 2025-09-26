// app/lore/page.tsx
import Image from "next/image"
import Link from "next/link"

/** Official links */
const OFFICIAL = [
  { label: "Shrine", href: "https://toadgod.xyz", icon: "🛕" },
  { label: "X / Announcements", href: "https://x.com/toadgod1017", icon: "📣" },
  { label: "Telegram / Toadgang", href: "https://t.me/toadgang/212753", icon: "💬" },
]

/** Contracts & infra (Base) */
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
    icon: "/tokens/weth.PNG", // placeholder gear style
  },
  {
    label: "Router",
    href: "https://basescan.org/address/0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    addr: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    icon: "/tokens/weth.PNG",
  },
]

/** Short lore one-liners */
const LORE_PILLS = [
  "🐸 Toby moves the swamp—liquidity with a grin.",
  "🔥 Every swap tithes 1% to buy & burn $TOBY.",
  "🌀 Routes go clean: token → WETH → USDC (when needed).",
  "📜 Patience & Taboshi: companions in the saga.",
  "🛕 The Shrine holds story; the chain holds truth.",
  "💠 Base L2: low fees, high ritual frequency.",
  "🌫️ Supply down, vibes up.",
  "🧭 Verify contracts; walk wisely.",
]

/** Tiny tenets (ultra concise) */
const TENETS = [
  { k: "Tithe", v: "1% fuels the flame." },
  { k: "Route", v: "Token → WETH → USDC (or direct)." },
  { k: "Burn", v: "$TOBY to 0x…dEaD." },
  { k: "Terrain", v: "We dwell on Base." },
  { k: "Witness", v: "Lore speaks; chain confirms." },
]

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function LorePage() {
  return (
    <main className="maxw py-10">
      {/* INTRO — dark premium card */}
      <section className="section">
        <div className="cel-card cel-card--plum p-6 md:p-8">
          <h1 className="section-title mb-2">The TobyWorld Codex</h1>
          <p className="text-sm md:text-base text-white/85">
            Official paths. Sacred contracts. Rites that turn trades into embers.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {LORE_PILLS.map((t) => (
              <span key={t} className="pill pill--glass">{t}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="stack-lg">
        {/* OFFICIAL */}
        <section className="section">
          <div className="cel-card cel-card--teal p-6 md:p-8">
            <div className="section-title mb-2">Waystones</div>
            <div className="flex flex-wrap gap-2">
              {OFFICIAL.map((x) => (
                <a
                  key={x.label}
                  className="nav-pill"
                  href={x.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {x.icon} {x.label} →
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* TENETS */}
        <section className="section">
          <div className="cel-card cel-card--sunset p-6 md:p-8">
            <div className="section-title mb-3">Swamp Tenets</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TENETS.map((t) => (
                <div
                  key={t.k}
                  className="rounded-2xl border-2 border-black p-3 shadow-[0_6px_0_#000]
                             bg-[linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.04))]"
                >
                  <div className="text-xs font-bold text-white/70 mb-1">{t.k}</div>
                  <div className="font-extrabold">{t.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="pill pill--glass-accent" href="/">Open the Swapper</Link>
              <a
                className="pill pill--glass"
                href="https://warpcast.com/~/compose?text=In%20the%20swamp%2C%20every%20trade%20feeds%20the%20flame.%20%F0%9F%94%A5%20%23TobyWorld"
                target="_blank"
                rel="noreferrer"
              >
                ✨ Cast to Farcaster
              </a>
            </div>
          </div>
        </section>

        {/* CONTRACTS */}
        <section className="section">
          <div className="cel-card cel-card--mint p-6 md:p-8">
            <div className="section-title mb-2">Contracts (Base)</div>
            <div className="card-grid">
              {CONTRACTS.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border-2 border-black p-3 shadow-[0_6px_0_#000]
                             bg-[linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.06))]"
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
                      <div className="font-extrabold leading-tight">{c.label}</div>
                      <div className="text-[11px] text-white/70 break-all">{short(c.addr)}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <a
                      href={c.href}
                      target="_blank"
                      rel="noreferrer"
                      className="nav-pill w-full justify-center no-underline"
                      title={`Open ${c.label} on BaseScan`}
                    >
                      View on BaseScan
                    </a>
                    {c.label === "$TOBY" && (
                      <a
                        href="https://warpcast.com/~/compose?text=Reading%20the%20%24TOBY%20scrolls%20on%20Base%20%F0%9F%90%B8"
                        target="_blank"
                        rel="noreferrer"
                        className="pill pill--glass w-full justify-center text-center"
                      >
                        📜 Share the scroll
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-white/80">
              Tip: Save trusted addresses; dodge mirror contracts.
            </div>
          </div>
        </section>

        {/* BURN EXPLAINER */}
        <section className="section">
          <div className="cel-card cel-card--plum p-6 md:p-8">
            <div className="section-title mb-2">Rite of Flame</div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-white/85">
              <li>Each swap pays a <b>1% tithe</b>.</li>
              <li>Tithe routes to buy <b>$TOBY</b>.</li>
              <li>$TOBY is consigned to <code className="pill pill--muted">0x…dEaD</code>.</li>
              <li>Irreversible. <b>Supply down, signal up.</b></li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="nav-pill" href="/">Open Swapper</Link>
              <a
                className="nav-pill"
                href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c"
                target="_blank"
                rel="noreferrer"
              >
                Swapper on BaseScan →
              </a>
            </div>
          </div>
        </section>

        {/* SAFETY */}
        <section className="section">
          <div className="cel-card p-4 md:p-6">
            <div className="text-xs text-white/80">
              <b>Heads up:</b> Verify contracts and routers before approvals. Never share seed phrases.
              If a route looks odd, pause and confirm on BaseScan.
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
