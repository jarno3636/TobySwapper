"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { KeeperDirectoryRecord } from "@/lib/keeper-directory-server";
import TobyworldIcon from "@/components/TobyworldIcon";


function identity(keeper: KeeperDirectoryRecord) {
  const land = keeper.currentLands[0];
  return keeper.keeperName || keeper.keeperSocial || (land ? `Keeper of #${land.tokenId}` : "Tobyworld Keeper");
}

export default function KeeperDirectory({ keepers }: { keepers: KeeperDirectoryRecord[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return keepers;
    return keepers.filter((keeper) =>
      [
        keeper.keeperName,
        keeper.keeperSocial,
        keeper.ownerAddress,
        ...keeper.currentLands.flatMap((land) => [land.name, `#${land.tokenId}`, ...land.signs]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [keepers, query]);

  return (
    <section className="keeper-directory-panel">
      <div className="keeper-directory-head">
        <div>
          <span className="land-section-kicker">KEEPER MARKS</span>
          <h1>Meet the Keepers</h1>
          <p>Keeper-written identity lives beside the canonical Lore Land, never inside it. Explore the people currently tending places across Tobyworld.</p>
        </div>
        <label>
          <span>FIND A KEEPER</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, handle, land, sign…" />
        </label>
      </div>

      <div className="keeper-directory-count">{filtered.length.toLocaleString()} keeper {filtered.length === 1 ? "mark" : "marks"}</div>

      <div className="keeper-directory-grid">
        {filtered.map((keeper) => {
          const first = keeper.currentLands[0];
          return (
            <Link prefetch={false} href={`/keeper/${keeper.ownerAddress}`} className="keeper-directory-card" key={keeper.ownerAddress}>
              <div className="keeper-directory-art">
                {first?.imageUrl ? <img src={first.imageUrl} alt="" loading="lazy" /> : <TobyworldIcon kind="lore" size={68} className="tw-placeholder-lore" />}
                <b>{keeper.currentLands.length} {keeper.currentLands.length === 1 ? "LAND" : "LANDS"}</b>
              </div>
              <div className="keeper-directory-copy">
                <span>KEEPER MARK</span>
                <h2>{identity(keeper)}</h2>
                <p>{keeper.keeperSocial && keeper.keeperName ? keeper.keeperSocial : first ? `Keeper of Lore Land #${first.tokenId}` : "Community Keeper Mark"}</p>
                {first ? <div className="keeper-directory-land"><small>CURRENT PLACE</small><strong>{first.name}</strong><em>#{first.tokenId}</em></div> : null}
                <footer><small>{keeper.storyCount ? `${keeper.storyCount} keeper ${keeper.storyCount === 1 ? "story" : "stories"}` : "No public story yet"}</small><b>Visit Keeper →</b></footer>
              </div>
            </Link>
          );
        })}
      </div>

      {!filtered.length ? <div className="keeper-directory-empty">No Keeper Mark matched that trail.</div> : null}
    </section>
  );
}
