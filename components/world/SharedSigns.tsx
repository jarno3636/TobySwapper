"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SharedTrait = { traitType: string; value: string };
type RelatedLand = {
  tokenId: string;
  imageUrl: string | null;
  communityName: string | null;
  keeperName: string | null;
  traits: SharedTrait[];
  shared: SharedTrait[];
  sharedCount: number;
  echoScore?: number;
};

export default function SharedSigns({ tokenId }: { tokenId: bigint }) {
  const [lands, setLands] = useState<RelatedLand[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lore/shared?tokenId=${encodeURIComponent(tokenId.toString())}`, { cache: "force-cache" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => { if (!cancelled && Array.isArray(payload?.related)) setLands(payload.related); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tokenId]);

  if (!lands.length) return null;

  return (
    <section className="shared-signs-panel" aria-labelledby="shared-signs-title">
      <div className="shared-signs-head"><div><span className="land-section-kicker">SHARED SIGNS</span><h2 id="shared-signs-title">Other lands that echo this one</h2><p>Related by exact canonical traits — not by invented geography.</p></div><Link prefetch={false} href="/world">Open Atlas ↗</Link></div>
      <div className="shared-signs-grid">
        {lands.map((land) => <Link prefetch={false} href={`/land/${land.tokenId}`} key={land.tokenId} className="shared-sign-card">
          <div className="shared-sign-art">{land.imageUrl ? <img src={land.imageUrl} alt="" loading="lazy" /> : <span>△</span>}<b>#{land.tokenId}</b></div>
          <div><span>{land.sharedCount >= 3 ? "STRONG ECHO" : "SHARED SIGNS"} · {land.sharedCount} {land.sharedCount === 1 ? "SIGN" : "SIGNS"}</span><h3>{land.communityName || `Lore Land #${land.tokenId}`}</h3><p>{land.shared.map((trait) => trait.value).join(" · ")}</p><small>{land.keeperName ? `Keeper · ${land.keeperName}` : "Visit this land"} →</small></div>
        </Link>)}
      </div>
    </section>
  );
}
