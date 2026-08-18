"use client";

import type { Address } from "viem";

function shortAddress(value?: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "…";
}

export default function LandIdentity({
  tokenId,
  owner,
  hasArtwork,
}: {
  tokenId: bigint;
  owner?: Address;
  hasArtwork: boolean;
}) {
  return (
    <section className="land-identity-card">
      <div className="land-section-kicker">DEED IDENTITY</div>
      <div className="land-identity-title-row">
        <div>
          <h1>Lore Land #{tokenId.toString()}</h1>
          <p>A persistent Tobyworld land number carried by the canonical deed.</p>
        </div>
        <span className="land-state-chip is-revealed">CANONICAL</span>
      </div>

      <div className="land-identity-grid land-identity-grid-simple">
        <div><small>KEEPER</small><strong>{shortAddress(owner)}</strong></div>
        <div><small>DEED</small><strong>#{tokenId.toString()}</strong></div>
        <div><small>NETWORK</small><strong>BASE</strong></div>
        <div><small>ART</small><strong>{hasArtwork ? "VISIBLE" : "VEILED"}</strong></div>
      </div>
    </section>
  );
}
