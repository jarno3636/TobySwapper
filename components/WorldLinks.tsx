"use client";

import Image from "next/image";
import LinkMaybeMini from "@/components/LinkMaybeMini";

const links = [
  {
    eyebrow: "WORLD",
    title: "Tobyworld",
    copy: "Enter the official Tobyworld experience and follow the lore.",
    href: "https://tobyworld.app",
    icon: "/tokens/toby.PNG",
  },
  {
    eyebrow: "VAULT",
    title: "ToadVault",
    copy: "Explore Tobyworld assets, contracts, lore and ecosystem references.",
    href: "https://toadvault.xyz",
    icon: "/tokens/taboshi.PNG",
  },
  {
    eyebrow: "MINI APP",
    title: "Toby Hop",
    copy: "One hop every day. Keep your pond streak moving.",
    href: "https://farcaster.xyz/miniapps/rTQGt2rMfgOF/toby-hop",
    icon: "/tokens/toby.PNG",
  },
  {
    eyebrow: "MINI APP",
    title: "Tobyworld Atlas",
    copy: "Explore the map, paths, lore and hidden corners of the pond.",
    href: "https://farcaster.xyz/miniapps/6RxWwBQYOf63/tobyworld-atlas",
    icon: "/tobyworld.PNG",
  },
];

export default function WorldLinks() {
  return (
    <section className="world-card p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="world-kicker">THE POND</div>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Explore Tobyworld</h2>
          <p className="mt-2 max-w-md text-sm text-inkSub">
            Swap here, then keep moving through the community-built pond.
          </p>
        </div>
        <Image src="/toby2.PNG" alt="Toby" width={58} height={58} className="rounded-full" />
      </div>

      <div className="grid gap-3">
        {links.map((item) => (
          <LinkMaybeMini key={item.title} href={item.href} className="world-link-card group">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white">
              <Image src={item.icon} alt="" fill sizes="48px" className="object-contain p-1" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="world-kicker block">{item.eyebrow}</span>
              <span className="mt-0.5 block font-extrabold text-[var(--ink)]">{item.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-inkSub">{item.copy}</span>
            </span>
            <span className="text-xl transition-transform group-hover:translate-x-1">→</span>
          </LinkMaybeMini>
        ))}
      </div>

      <LinkMaybeMini
        href="https://basescan.org/address/0xfC098D8d13CD4583715ECc2eFC1894F39947599d"
        className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 text-xs font-semibold"
      >
        <span>Verified TobySwapper contract</span>
        <span className="font-mono">0xfC09…599d ↗</span>
      </LinkMaybeMini>
    </section>
  );
}
