"use client";

import Image from "next/image";
import Link from "next/link";
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


const items = [
  { id: "swap", label: "Pond", href: "/#swap", custom: "swap" as const },
  { id: "pouch", label: "Pouch", href: "/taboshi1#pouch", icon: "/seed.png" },
  { id: "world", label: "World", href: "/world", custom: "atlas" as const },
  { id: "market", label: "Market", href: "/world/exchange", icon: "/tokens/taboshi.PNG" },
] as const;

function DockVisual({ item }: { item: (typeof items)[number] }) {
  if ("custom" in item && item.custom === "swap") return <SwapDockIcon />;
  if ("custom" in item && item.custom === "atlas") return <AtlasDockIcon />;
  return <span className="pond-dock-icon"><Image src={("icon" in item && item.icon) || "/tokens/toby.PNG"} alt="" fill sizes="42px" className="object-contain p-1" /><i className="dock-glint" /></span>;
}

export default function PondDock({ active }: { active?: "swap" | "pouch" | "world" | "market" }) {
  return (
    <nav className="pond-dock-wrap" aria-label="TobySwap shortcuts">
      <div className="pond-dock-shine" aria-hidden="true" />
      <div className="pond-dock">
        {items.map((item) => {
          const content = <><DockVisual item={item} /><span className="pond-dock-label">{item.label}</span></>;
          const className = `pond-dock-item ${active === item.id ? "pond-dock-active" : ""}`;
          if (item.href.startsWith("/")) return <Link key={item.id} className={className} href={item.href} prefetch={false}>{content}</Link>;
          return <LinkMaybeMini key={item.id} href={item.href} className={className}>{content}</LinkMaybeMini>;
        })}
      </div>
    </nav>
  );
}
