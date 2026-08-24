"use client";

import { formatUnits } from "viem";

function amount(value: bigint, decimals: number, max = 3) {
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

function durationLabel(seconds: bigint) {
  if (seconds <= 0n) return "Reading…";
  if (seconds % 86_400n === 0n) return `${(seconds / 86_400n).toLocaleString()} days`;
  return `${(Number(seconds) / 86_400).toLocaleString(undefined, { maximumFractionDigits: 1 })} days`;
}

export default function AwakeningStats(props: {
  totalActivations: bigint;
  totalLockedX: bigint;
  activationXAmount: bigint;
  activationYCost: bigint;
  lockDuration: bigint;
  tobyDecimals: number;
  patienceDecimals: number;
  solvent: boolean;
}) {
  return <section className="awakening-stats">
    <header><span>THE AWAKENING</span><h2>Onchain state, now.</h2><p>Live values read from the official activation contracts.</p></header>
    <div className="awakening-stat-grid">
      <div><small>HISTORICAL ACTIVATIONS</small><strong>{props.totalActivations.toLocaleString()}</strong><em>All activations ever created</em></div>
      <div><small>TOBY CURRENTLY LOCKED</small><strong>{amount(props.totalLockedX, props.tobyDecimals, 0)}</strong><em>TOBY</em></div>
      <div className="blue"><small>CURRENT TOBY COMMITMENT</small><strong>{amount(props.activationXAmount, props.tobyDecimals, 0)}</strong><em>Live manager requirement</em></div>
      <div className="red"><small>CURRENT PATIENCE OFFERING</small><strong>{amount(props.activationYCost, props.patienceDecimals, 4)}</strong><em>Live manager requirement</em></div>
      <div><small>MINIMUM COMMITMENT</small><strong>{durationLabel(props.lockDuration)}</strong><em>Activation continues if TOBY stays locked</em></div>
      <div className={props.solvent ? "good" : "warn"}><small>MANAGER SOLVENCY</small><strong>{props.solvent ? "SOLVENT" : "CHECK"}</strong><em>Reported by ActivationManager</em></div>
    </div>
  </section>;
}
