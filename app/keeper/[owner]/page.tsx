import Link from "next/link";
import { notFound } from "next/navigation";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import { getKeeperDetail } from "@/lib/keeper-directory-server";
import TobyworldIcon from "@/components/TobyworldIcon";


export const revalidate = 120;

export default async function KeeperPage({ params }: { params: { owner: string } }) {
  const keeper = await getKeeperDetail(params.owner).catch(() => null);
  if (!keeper) notFound();

  const firstLand = keeper.currentLands[0];
  const displayName = keeper.keeperName || keeper.keeperSocial || (firstLand ? `Keeper of #${firstLand.tokenId}` : "Tobyworld Keeper");

  return (
    <MiniAppGate>
      <main className="keeper-page keeper-detail-page mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="world-topbar"><Link prefetch={false} href="/keepers">← Keepers</Link><span>KEEPER MARK · COMMUNITY-WRITTEN</span></header>

        <section className="keeper-detail-hero">
          <div className="keeper-detail-sigil"><TobyworldIcon kind="toby" size={48} /></div>
          <div>
            <span className="land-section-kicker">KEEPER MARK</span>
            <h1>{displayName}</h1>
            <p>{keeper.keeperSocial && keeper.keeperName ? keeper.keeperSocial : firstLand ? `Keeper of Lore Land #${firstLand.tokenId}` : "Community Keeper Mark"}</p>
          </div>
          {keeper.keeperLink ? <a href={keeper.keeperLink} target="_blank" rel="noreferrer">Keeper link ↗</a> : null}
        </section>

        <section className="keeper-detail-section">
          <div className="keeper-detail-heading"><div><span>CURRENTLY KEPT</span><h2>{keeper.currentLands.length} Lore {keeper.currentLands.length === 1 ? "Land" : "Lands"}</h2></div><Link prefetch={false} href="/world">Open World Atlas →</Link></div>
          <div className="keeper-land-grid">
            {keeper.currentLands.map((land) => (
              <Link prefetch={false} href={`/land/${land.tokenId}`} className="keeper-land-card" key={land.tokenId}>
                <div className="keeper-land-art">{land.imageUrl ? <img src={land.imageUrl} alt="" loading="lazy" /> : <TobyworldIcon kind="lore" size={74} className="tw-placeholder-lore" />}<b>#{land.tokenId}</b></div>
                <div><span>LORE LAND #{land.tokenId}</span><h3>{land.name}</h3>{land.story ? <p>“{land.story}”</p> : <p>No keeper-written story yet.</p>}<div>{land.signs.map((sign) => <small key={sign}>{sign}</small>)}</div><strong>Visit Land →</strong></div>
              </Link>
            ))}
          </div>
        </section>

        {keeper.previousLands.length ? (
          <section className="keeper-detail-section keeper-previous-section">
            <div className="keeper-detail-heading"><div><span>KEEPER LEGACY</span><h2>Previous places</h2></div></div>
            <div className="keeper-previous-list">
              {keeper.previousLands.map((land, index) => <Link prefetch={false} href={`/land/${land.tokenId}`} key={`${land.tokenId}:${index}`}><span>PREVIOUS KEEPER OF #{land.tokenId}</span><strong>{land.name}</strong>{land.story ? <p>“{land.story}”</p> : null}<b>Visit land →</b></Link>)}
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
