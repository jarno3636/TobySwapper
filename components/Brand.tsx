"use client";

import Link from "next/link";
import Image from "next/image";
import ConnectPill from "@/components/ConnectPill";
import ThemeToggle from "@/components/ThemeToggle";

const quickLinks = [
  { href: "/world", label: "World" },
  { href: "/taboshi1", label: "My World" },
  { href: "/keepers", label: "Keepers" },
  { href: "/world/exchange", label: "Market" },
] as const;

export default function Brand() {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" prefetch={false} className="brand-lockup group" aria-label="Tobyworld Community home">
          <span className="brand-medallion relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl">
            <Image src="/tokens/toby.PNG" alt="Toby" fill sizes="44px" className="object-contain p-[2px]" priority />
          </span>
          <span className="brand-copy">
            <span className="brand-eyebrow">TOBYSWAP · COMMUNITY LAYER</span>
            <span className="brand-title">Tobyworld Community</span>
          </span>
        </Link>

        <nav className="header-quick-nav" aria-label="Primary">
          {quickLinks.map((item) => (
            <Link prefetch={false} key={item.href} href={item.href} className="header-quick-link">
              {item.label}
            </Link>
          ))}
          <Link prefetch={false} href="/#swap" className="header-pond-link" title="Open Pond swap utility">
            <span className="header-pond-icon"><Image src="/tokens/patience.PNG" alt="" fill sizes="26px" className="object-contain" /></span>
            <span>Pond</span>
          </Link>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <ConnectPill />
        </div>
      </div>
    </header>
  );
}
