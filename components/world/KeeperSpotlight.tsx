"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TobyworldIcon from "@/components/TobyworldIcon";

type Keeper = {
  ownerAddress: string;
  keeperName: string | null;
  keeperSocial: string | null;
  currentLands: Array<{ tokenId: string; name: string; imageUrl: string | null; signs: string[] }>;
  storyCount: number;
};

export default function KeeperSpotlight() {
  const [keepers, setKeepers] = useState<Keeper[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keepers?limit=6", { cache: "force-cache" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.keepers)) setKeepers(payload.keepers);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!keepers.length) return null;

  return (
    <section className="keeper-spotlight-panel">
      <div className="keeper-spotlight-head">
        <div><span className="land-section-kicker">KEEPER MARKS</span><h2>People tending the world</h2><p>Community-written identity, kept visually separate from canonical Lore Land signs.</p></div>
        <Link prefetch={false} href="/keepers">Meet all Keepers →</Link>
      </div>
      <div className="keeper-spotlight-grid">
        {keepers.map((keeper) => {
          const land = keeper.currentLands[0];
          return <Link prefetch={false} href={`/keeper/${keeper.ownerAddress}`} className="keeper-spotlight-card" key={keeper.ownerAddress}>
            <div className="keeper-spotlight-art">{land?.imageUrl ? <img src={land.imageUrl} alt="" loading="lazy" /> : <TobyworldIcon kind="lore" size={62} className="tw-placeholder-lore" />}</div>
            <div><span>KEEPER MARK</span><strong>{keeper.keeperName || keeper.keeperSocial || (land ? `Keeper of #${land.tokenId}` : "A Tobyworld Keeper")}</strong><small>{keeper.currentLands.length} current {keeper.currentLands.length === 1 ? "land" : "lands"} · {keeper.storyCount} {keeper.storyCount === 1 ? "story" : "stories"}</small></div>
            <b>→</b>
          </Link>;
        })}
      </div>
    </section>
  );
}
