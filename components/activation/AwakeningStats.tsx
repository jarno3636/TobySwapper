"use client";

import { formatUnits } from "viem";

function amount(
  value: bigint,
  max = 3,
) {
  const number = Number(
    formatUnits(
      value,
      18,
    ),
  );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return number.toLocaleString(
    undefined,
    {
      maximumFractionDigits:
        max,
    },
  );
}

function durationLabel(
  seconds: bigint,
) {
  if (seconds <= 0n) {
    return "—";
  }

  const day =
    86_400n;

  if (
    seconds % day === 0n
  ) {
    const days =
      seconds / day;

    return `${days.toLocaleString()} ${
      days === 1n
        ? "day"
        : "days"
    }`;
  }

  const hours =
    Number(seconds) /
    3600;

  return `${hours.toLocaleString(
    undefined,
    {
      maximumFractionDigits:
        1,
    },
  )} hours`;
}

export default function AwakeningStats(
  props: {
    totalActivations: bigint;
    totalLockedX: bigint;
    activationXAmount: bigint;
    activationYCost: bigint;
    lockDuration: bigint;
    solvent: boolean;
  },
) {
  return (
    <section className="awakening-stats">
      <header>
        <span>
          THE AWAKENING
        </span>

        <h2>
          Onchain state,
          now.
        </h2>

        <p>
          Live values read
          from the official
          ActivationManager.
        </p>
      </header>

      <div className="awakening-stat-grid">
        <div>
          <small>
            HISTORICAL
            ACTIVATIONS
          </small>

          <strong>
            {props.totalActivations.toLocaleString()}
          </strong>

          <em>
            All activations
            ever created
          </em>
        </div>

        <div>
          <small>
            TOBY CURRENTLY
            LOCKED
          </small>

          <strong>
            {amount(
              props.totalLockedX,
              0,
            )}
          </strong>

          <em>TOBY</em>
        </div>

        <div className="blue">
          <small>
            CURRENT TOBY
            COMMITMENT
          </small>

          <strong>
            {amount(
              props.activationXAmount,
              0,
            )}
          </strong>

          <em>
            Live manager
            requirement
          </em>
        </div>

        <div className="red">
          <small>
            CURRENT PATIENCE
            OFFERING
          </small>

          <strong>
            {amount(
              props.activationYCost,
              4,
            )}
          </strong>

          <em>
            Live manager
            requirement
          </em>
        </div>

        <div>
          <small>
            MINIMUM
            COMMITMENT
          </small>

          <strong>
            {durationLabel(
              props.lockDuration,
            )}
          </strong>

          <em>
            Read from
            LOCK_DURATION()
          </em>
        </div>

        <div
          className={
            props.solvent
              ? "good"
              : "warn"
          }
        >
          <small>
            SYSTEM SOLVENCY
          </small>

          <strong>
            {props.solvent
              ? "SOLVENT"
              : "CHECK"}
          </strong>

          <em>
            Reported by
            ActivationManager
          </em>
        </div>
      </div>
    </section>
  );
}
