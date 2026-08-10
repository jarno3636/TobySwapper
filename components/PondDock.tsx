"use client";

import Image from "next/image";
import LinkMaybeMini from "@/components/LinkMaybeMini";

const items = [
  {
    label: "Swap",
    href: "#swap",
    kind: "local" as const,
    icon: "/tokens/sato.PNG",
    tone: "blue",
  },
  {
    label: "World Atlas",
    href: "https://farcaster.xyz/miniapps/6RxWwBQYOf63/tobyworld-atlas",
    kind: "external" as const,
    icon: "/tokens/taboshi.PNG",
    tone: "green",
  },
  {
    label: "Hop",
    href: "https://farcaster.xyz/miniapps/rTQGt2rMfgOF/toby-hop",
    kind: "external" as const,
    icon: "/tokens/toby.PNG",
    tone: "cyan",
  },
  {
    label: "Vault",
    href: "https://toadvault.xyz",
    kind: "external" as const,
    icon: "/tokens/patience.PNG",
    tone: "red",
  },
] as const;

function DockItem({ item }: { item: (typeof items)[number] }) {
  const content = (
    <>
      <span className={`pond-dock-icon pond-dock-${item.tone}`}>
        <Image src={item.icon} alt="" fill sizes="42px" className="object-contain p-1" />
      </span>
      <span>{item.label}</span>
    </>
  );

  if (item.kind === "local") {
    return (
      <a className="pond-dock-item pond-dock-active" href={item.href} aria-label="Go to swap">
        {content}
      </a>
    );
  }

  return (
    <LinkMaybeMini href={item.href} className="pond-dock-item">
      {content}
    </LinkMaybeMini>
  );
}

export default function PondDock() {
  return (
    <nav className="pond-dock-wrap" aria-label="TobySwap shortcuts">
      <div className="pond-dock">
        {items.map((item) => <DockItem key={item.label} item={item} />)}
      </div>
    </nav>
  );
}
