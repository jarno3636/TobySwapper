"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import type { Address } from "viem";

import type { ActivationLock } from "@/hooks/useLoreActivationReads";
import type { ActivationStage } from "@/hooks/useLoreActivationActions";
import { activationBaseScanTx } from "@/lib/activation-contracts";

import styles from "./LoreActivationCard.module.css";

function fmt(value: bigint, decimals: number, digits = 4) {
  const number = Number(formatUnits(value, decimals));
  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

function date(timestamp?: bigint) {
  if (!timestamp) return "Reading lock…";

  return new Date(Number(timestamp) * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function countdown(timestamp?: bigint, now = Date.now()) {
  if (!timestamp) return "Reading lock…";

  const seconds = Math.max(
    0,
    Number(timestamp) - Math.floor(now / 1000),
  );

  if (seconds <= 0) return "Minimum lock complete";

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

function durationLabel(seconds: bigint) {
  if (seconds <= 0n) return "—";

  if (seconds % 86_400n === 0n) {
    const days = seconds / 86_400n;
    return `${days.toLocaleString()} DAYS`;
  }

  return `${(Number(seconds) / 3600).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} HOURS`;
}

const labels: Partial<Record<ActivationStage, string>> = {
  checking: "Checking requirements",
  "approve-patience": "Approve PATIENCE",
  "approve-toby": "Approve TOBY",
  awakening: "Awaken Lore Land",
  confirming: "Confirming",
  awakened: "Land Awakened",
  withdrawing: "Returning TOBY",
  withdrawn: "TOBY returned",
};

export default function LoreActivationCard(props: {
  tokenId: string;
  name?: string | null;
  owner?: Address;
  transferNonce: bigint;
  active: boolean;
  lockId: bigint;
  lock?: ActivationLock;
  activationStarted: boolean;
  paused: boolean;
  xAmount: bigint;
  yCost: bigint;
  lockDuration: bigint;
  tobyBalance: bigint;
  patienceBalance: bigint;
  tobyDecimals: number;
  patienceDecimals: number;
  protocolReady: boolean;
  stage: ActivationStage;
  message: string;
  hashes: `0x${string}`[];
  onRefresh?: () => Promise<unknown> | void;
  onActivate: () => void;
  onWithdraw: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLocked, setRefreshLocked] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const enoughToby = props.tobyBalance >= props.xAmount;
  const enoughPatience = props.patienceBalance >= props.yCost;

  const termsReady =
    props.xAmount > 0n &&
    props.yCost > 0n &&
    props.lockDuration > 0n &&
    props.protocolReady;

  const busy = ![
    "idle",
    "error",
    "awakened",
    "withdrawn",
  ].includes(props.stage);

  const matured = Boolean(
    props.lock?.unlockTime &&
      BigInt(Math.floor(now / 1000)) >= props.lock.unlockTime,
  );

  const sameGeneration = props.lock
    ? props.lock.ownershipNonceAtActivation === props.transferNonce
    : undefined;

  const tobyShortfall = useMemo(
    () =>
      props.xAmount > props.tobyBalance
        ? props.xAmount - props.tobyBalance
        : 0n,
    [props.xAmount, props.tobyBalance],
  );

  const patienceShortfall = useMemo(
    () =>
      props.yCost > props.patienceBalance
        ? props.yCost - props.patienceBalance
        : 0n,
    [props.yCost, props.patienceBalance],
  );

  async function refreshBalances() {
    if (!props.onRefresh || refreshing || refreshLocked) return;

    setRefreshing(true);
    setRefreshLocked(true);

    try {
      await props.onRefresh();
    } finally {
      setRefreshing(false);
      window.setTimeout(() => setRefreshLocked(false), 5_000);
    }
  }

  const awakenLabel = props.paused
    ? "LAND AWAKENING PAUSED"
    : !termsReady
      ? "READING ONCHAIN TERMS…"
      : !props.activationStarted
        ? "AWAKENING NOT STARTED"
        : labels[props.stage] || "AWAKEN LAND";

  return (
    <article
      className={`lore-activation-card ${
        props.active ? "is-active" : "is-dormant"
      }`}
    >
      <header>
        <div>
          <span>{props.active ? "LAND AWAKENED" : "AWAKEN YOUR LAND"}</span>
          <h2>{props.name || `Lore Land #${props.tokenId}`}</h2>
          <p>Canonical Lore Deed #{props.tokenId}</p>
        </div>

        <b className={props.active ? "active" : "dormant"}>
          <i />
          {props.active ? "ACTIVE" : "DORMANT"}
        </b>
      </header>

      {!props.active ? (
        <>
          <div className="activation-requirements">
            <div className={enoughToby && termsReady ? "ready" : "short"}>
              <img src="/tokens/toby.PNG" alt="" />
              <span>
                <small>TOBY COMMITMENT</small>
                <strong>{termsReady ? fmt(props.xAmount, props.tobyDecimals, 0) : "—"}</strong>
                <em>
                  {!termsReady
                    ? "Reading current requirement"
                    : enoughToby
                      ? "Wallet ready"
                      : `You carry ${fmt(props.tobyBalance, props.tobyDecimals, 0)}`}
                </em>
              </span>
            </div>

            <div className={enoughPatience && termsReady ? "ready" : "short"}>
              <img src="/tokens/patience.PNG" alt="" />
              <span>
                <small>PATIENCE OFFERING</small>
                <strong>{termsReady ? fmt(props.yCost, props.patienceDecimals) : "—"}</strong>
                <em>
                  {!termsReady
                    ? "Reading current requirement"
                    : enoughPatience
                      ? "Wallet ready"
                      : `You carry ${fmt(props.patienceBalance, props.patienceDecimals)}`}
                </em>
              </span>
            </div>

            <div>
              <span>
                <small>MINIMUM COMMITMENT</small>
                <strong>{durationLabel(props.lockDuration)}</strong>
                <em>
                  The land remains active after the minimum period while TOBY
                  stays locked.
                </em>
              </span>
            </div>
          </div>

          <section className={styles.walletReadiness}>
            <div className={styles.walletReadinessHead}>
              <div>
                <span>WALLET READINESS</span>
                <strong>Everything needed to awaken.</strong>
              </div>

              <button
                type="button"
                className={styles.refreshButton}
                disabled={!props.onRefresh || refreshing || refreshLocked}
                onClick={refreshBalances}
              >
                {refreshing
                  ? "CHECKING…"
                  : refreshLocked
                    ? "UPDATED"
                    : "↻ REFRESH"}
              </button>
            </div>

            <div className={styles.walletRows}>
              <div
                className={`${styles.walletRow} ${
                  enoughToby && termsReady
                    ? styles.walletRowReady
                    : styles.walletRowShort
                }`}
              >
                <img className={styles.tokenIcon} src="/tokens/toby.PNG" alt="" />

                <div className={styles.walletCopy}>
                  <small>TOBY IN WALLET</small>
                  <strong>{fmt(props.tobyBalance, props.tobyDecimals, 0)}</strong>
                  <em
                    className={
                      enoughToby && termsReady ? styles.ready : styles.short
                    }
                  >
                    {!termsReady
                      ? "Waiting for live terms"
                      : enoughToby
                        ? "Ready for commitment"
                        : `Need ${fmt(tobyShortfall, props.tobyDecimals, 0)} more`}
                  </em>
                </div>

                {termsReady && !enoughToby ? (
                  <Link
                    prefetch={false}
                    href="/?buy=TOBY#swap"
                    className={styles.getFunds}
                  >
                    GET TOBY →
                  </Link>
                ) : null}
              </div>

              <div
                className={`${styles.walletRow} ${
                  enoughPatience && termsReady
                    ? styles.walletRowReady
                    : styles.walletRowShort
                }`}
              >
                <img
                  className={styles.tokenIcon}
                  src="/tokens/patience.PNG"
                  alt=""
                />

                <div className={styles.walletCopy}>
                  <small>PATIENCE IN WALLET</small>
                  <strong>{fmt(props.patienceBalance, props.patienceDecimals)}</strong>
                  <em
                    className={
                      enoughPatience && termsReady
                        ? styles.ready
                        : styles.short
                    }
                  >
                    {!termsReady
                      ? "Waiting for live terms"
                      : enoughPatience
                        ? "Ready for offering"
                        : `Need ${fmt(patienceShortfall, props.patienceDecimals)} more`}
                  </em>
                </div>

                {termsReady && !enoughPatience ? (
                  <Link
                    prefetch={false}
                    href="/?buy=PATIENCE#swap"
                    className={styles.getFunds}
                  >
                    GET PATIENCE →
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          {!termsReady ? (
            <div className={styles.termsWaiting}>
              Live ActivationManager terms are still loading. Awakening stays
              disabled until the current TOBY requirement, PATIENCE offering
              and minimum lock duration are confirmed from Base.
            </div>
          ) : null}

          {props.paused ? (
            <div className="activation-paused">
              <strong>LAND AWAKENING PAUSED</strong>
              <span>
                Current requirements remain visible, but activation cannot be
                submitted.
              </span>
            </div>
          ) : null}

          <button
            className="awaken-land-button"
            disabled={
              busy ||
              props.paused ||
              !termsReady ||
              !props.activationStarted ||
              !enoughToby ||
              !enoughPatience
            }
            onClick={props.onActivate}
          >
            {awakenLabel}
          </button>
        </>
      ) : (
        <>
          <div className="active-lock-grid">
            <div>
              <small>LOCK ID</small>
              <strong>#{props.lockId.toString()}</strong>
            </div>
            <div>
              <small>TOBY COMMITTED</small>
              <strong>{props.lock ? fmt(props.lock.xAmount, props.tobyDecimals, 0) : "Reading…"}</strong>
            </div>
            <div>
              <small>ACTIVATED</small>
              <strong>{date(props.lock?.startTime)}</strong>
            </div>
            <div>
              <small>MINIMUM UNLOCK</small>
              <strong>{date(props.lock?.unlockTime)}</strong>
            </div>
            <div>
              <small>COUNTDOWN</small>
              <strong>{countdown(props.lock?.unlockTime, now)}</strong>
            </div>
            <div>
              <small>OWNERSHIP GENERATION</small>
              <strong>{props.transferNonce.toString()}</strong>
            </div>
          </div>

          {props.lock ? (
            <div className="activation-lock-generation">
              <span>
                ACTIVATED DURING GENERATION{" "}
                <strong>{props.lock.ownershipNonceAtActivation.toString()}</strong>
              </span>
              {sameGeneration === false ? (
                <em>
                  This lock belongs to an earlier ownership generation. Current
                  activation status is still determined by isActive().
                </em>
              ) : null}
            </div>
          ) : null}

          {props.lock?.withdrawn ? (
            <div className="activation-paused">
              <strong>LOCK WITHDRAWN</strong>
              <span>This lock has already returned its committed TOBY.</span>
            </div>
          ) : null}

          {matured && !props.lock?.withdrawn ? (
            <div className="activation-matured">
              <span>TOBY IS NOW WITHDRAWABLE</span>
              <p>
                The land stays awakened until the current lock is withdrawn or
                ownership invalidates it.
              </p>
            </div>
          ) : null}

          {matured && !props.lock?.withdrawn && !confirmingWithdraw ? (
            <button
              className="withdraw-deactivate-button"
              disabled={busy}
              onClick={() => setConfirmingWithdraw(true)}
            >
              WITHDRAW TOBY &amp; DEACTIVATE
            </button>
          ) : null}

          {confirmingWithdraw ? (
            <div
              className="withdraw-confirm"
              role="alertdialog"
              aria-label="Confirm TOBY withdrawal"
            >
              <strong>Deactivate this land?</strong>
              <p>
                Withdrawing your committed TOBY will return the tokens to your
                wallet and deactivate this Lore Land. Continue?
              </p>

              <div>
                <button onClick={() => setConfirmingWithdraw(false)}>
                  Keep awakened
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => {
                    setConfirmingWithdraw(false);
                    props.onWithdraw();
                  }}
                >
                  Withdraw &amp; deactivate
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {props.stage !== "idle" && labels[props.stage] ? (
        <div className={`activation-stage ${props.stage}`}>
          <i />
          <span>{labels[props.stage]}</span>
        </div>
      ) : null}

      {props.message ? (
        <div
          className={`activation-message ${
            props.stage === "error" ? "error" : "success"
          }`}
        >
          {props.message}
        </div>
      ) : null}

      {props.hashes.length ? (
        <div className="activation-hashes">
          {props.hashes.map((hash, index) => (
            <a
              href={activationBaseScanTx(hash)}
              target="_blank"
              rel="noreferrer"
              key={hash}
            >
              Transaction {index + 1} ↗
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}
