"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LinkMaybeMini from "@/components/LinkMaybeMini";

type Leader = {
  rank: number;
  address: `0x${string}`;
  burnedRaw: string;
  burned: string;
  swaps: number;
  lastBlock: string;
};

type Payload = {
  ok: boolean;
  source?: string;
  contract?: string;
  uniqueBurners?: number;
  swapEvents?: number;
  totalFromEvents?: string;
  leaders?: Leader[];
  updatedAt?: string;
  error?: string;
};

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function prettyBurn(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n >= 100_000 ? compact.format(n) : number.format(n);
}

function Medal({ rank }: { rank: number }) {
  if (rank > 3) return <span className="burn-rank-number">#{rank}</span>;
  return <span className={`burn-medal burn-medal-${rank}`} aria-label={`Rank ${rank}`}>{rank}</span>;
}

function PodiumCard({ row }: { row: Leader }) {
  return (
    <LinkMaybeMini
      href={`https://basescan.org/address/${row.address}`}
      className={`burn-podium-card burn-podium-${row.rank}`}
    >
      <span className="burn-podium-glint" aria-hidden="true" />
      <Medal rank={row.rank} />
      <div className="burn-avatar" aria-hidden="true">
        <span>{row.address.slice(2, 4).toUpperCase()}</span>
      </div>
      <strong className="burn-podium-address">{short(row.address)}</strong>
      <span className="burn-podium-amount">{prettyBurn(row.burned)} <small>TOBY</small></span>
      <span className="burn-podium-swaps">{row.swaps} swap{row.swaps === 1 ? "" : "s"}</span>
    </LinkMaybeMini>
  );
}

export default function BurnerLeaderboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    try {
      const res = await fetch("/api/leaderboard/burners", { cache: "no-store" });
      const json = (await res.json()) as Payload;
      setData(json);
    } catch (error: any) {
      setData({ ok: false, error: error?.message || "Unable to load leaderboard" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const leaders = data?.leaders ?? [];
  const podium = useMemo(() => leaders.slice(0, 3), [leaders]);
  const rest = useMemo(() => leaders.slice(3), [leaders]);

  return (
    <section className="burn-board-shell">
      <div className="burn-board-head">
        <div>
          <span className="world-kicker">ONCHAIN · BASE</span>
          <h1 className="burn-board-title">Pond Burners</h1>
          <p className="burn-board-copy">Every rank is rebuilt from TobySwap&apos;s onchain <code>SwapSummary</code> events.</p>
        </div>
        <button className="metal-button burn-refresh" type="button" onClick={() => void load(true)} disabled={refreshing}>
          <span className={refreshing ? "burn-refresh-spin" : ""}>↻</span>
          {refreshing ? "Reading…" : "Refresh"}
        </button>
      </div>

      <div className="burn-stat-grid" aria-label="Leaderboard totals">
        <div className="burn-stat burn-stat-fire"><span>🔥</span><small>Burn tracked</small><strong>{data?.ok ? `${prettyBurn(data.totalFromEvents || "0")} TOBY` : "—"}</strong></div>
        <div className="burn-stat burn-stat-blue"><span>🐸</span><small>Burners</small><strong>{data?.ok ? number.format(data.uniqueBurners || 0) : "—"}</strong></div>
        <div className="burn-stat burn-stat-green"><span>↔</span><small>Swaps</small><strong>{data?.ok ? number.format(data.swapEvents || 0) : "—"}</strong></div>
      </div>

      {loading && (
        <div className="burn-loading" aria-live="polite">
          <div className="burn-orbit"><span /><span /><span /></div>
          <strong>Reading the burn trail…</strong>
          <small>Aggregating TobySwap events from Base.</small>
        </div>
      )}

      {!loading && !data?.ok && (
        <div className="burn-error" role="status">
          <span>🌀</span>
          <div><strong>The pond is having trouble reading Base.</strong><p>{data?.error || "Try refreshing in a moment."}</p></div>
        </div>
      )}

      {!loading && data?.ok && leaders.length === 0 && (
        <div className="burn-empty">No burn events found in the indexed contract history yet.</div>
      )}

      {!loading && data?.ok && leaders.length > 0 && (
        <>
          <div className="burn-podium" aria-label="Top burners">
            {podium.map((row) => <PodiumCard key={row.address} row={row} />)}
          </div>

          {rest.length > 0 && (
            <div className="burn-table-wrap">
              <div className="burn-table-label"><span>THE BURN TRAIL</span><span>Top {leaders.length}</span></div>
              <div className="burn-table">
                {rest.map((row) => (
                  <LinkMaybeMini key={row.address} href={`https://basescan.org/address/${row.address}`} className="burn-row">
                    <Medal rank={row.rank} />
                    <span className="burn-row-avatar">{row.address.slice(2, 4).toUpperCase()}</span>
                    <span className="burn-row-user"><strong>{short(row.address)}</strong><small>{row.swaps} swap{row.swaps === 1 ? "" : "s"}</small></span>
                    <span className="burn-row-value"><strong>{prettyBurn(row.burned)}</strong><small>TOBY burned</small></span>
                    <span className="burn-row-arrow">↗</span>
                  </LinkMaybeMini>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="burn-proof-strip">
        <span className="burn-proof-icon">◇</span>
        <p><strong>Proof, not points.</strong> Rankings come from the deployed TobySwap contract&apos;s burn amount attributed to each <code>user</code> in <code>SwapSummary</code>.</p>
        <LinkMaybeMini href="https://basescan.org/address/0xfC098D8d13CD4583715ECc2eFC1894F39947599d">Contract ↗</LinkMaybeMini>
      </div>

      {data?.updatedAt && <p className="burn-updated">Updated {new Date(data.updatedAt).toLocaleString()} · {data.source}</p>}
    </section>
  );
}
