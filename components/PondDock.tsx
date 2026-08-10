"use client";

import Image from "next/image";
import LinkMaybeMini from "@/components/LinkMaybeMini";

function SwapDockIcon() {
  return (
    <span className="dock-art dock-art-swap" aria-hidden="true">
      <svg viewBox="0 0 64 64"><path d="M15 23h28l-7-7" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><path d="M49 41H21l7 7" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <i className="dock-glint" />
    </span>
  );
}

function AtlasDockIcon() {
  return (
    <span className="dock-art dock-art-atlas" aria-hidden="true">
      <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M10 32h44M32 10c8 8 11 15 11 22S40 46 32 54M32 10c-8 8-11 15-11 22s3 14 11 22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M39 18c7 1 11 5 12 10-7 2-12 0-15-5 0-2 1-4 3-5Z" className="atlas-leaf"/></svg>
      <i className="dock-glint" />
    </span>
  );
}

function BurnDockIcon() {
  return (
    <span className="dock-art dock-art-burn" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <path d="M35 8c2 10-4 13-2 20 2-5 7-7 10-12 8 9 12 19 9 29-3 10-11 15-20 15S14 54 12 44c-2-11 5-19 13-27 0 8 3 11 5 13 0-8 2-15 5-22Z" fill="currentColor"/>
        <path d="M32 34c5 6 7 10 5 15-1 4-4 6-7 6s-7-2-8-6c-1-5 3-9 7-14 0 5 2 6 3 7 0-3 0-5 0-8Z" className="burn-core"/>
      </svg>
      <i className="dock-glint" />
    </span>
  );
}

const items = [
  { id: "swap", label: "Swap", href: "/#swap", custom: "swap" as const },
  { id: "burners", label: "Burners", href: "/burners", custom: "burn" as const },
  { id: "atlas", label: "Atlas", href: "https://farcaster.xyz/miniapps/6RxWwBQYOf63/tobyworld-atlas", custom: "atlas" as const },
  { id: "hop", label: "Hop", href: "https://farcaster.xyz/miniapps/rTQGt2rMfgOF/toby-hop", icon: "/tokens/toby.PNG" },
  { id: "vault", label: "Vault", href: "https://toadvault.xyz", icon: "/tokens/patience.PNG" },
] as const;

function DockVisual({ item }: { item: (typeof items)[number] }) {
  if ("custom" in item && item.custom === "swap") return <SwapDockIcon />;
  if ("custom" in item && item.custom === "atlas") return <AtlasDockIcon />;
  if ("custom" in item && item.custom === "burn") return <BurnDockIcon />;
  return <span className="pond-dock-icon"><Image src={("icon" in item && item.icon) || "/tokens/toby.PNG"} alt="" fill sizes="42px" className="object-contain p-1" /><i className="dock-glint" /></span>;
}

export default function PondDock({ active = "swap" }: { active?: "swap" | "burners" }) {
  return (
    <nav className="pond-dock-wrap" aria-label="TobySwap shortcuts">
      <div className="pond-dock-shine" aria-hidden="true" />
      <div className="pond-dock pond-dock-five">
        {items.map((item) => {
          const content = <><DockVisual item={item} /><span className="pond-dock-label">{item.label}</span></>;
          const className = `pond-dock-item ${active === item.id ? "pond-dock-active" : ""}`;
          if (item.id === "swap" || item.id === "burners") return <a key={item.id} className={className} href={item.href}>{content}</a>;
          return <LinkMaybeMini key={item.id} href={item.href} className={className}>{content}</LinkMaybeMini>;
        })}
      </div>
    </nav>
  );
}
