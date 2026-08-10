"use client";

import Image from "next/image";
import LinkMaybeMini from "@/components/LinkMaybeMini";

function SwapDockIcon() {
  return (
    <span className="dock-art dock-art-swap" aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <path d="M15 23h28l-7-7" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M49 41H21l7 7" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <i className="dock-glint" />
    </span>
  );
}

function AtlasDockIcon() {
  return (
    <span className="dock-art dock-art-atlas" aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="4"/>
        <path d="M10 32h44M32 10c8 8 11 15 11 22S40 46 32 54M32 10c-8 8-11 15-11 22s3 14 11 22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        <path d="M39 18c7 1 11 5 12 10-7 2-12 0-15-5 0-2 1-4 3-5Z" className="atlas-leaf"/>
      </svg>
      <i className="dock-glint" />
    </span>
  );
}

const items = [
  { label: "Swap", href: "#swap", kind: "local" as const, custom: "swap" as const, tone: "blue" },
  { label: "World Atlas", href: "https://farcaster.xyz/miniapps/6RxWwBQYOf63/tobyworld-atlas", kind: "external" as const, custom: "atlas" as const, tone: "green" },
  { label: "Hop", href: "https://farcaster.xyz/miniapps/rTQGt2rMfgOF/toby-hop", kind: "external" as const, icon: "/tokens/toby.PNG", tone: "cyan" },
  { label: "Vault", href: "https://toadvault.xyz", kind: "external" as const, icon: "/tokens/patience.PNG", tone: "red" },
] as const;

function DockVisual({ item }: { item: (typeof items)[number] }) {
  if ("custom" in item && item.custom === "swap") return <SwapDockIcon />;
  if ("custom" in item && item.custom === "atlas") return <AtlasDockIcon />;
  return (
    <span className={`pond-dock-icon pond-dock-${item.tone}`}>
      <Image src={("icon" in item && item.icon) || "/tokens/toby.PNG"} alt="" fill sizes="42px" className="object-contain p-1" />
      <i className="dock-glint" />
    </span>
  );
}

function DockItem({ item }: { item: (typeof items)[number] }) {
  const content = <><DockVisual item={item} /><span className="pond-dock-label">{item.label}</span></>;
  if (item.kind === "local") return <a className="pond-dock-item pond-dock-active" href={item.href} aria-label="Go to swap">{content}</a>;
  return <LinkMaybeMini href={item.href} className="pond-dock-item">{content}</LinkMaybeMini>;
}

export default function PondDock() {
  return (
    <nav className="pond-dock-wrap" aria-label="TobySwap shortcuts">
      <div className="pond-dock-shine" aria-hidden="true" />
      <div className="pond-dock">
        {items.map((item) => <DockItem key={item.label} item={item} />)}
      </div>
    </nav>
  );
}
