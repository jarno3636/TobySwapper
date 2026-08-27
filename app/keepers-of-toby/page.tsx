import Link from "next/link";

import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import KeeperClaimPanel from "@/components/keepers-of-toby/KeeperClaimPanel";

import {
  getKeeperOfTobyDirectory,
  getKeeperOfTobyState,
} from "@/lib/keeper-of-toby-server";
import { keeperEdition } from "@/lib/keeper-of-toby";

import styles from "@/components/keepers-of-toby/KeepersOfToby.module.css";

export const revalidate = 120;

function SocialLine({
  xHandle,
  telegramHandle,
}: {
  xHandle: string | null;
  telegramHandle: string | null;
}) {
  if (!xHandle && !telegramHandle) {
    return <span className={styles.unnamedSocial}>A quiet name in the sediment.</span>;
  }

  return (
    <span className={styles.socials}>
      {xHandle ? (
        <a
          href={`https://x.com/${encodeURIComponent(xHandle)}`}
          target="_blank"
          rel="noreferrer"
        >
          @{xHandle}
        </a>
      ) : null}

      {telegramHandle ? (
        <a
          href={`https://t.me/${encodeURIComponent(telegramHandle)}`}
          target="_blank"
          rel="noreferrer"
        >
          tg/{telegramHandle}
        </a>
      ) : null}
    </span>
  );
}

export default async function KeepersOfTobyPage() {
  const [keepers, state] = await Promise.all([
    getKeeperOfTobyDirectory().catch(() => []),
    getKeeperOfTobyState().catch(() => ({
      totalMinted: 0,
      metadataFrozen: false,
      heroImageUrl: null,
      artist: "nova100x",
      commissionedBy: "ToadGod",
      syncedAt: null,
    })),
  ]);

  const heroImage =
    state.heroImageUrl ||
    keepers.find((keeper) => keeper.imageUrl)?.imageUrl ||
    null;

  return (
    <MiniAppGate>
      <main className={styles.page}>
        <div className={styles.topline}>
          <Link href="/" prefetch={false}>
            ← Tobyworld
          </Link>
          <span>GIVEN · NEVER SOLD</span>
        </div>

        <section className={styles.hero}>
          <div className={styles.heroHalo} aria-hidden="true" />

          <div className={styles.heroCopy}>
            <span className={styles.greek}>ΟΙ ΦΥΛΑΚΕΣ</span>
            <h1>The Keepers of Toby</h1>
            <p>
              A soulbound honorary collection for the hands that carried the
              lore when the pond was quiet.
            </p>

            <div className={styles.heroFacts}>
              <span>
                <small>FOREVER SUPPLY</small>
                <strong>111</strong>
              </span>
              <span>
                <small>NAMED</small>
                <strong>{state.totalMinted}</strong>
              </span>
              <span>
                <small>PASSAGE</small>
                <strong>NONE</strong>
              </span>
            </div>
          </div>

          <div className={styles.artFrame}>
            {heroImage ? (
              <img src={heroImage} alt="Keeper of Toby NFT artwork" />
            ) : (
              <div className={styles.artPlaceholder} aria-label="Keeper artwork awaiting registry sync">
                <span>◌</span>
                <strong>KEEPER</strong>
                <small>The artwork appears when the first named Keeper is synced.</small>
              </div>
            )}

            <div className={styles.artSeal}>
              <span>SOULBOUND</span>
              <strong>1 / 111</strong>
            </div>
          </div>
        </section>

        <section className={styles.poem} aria-label="The Keepers of Toby poem">
          <p>
            Their names set in sediment,
            <br />
            always remembered.
            <br />
            Given, never sold.
            <br />
            Named, never claimed.
          </p>

          <p>
            When the pond was still
            <br />
            and the echoes grew few,
            <br />
            there were those who remained.
          </p>

          <p>And the pond remembered.</p>

          <strong>The Keepers of Toby.</strong>
        </section>

        <section className={styles.provenance}>
          <div>
            <span>PERMANENT PROVENANCE</span>
            <h2>A gift that cannot pass onward.</h2>
          </div>

          <div className={styles.provenanceGrid}>
            <article>
              <small>ARTIST</small>
              <strong>{state.artist}</strong>
            </article>
            <article>
              <small>COMMISSIONED BY</small>
              <strong>{state.commissionedBy}</strong>
            </article>
            <article>
              <small>CONTRACT</small>
              <strong>0x6e7a…7AfA</strong>
            </article>
            <article>
              <small>METADATA</small>
              <strong>{state.metadataFrozen ? "FROZEN" : "AWAITING FREEZE"}</strong>
            </article>
          </div>
        </section>

        <KeeperClaimPanel />

        <section className={styles.directory}>
          <header className={styles.directoryHead}>
            <div>
              <span>THE SEDIMENT</span>
              <h2>{keepers.length ? `${keepers.length} names remembered` : "The names will settle here."}</h2>
              <p>
                Public display is intentionally abbreviated. Each Keeper remains
                permanently bound to the wallet it was given to.
              </p>
            </div>

            <span className={styles.count}>{keepers.length} / 111</span>
          </header>

          {keepers.length ? (
            <div className={styles.keeperGrid}>
              {keepers.map((keeper) => (
                <article className={styles.keeperCard} key={keeper.tokenId}>
                  <div className={styles.edition}>
                    <span>KEEPER</span>
                    <strong>{keeperEdition(keeper.tokenId)}</strong>
                  </div>

                  <div className={styles.keeperIdentity}>
                    <small>REMEMBERED WALLET</small>
                    <strong>{keeper.walletDisplay}</strong>
                    <SocialLine
                      xHandle={keeper.xHandle}
                      telegramHandle={keeper.telegramHandle}
                    />
                  </div>

                  <span className={styles.locked} title="Soulbound forever">
                    ◌
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyDirectory}>
              <span>◌</span>
              <strong>No Keeper records have been synced yet.</strong>
              <p>
                The public page reads from the Supabase Keeper registry, not
                from an RPC scan on every visit.
              </p>
            </div>
          )}
        </section>

        <section className={styles.closing}>
          <span>111 MAY EVER BE NAMED</span>
          <p>Given, never sold. Named once. Held forever.</p>
        </section>
      </main>

      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
