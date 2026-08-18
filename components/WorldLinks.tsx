"use client";

import Image from "next/image";
import LinkMaybeMini from "@/components/LinkMaybeMini";

const links = [
  {
    eyebrow: "YOUR WORLD",
    title: "My Tobyworld",
    copy: "Your wallet profile—pouch, Seeds, relics, Lore Land, contributions and discoveries.",
    href: "/taboshi1",
    icon: "/seed.png",
    accent: "green",
  },
  {
    eyebrow: "WORLD",
    title: "Tobyworld",
    copy: "Enter the official Tobyworld experience and follow the lore.",
    href: "https://tobyworld.app",
    icon: "/tokens/toby.PNG",
    accent: "blue",
  },
  {
    eyebrow: "VAULT",
    title: "ToadVault",
    copy: "Explore assets, contracts, lore and Tobyworld ecosystem references.",
    href: "https://toadvault.xyz",
    icon: "/tokens/taboshi.PNG",
    accent: "green",
  },
  {
    eyebrow: "MINI APP",
    title: "Toby Hop",
    copy: "One hop every day. Keep your pond streak moving.",
    href: "https://farcaster.xyz/miniapps/rTQGt2rMfgOF/toby-hop",
    icon: "/tokens/toby.PNG",
    accent: "blue",
  },
  {
    eyebrow: "MINI APP",
    title: "Tobyworld Atlas",
    copy: "Explore the map, paths, lore and hidden corners of the pond.",
    href: "https://farcaster.xyz/miniapps/6RxWwBQYOf63/tobyworld-atlas",
    icon: "/tokens/sato.PNG",
    accent: "cyan",
  },
] as const;

export default function WorldLinks() {
  return (
    <section className="world-card pond-side-card pond-explore p-5 sm:p-6 lg:sticky lg:top-24">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="world-kicker">THE POND</div>
          <h2 className="mt-1 text-2xl font-black tracking-[-.035em]">Explore Tobyworld</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-inkSub">
            Swap here, then move through the community-built pond.
          </p>
        </div>
        <div className="mini-art-stack" aria-hidden="true">
          <span className="mini-art-back"><Image src="/tokens/sato.PNG" alt="" fill sizes="44px" className="object-cover" /></span>
          <span className="mini-art-front"><Image src="/tokens/toby.PNG" alt="" fill sizes="52px" className="object-contain" /></span>
        </div>
      </div>

      <div className="pond-path-line" aria-hidden="true" />
      <div className="grid gap-3 pond-destination-grid">
        {links.map((item) => {
          const content = (
            <>
              <span className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl pond-link-icon pond-link-${item.accent}`}>
                <Image src={item.icon} alt="" fill sizes="48px" className="object-contain p-1" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="world-kicker block">{item.eyebrow}</span>
                <span className="mt-0.5 block font-extrabold text-[var(--ink)]">{item.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-inkSub">{item.copy}</span>
              </span>
              <span className="metal-arrow" aria-hidden="true">↗</span>
            </>
          );
          const className = `world-link-card pond-destination pond-destination-${item.accent} group`;
          return item.href.startsWith("/")
            ? <a key={item.title} href={item.href} className={className}>{content}</a>
            : <LinkMaybeMini key={item.title} href={item.href} className={className}>{content}</LinkMaybeMini>;
        })}
      </div>

      <LinkMaybeMini
        href="https://basescan.org/address/0xfC098D8d13CD4583715ECc2eFC1894F39947599d"
        className="metal-button mt-4 flex w-full items-center justify-between px-4 py-3 text-xs font-semibold"
      >
        <span><span className="status-dot mr-2 inline-block" />Verified contract</span>
        <span className="font-mono text-[10px] sm:text-xs">0xfC09…599d ↗</span>
      </LinkMaybeMini>

      <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[#f7fbfd] px-4 py-3">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full shadow-sm">
          <Image src="/tokens/sato.PNG" alt="Sato" fill sizes="36px" className="object-cover" />
        </div>
        <p className="text-[11px] leading-relaxed text-inkSub">
          Built for the Tobyworld pond. Always review the quote and wallet confirmation before swapping.
        </p>
      </div>
    </section>
  );
}
