"use client";

import Image from "next/image";
import Link from "next/link";
import LinkMaybeMini from "@/components/LinkMaybeMini";

type Accent = "blue" | "cyan" | "green" | "gold";

type Destination = {
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
  icon: string;
  accent: Accent;
};

const communityLinks: Destination[] = [
  {
    eyebrow: "LORE IN THE WILD",
    title: "Tobyisms",
    copy: "Dedicated to recording and spreading Toad lore IRL.",
    href: "https://www.tobyisms.com/",
    icon: "/tokens/toby.PNG",
    accent: "blue",
  },
  {
    eyebrow: "COMMUNITY KNOWLEDGE",
    title: "ToadVault",
    copy: "Speculation profiles, consensus theories, predictions, reactions and the Tobyworld mindshare map — mined from Toad Gang history.",
    href: "https://toadvault.xyz",
    icon: "/tokens/sato.PNG",
    accent: "cyan",
  },
  {
    eyebrow: "TOAD MERCH",
    title: "Community Store",
    copy: "Wear a little bit of the pond out in the world.",
    href: "https://slice.so/store/2223",
    icon: "/tokens/taboshi.PNG",
    accent: "gold",
  },
];

const pondLinks: Destination[] = [
  {
    eyebrow: "YOUR WORLD",
    title: "My Tobyworld",
    copy: "Pouch, Seeds, relics, Lore Land and your place in the world.",
    href: "/taboshi1",
    icon: "/seed.png",
    accent: "green",
  },
  {
    eyebrow: "COMMUNITY WORLD",
    title: "Explore Lands",
    copy: "Wander named Lore Lands and visit community places.",
    href: "/world",
    icon: "/tokens/sato.PNG",
    accent: "cyan",
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
];

function ExternalArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 16 16 8M10 8h6v6" />
    </svg>
  );
}

function renderDestination(item: Destination, compact = false) {
  const content = (
    <>
      <span className={`relative shrink-0 overflow-hidden rounded-2xl pond-link-icon pond-link-${item.accent} ${compact ? "h-11 w-11" : "h-12 w-12"}`}>
        <Image src={item.icon} alt="" fill sizes={compact ? "44px" : "48px"} className="object-contain p-1" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="world-kicker block">{item.eyebrow}</span>
        <span className="mt-0.5 block font-extrabold text-[var(--ink)]">{item.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-inkSub">{item.copy}</span>
      </span>
      <span className="community-link-arrow" aria-hidden="true"><ExternalArrow /></span>
    </>
  );

  const className = `${compact ? "pond-compact-link" : "community-site-card"} pond-destination-${item.accent} group`;
  return item.href.startsWith("/")
    ? <Link prefetch={false} key={item.title} href={item.href} className={className}>{content}</Link>
    : <LinkMaybeMini key={item.title} href={item.href} className={className}>{content}</LinkMaybeMini>;
}

export default function WorldLinks() {
  return (
    <section className="world-card pond-side-card pond-explore p-5 sm:p-6 lg:sticky lg:top-24">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="world-kicker">THE WORLD AROUND THE POND</div>
          <h2 className="mt-1 text-2xl font-black tracking-[-.035em]">Explore Tobyworld</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-inkSub">
            Start with the official world, then explore what the community has built around it.
          </p>
        </div>
        <div className="mini-art-stack" aria-hidden="true">
          <span className="mini-art-back"><Image src="/tokens/sato.PNG" alt="" fill sizes="44px" className="object-cover" /></span>
          <span className="mini-art-front"><Image src="/tokens/toby.PNG" alt="" fill sizes="52px" className="object-contain" /></span>
        </div>
      </div>

      <LinkMaybeMini href="https://tobyworld.app" className="official-tobyworld-card group">
        <span className="official-site-art" aria-hidden="true">
          <Image src="/tokens/toby.PNG" alt="" fill sizes="78px" className="object-contain" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="official-site-badge"><span className="status-dot" /> OFFICIAL TOBYWORLD</span>
          <strong className="official-site-title">Enter Tobyworld</strong>
          <span className="official-site-copy">The canonical home of $TOBY, ecosystem lore, token information and official paths through the pond.</span>
          <span className="official-site-domain">tobyworld.app</span>
        </span>
        <span className="official-site-arrow" aria-hidden="true"><ExternalArrow /></span>
      </LinkMaybeMini>

      <div className="pond-community-block">
        <div className="pond-link-section-heading">
          <div>
            <span className="world-kicker">MADE BY THE TOAD GANG</span>
            <h3>Community sites</h3>
          </div>
          <span className="community-independent-pill">COMMUNITY</span>
        </div>
        <p className="pond-link-section-copy">Independent places for lore, theories, culture and things made around Tobyworld.</p>
        <div className="grid gap-3">
          {communityLinks.map((item) => renderDestination(item))}
        </div>
      </div>

      <div className="pond-more-block">
        <div className="pond-link-section-heading pond-link-section-heading-small">
          <div>
            <span className="world-kicker">KEEP EXPLORING</span>
            <h3>More around the pond</h3>
          </div>
        </div>
        <div className="grid gap-2.5">
          {pondLinks.map((item) => renderDestination(item, true))}
        </div>
      </div>

      <LinkMaybeMini
        href="https://basescan.org/address/0xfC098D8d13CD4583715ECc2eFC1894F39947599d"
        className="metal-button mt-4 flex w-full items-center justify-between px-4 py-3 text-xs font-semibold"
      >
        <span><span className="status-dot mr-2 inline-block" />TobySwap verified contract</span>
        <span className="font-mono text-[10px] sm:text-xs">0xfC09…599d ↗</span>
      </LinkMaybeMini>

      <div className="pond-community-note mt-4 flex items-center gap-3 rounded-[20px] border border-[var(--line)] px-4 py-3">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full shadow-sm">
          <Image src="/tokens/sato.PNG" alt="Sato" fill sizes="36px" className="object-cover" />
        </div>
        <p className="text-[11px] leading-relaxed text-inkSub">
          Official and community links are labeled separately so it is always clear which part of the pond you are visiting.
        </p>
      </div>
    </section>
  );
}
