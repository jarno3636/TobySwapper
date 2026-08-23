"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import type { Address } from "viem";
import type { DecodedActivationLock } from "@/hooks/useLoreActivationReads";
import { activationBaseScanTx } from "@/lib/activation-contracts";
import type { ActivationStage } from "@/hooks/useLoreActivationActions";

function fmt(value: bigint, digits = 4) {
  const n = Number(formatUnits(value, 18));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function date(ts?: bigint) { return ts ? new Date(Number(ts) * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Reading lock…"; }
function countdown(ts?: bigint, now = Date.now()) {
  if (!ts) return "Reading lock…";
  const seconds = Math.max(0, Number(ts) - Math.floor(now / 1000));
  if (seconds <= 0) return "Minimum lock complete";
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}
const labels: Partial<Record<ActivationStage,string>> = {
  checking: "Checking requirements", "approve-patience": "Approve PATIENCE", "approve-toby": "Approve TOBY", awakening: "Awaken Lore Land", confirming: "Confirming", awakened: "Land Awakened", withdrawing: "Returning TOBY", withdrawn: "TOBY returned",
};

export default function LoreActivationCard(props: {
  tokenId: string;
  name?: string | null;
  owner?: Address;
  transferNonce: bigint;
  active: boolean;
  lockId: bigint;
  lock?: DecodedActivationLock;
  activationStarted: boolean;
  paused: boolean;
  xAmount: bigint;
  yCost: bigint;
  tobyBalance: bigint;
  patienceBalance: bigint;
  stage: ActivationStage;
  message: string;
  hashes: `0x${string}`[];
  onActivate: () => void;
  onWithdraw: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(id); }, []);
  const enoughToby = props.tobyBalance >= props.xAmount;
  const enoughPatience = props.patienceBalance >= props.yCost;
  const busy = !["idle", "error", "awakened", "withdrawn"].includes(props.stage);
  const matured = Boolean(props.lock?.unlockAt && BigInt(Math.floor(now / 1000)) >= props.lock.unlockAt);

  return <article className={`lore-activation-card ${props.active ? "is-active" : "is-dormant"}`}>
    <header>
      <div><span>{props.active ? "LAND AWAKENED" : "AWAKEN YOUR LAND"}</span><h2>{props.name || `Lore Land #${props.tokenId}`}</h2><p>Canonical Lore Deed #{props.tokenId}</p></div>
      <b className={props.active ? "active" : "dormant"}><i />{props.active ? "ACTIVE" : "DORMANT"}</b>
    </header>

    {!props.active ? <>
      <div className="activation-requirements">
        <div className={enoughToby ? "ready" : "short"}><img src="/tokens/toby.PNG" alt=""/><span><small>TOBY COMMITMENT</small><strong>{fmt(props.xAmount, 0)}</strong><em>{enoughToby ? "Wallet ready" : `You carry ${fmt(props.tobyBalance, 0)}`}</em></span></div>
        <div className={enoughPatience ? "ready" : "short"}><img src="/tokens/patience.PNG" alt=""/><span><small>PATIENCE OFFERING</small><strong>{fmt(props.yCost)}</strong><em>{enoughPatience ? "Wallet ready" : `You carry ${fmt(props.patienceBalance)}`}</em></span></div>
        <div><span><small>MINIMUM COMMITMENT</small><strong>90 DAYS</strong><em>Land remains active after day 90 while TOBY stays locked.</em></span></div>
      </div>
      {props.paused ? <div className="activation-paused"><strong>LAND AWAKENING PAUSED</strong><span>Requirements remain visible, but activation cannot be submitted.</span></div> : null}
      <button className="awaken-land-button" disabled={busy || props.paused || !props.activationStarted || !enoughToby || !enoughPatience} onClick={props.onActivate}>
        {props.paused ? "LAND AWAKENING PAUSED" : labels[props.stage] || "AWAKEN LAND"}
      </button>
    </> : <>
      <div className="active-lock-grid">
        <div><small>LOCK ID</small><strong>#{props.lockId.toString()}</strong></div>
        <div><small>TOBY COMMITTED</small><strong>{props.lock?.xAmount ? fmt(props.lock.xAmount, 0) : fmt(props.xAmount, 0)}</strong></div>
        <div><small>ACTIVATED</small><strong>{date(props.lock?.activatedAt)}</strong></div>
        <div><small>MINIMUM UNLOCK</small><strong>{date(props.lock?.unlockAt)}</strong></div>
        <div><small>COUNTDOWN</small><strong>{countdown(props.lock?.unlockAt, now)}</strong></div>
        <div><small>OWNERSHIP GENERATION</small><strong>{props.transferNonce.toString()}</strong></div>
      </div>
      {matured ? <div className="activation-matured"><span>TOBY IS NOW WITHDRAWABLE</span><p>The land stays awakened until the current lock is withdrawn or ownership invalidates it.</p></div> : null}
      {matured && !confirmingWithdraw ? <button className="withdraw-deactivate-button" disabled={busy} onClick={() => setConfirmingWithdraw(true)}>WITHDRAW TOBY &amp; DEACTIVATE</button> : null}
      {confirmingWithdraw ? <div className="withdraw-confirm" role="alertdialog" aria-label="Confirm TOBY withdrawal"><strong>Deactivate this land?</strong><p>Withdrawing your committed TOBY will return the tokens to your wallet and deactivate this Lore Land. Continue?</p><div><button onClick={() => setConfirmingWithdraw(false)}>Keep awakened</button><button className="danger" disabled={busy} onClick={() => { setConfirmingWithdraw(false); props.onWithdraw(); }}>Withdraw &amp; deactivate</button></div></div> : null}
    </>}

    {props.stage !== "idle" && labels[props.stage] ? <div className={`activation-stage ${props.stage}`}><i/><span>{labels[props.stage]}</span></div> : null}
    {props.message ? <div className={`activation-message ${props.stage === "error" ? "error" : "success"}`}>{props.message}</div> : null}
    {props.hashes.length ? <div className="activation-hashes">{props.hashes.map((h, i) => <a href={activationBaseScanTx(h)} target="_blank" rel="noreferrer" key={h}>Transaction {i + 1} ↗</a>)}</div> : null}
  </article>;
}
