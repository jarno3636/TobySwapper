"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import WalletAssetViewer from "@/components/pouch/WalletAssetViewer";
import PublicPouchCreator from "@/components/pouch/PublicPouchCreator";
import {
  readLocalPouchEditorBySlug,
  readPublicPouchProfile,
  type PublicPouchProfile,
} from "@/lib/pouch-profile";

export default function PublicPouchPage({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<PublicPouchProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readPublicPouchProfile(slug)
      .then((value) => {
        if (!cancelled) {
          setProfile(value);
          setEditorReady(Boolean(readLocalPouchEditorBySlug(slug)));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <main className="public-pouch-page">
        <div className="public-pouch-loading">Opening this Tobyworld page…</div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="public-pouch-page">
        <section className="public-pouch-missing">
          <span>THE POND IS QUIET</span>
          <h1>Public Pouch not found</h1>
          <p>This page may have moved or never existed.</p>
          <Link prefetch={false} href="/taboshi1">Explore a wallet →</Link>
        </section>
      </main>
    );
  }

  const addressLabel = profile.showWallet
    ? `${profile.walletAddress.slice(0, 8)}…${profile.walletAddress.slice(-6)}`
    : "Public Tobyworld Pouch";

  return (
    <main className={`public-pouch-page theme-${profile.theme}`}>
      <section className="public-pouch-hero">
        <div className="public-pouch-hero-orb" />
        <div className="public-pouch-hero-copy">
          <span>{profile.verified ? "VERIFIED KEEPER ✓" : "PUBLIC POUCH · UNVERIFIED"}</span>
          <h1>{profile.pageName}</h1>
          <p>{profile.description || "A place in Tobyworld, assembled from public Base state."}</p>
          <div className="public-pouch-hero-meta">
            <strong>{addressLabel}</strong>
            {!profile.verified ? <small>Wallet ownership has not been verified.</small> : null}
          </div>
          <div className="public-pouch-links">
            {profile.xUrl ? <a href={profile.xUrl} target="_blank" rel="noreferrer">X ↗</a> : null}
            {profile.farcasterUrl ? <a href={profile.farcasterUrl} target="_blank" rel="noreferrer">Farcaster ↗</a> : null}
            {profile.websiteUrl ? <a href={profile.websiteUrl} target="_blank" rel="noreferrer">Website ↗</a> : null}
          </div>
        </div>

        {profile.featuredDeed ? (
          <Link prefetch={false} href={`/land/${profile.featuredDeed}`} className="public-pouch-featured-deed">
            <span className="public-pouch-deed-mark" aria-hidden="true">△</span>
            <span>HOME LAND</span>
            <strong>Lore Land #{profile.featuredDeed}</strong>
          </Link>
        ) : null}
      </section>

      <WalletAssetViewer owner={profile.walletAddress as Address} profileMode />

      {editorReady ? (
        <PublicPouchCreator
          walletAddress={profile.walletAddress}
          initialProfile={profile}
          initialEditor={readLocalPouchEditorBySlug(slug)}
        />
      ) : (
        <div className="public-pouch-viewer-note">
          This page can be viewed without connecting a wallet. Editing requires the private edit key from the browser that created it.
        </div>
      )}

      <div className="public-pouch-footer-actions">
        <Link prefetch={false} href="/taboshi1">View another wallet</Link>
        <Link prefetch={false} href="/world">Explore Tobyworld</Link>
        <Link prefetch={false} href="/world/exchange">Market</Link>
      </div>
    </main>
  );
}
