"use client";

import { formatUnits } from "viem";

function amount(value: bigint, max = 3) {
  const n = Number(formatUnits(value, 18));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

export default function AwakeningStats(props: {
  totalActivations: bigint;
  totalLockedX: bigint;
  activationXAmount: bigint;
  activationYCost: bigint;
  solvent: boolean;
}) {
  return <section className="awakening-stats">
    <header><span>THE AWAKENING</span><h2>Onchain state, now.</h2><p>Live values read from the official ActivationManager.</p></header>
    <div className="awakening-stat-grid">
      <div><small>HISTORICAL ACTIVATIONS</small><strong>{props.totalActivations.toLocaleString()}</strong><em>All activations ever created</em></div>
      <div><small>TOBY CURRENTLY LOCKED</small><strong>{amount(props.totalLockedX, 0)}</strong><em>TOBY</em></div>
      <div className="blue"><small>CURRENT TOBY COMMITMENT</small><strong>{amount(props.activationXAmount, 0)}</strong><em>Live manager requirement</em></div>
      <div className="red"><small>CURRENT PATIENCE OFFERING</small><strong>{amount(props.activationYCost, 4)}</strong><em>Live manager requirement</em></div>
      <div><small>MINIMUM COMMITMENT</small><strong>90 days</strong><em>Activation continues if TOBY stays locked</em></div>
      <div className={props.solvent ? "good" : "warn"}><small>VAULT SOLVENCY</small><strong>{props.solvent ? "SOLVENT" : "CHECK"}</strong><em>Reported by manager</em></div>
    </div>
  </section>;
}
