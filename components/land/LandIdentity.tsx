"use client";

import type { Address } from "viem";

function shortAddress(value?: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "…";
}

export default function LandIdentity({
  tokenId,
  owner,
  revealed,
  transferNonce,
  boundAccount,
  forge,
}: {
  tokenId: bigint;
  owner?: Address;
  revealed: boolean;
  transferNonce?: bigint;
  boundAccount?: Address;
  forge?: Address;
}) {
  return (
    <section className="land-identity-card">
      <div className="land-section-kicker">DEED IDENTITY</div>
      <div className="land-identity-title-row">
        <div>
          <h1>Lore Land #{tokenId.toString()}</h1>
          <p>{revealed ? "The veil has lifted over this place." : "A real deed. A place still waiting behind the veil."}</p>
        </div>
        <span className={`land-state-chip ${revealed ? "is-revealed" : ""}`}>{revealed ? "REVEALED" : "VEILED"}</span>
      </div>

      <div className="land-identity-grid">
        <div><small>KEEPER</small><strong>{shortAddress(owner)}</strong></div>
        <div><small>GENERATION</small><strong>{transferNonce === undefined ? "…" : transferNonce.toLocaleString()}</strong></div>
        <div><small>BOUND ACCOUNT</small><strong>{shortAddress(boundAccount)}</strong></div>
        <div><small>GENESIS FORGE</small><strong>{forge ? "BOUND" : "WAITING"}</strong></div>
      </div>
    </section>
  );
}
