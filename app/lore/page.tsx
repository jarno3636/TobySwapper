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

/** Lore one-liners (glass chips) */
const LORE_PILLS = [
  "🐸 Toby is the current of the swamp—liquidity with a grin.",
  "🔥 Every rite (swap) tithes 1% to buy & burn $TOBY.",
  "🌀 Fees spiral through WETH where needed—clean routes, steady quotes.",
  "📜 Patience and Taboshi: companions in the Toadgod saga.",
  "🛕 The Shrine guards the myths; the chain holds the truth.",
  "💠 Base L2 terrain—low fees, high ritual frequency.",
  "🌫️ Supply down, vibes up—smoke from the altar.",
  "🧭 Verify paths, confirm contracts, walk the causeway wisely.",
]

/** Gentle “tenets” to sprinkle the flavor */
const TENETS = [
  { k: "Tithe", v: "1% of every swap feeds the flame." },
  { k: "Route", v: "Token → WETH → USDC (or direct on WETH when cleaner)." },
  { k: "Burn", v: "Purchased $TOBY is sent to 0x…dEaD—no return." },
  { k: "Terrain", v: "We dwell on Base. Switch when the beacon calls." },
  { k: "Witness", v: "All proof on BaseScan. Lore speaks; chain confirms." },
]

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function LorePage() {
  return (
    <main className="maxw py-10">
      {/* Title / Intro */}
      <section
        className="mb-8 rounded-3xl border-2 border-black p-6 md:p-8 shadow-[0_10px_0_#000]
                   bg-[radial-gradient(80%_140%_at_10%_0%,rgba(124,58,237,.28),transparent),radial-gradient(80%_140%_at_90%_0%,rgba(14,165,233,.24),transparent),linear-gradient(180deg,#0b1220,#0f172a)]"
      >
        <h1
          className="mb-2 font-black tracking-tight text-2xl sm:text-3xl md:text-4xl leading-tight"
          style={{
            background:
              "linear-gradient(90deg,#c4b5fd 0%,#79ffe1 50%,#93c5fd 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 2px 0 rgba(0,0,0,.28)",
          }}
        >
          The TobyWorld Codex
        </h1>
        <p className="text-white/85 text-sm md:text-base max-w-3xl">
          Notes from the swamp: official paths, sacred contracts, and the rites that turn trades
          into embers. Read the scrolls, verify the chain, and mind the current.
        </p>

        {/* Lore glass chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {LORE_PILLS.map((t) => (
            <span key={t} className="glass-chip">{t}</span>
          ))}
        </div>
      </section>

      <div className="grid gap-8">
        {/* Official */}
        <section
          className="rounded-3xl border-2 border-black p-6 md:p-8 shadow-[0_10px_0_#000]
                     bg-[radial-gradient(70%_130%_at_12%_0%,rgba(34,211,238,.25),transparent),radial-gradient(70%_130%_at_88%_0%,rgba(196,181,253,.25),transparent),linear-gradient(180deg,rgba(255,255,255,.94),rgba(255,255,255,.88))] text-black"
        >
          <h2 className="section-title mb-2">Official Waystones</h2>
          <p className="text-black/70 mb-4 text-sm">
            Follow the beacon. Announcements, lore drops, and gathering spots for the guild.
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
                {x.icon} {x.label} →
              </a>
            ))}
          </div>
        </section>

        {/* Tenets */}
        <section
          className="rounded-3xl border-2 border-black p-6 md:p-8 shadow-[0_10px_0_#000]
                     bg-[radial-gradient(70%_120%_at_10%_0%,rgba(121,255,225,.30),transparent),linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.90))] text-black"
        >
          <h2 className="section-title mb-2">Swamp Tenets</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TENETS.map((t) => (
              <div
                key={t.k}
                className="rounded-2xl border-2 border-black p-3 shadow-[0_6px_0_#000]
                           bg-[linear-gradient(135deg,rgba(255,255,255,.98),rgba(255,255,255,.92))]"
              >
                <div className="text-xs font-bold text-black/60 mb-1">{t.k}</div>
                <div className="text-black font-extrabold">{t.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="glass-chip" href="/">Open the Swapper</Link>
            <a
              className="glass-chip"
              href="https://warpcast.com/~/compose?text=In%20the%20swamp%2C%20every%20trade%20feeds%20the%20flame.%20%F0%9F%94%A5%20%23TobyWorld"
              target="_blank"
              rel="noreferrer"
            >
              ✨ Cast to Farcaster
            </a>
          </div>
        </section>

        {/* Contracts (with token badges) */}
        <section
          className="rounded-3xl border-2 border-black p-6 md:p-8 shadow-[0_10px_0_#000]
                     bg-[radial-gradient(70%_130%_at_85%_0%,rgba(196,181,253,.28),transparent),linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.9))] text-black"
        >
          <h2 className="section-title mb-2">Contracts (Base)</h2>
          <p className="text-black/70 mb-4 text-sm">
            These are the verified waypoints. Confirm on BaseScan before you grant approvals or
            sign rites.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CONTRACTS.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border-2 border-black p-3 shadow-[0_6px_0_#000]
                           bg-[linear-gradient(135deg,rgba(255,255,255,.98),rgba(255,255,255,.92))]"
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
                      className="glass-chip w-full justify-center text-center"
                    >
                      📜 Share the scroll
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-black/60">
            Tip: Save trusted addresses to your wallet UI; avoid mirrors and mimic contracts.
          </div>
        </section>

        {/* Burn Explainer */}
        <section
          className="rounded-3xl border-2 border-black p-6 md:p-8 shadow-[0_10px_0_#000]
                     bg-[radial-gradient(90%_120%_at_15%_0%,rgba(121,255,225,.30),transparent),linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.92))] text-black"
        >
          <h2 className="section-title mb-2">Rite of Flame (Burn Mechanics)</h2>
          <div className="grid md:grid-cols-[auto,1fr] gap-5 items-start">
            <div className="rounded-2xl border-2 border-black bg-white px-3 py-2 shadow-[0_6px_0_#000] text-xs font-bold text-black/70">
              🔥 Burn Flow
            </div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-black/80">
              <li>Each swap contributes a <b>1% tithe</b> inside the Swapper.</li>
              <li>The tithe is routed via Base’s router to <b>acquire $TOBY</b>.</li>
              <li>Acquired $TOBY is consigned to the burn wallet <code className="pill">0x…dEaD</code>.</li>
              <li>The rite is irreversible: <b>supply lowers, signal rises</b>.</li>
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
              Swapper on BaseScan →
            </a>
          </div>
        </section>

        {/* Safety note */}
        <section
          className="rounded-3xl border-2 border-black p-4 md:p-6 shadow-[0_8px_0_#000]
                     bg-[radial-gradient(60%_140%_at_80%_0%,rgba(248,113,113,.25),transparent),linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.88))] text-black"
        >
          <div className="text-xs text-black/70">
            <b>Heads up:</b> Verify contracts and routers before approvals. Never share seed phrases.
            If a path looks odd, pause and re-check the address on BaseScan.
          </div>
        </section>
      </div>
    </main>
  )
}
