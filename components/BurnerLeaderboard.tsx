"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import LinkMaybeMini from "@/components/LinkMaybeMini";
import { getMiniSdk, isInFarcasterMiniApp, openInMini } from "@/lib/miniapps";

type FarcasterProfile = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

type Leader = {
  rank: number;
  address: `0x${string}`;
  burnedRaw: string;
  burned: string;
  swaps: number;
  lastBlock: string;
  title: string;
  titleKey: string;
  bestRank: number;
  bestTitle: string;
  profile?: FarcasterProfile;
};

type Payload = {
  ok: boolean;
  source?: string;
  contract?: string;
  uniqueBurners?: number;
  swapEvents?: number;
  totalFromEvents?: string;
  leaders?: Leader[];
  viewer?: Leader | null;
  persistent?: boolean;
  newEvents?: number;
  syncMode?: string;
  warning?: string;
  updatedAt?: string;
  error?: string;
  hint?: string;
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

function displayName(row: Leader) {
  return row.profile?.displayName || (row.profile?.username ? `@${row.profile.username}` : short(row.address));
}

function ProfileAvatar({ row, size = "normal", override }: { row: Leader; size?: "normal" | "large"; override?: FarcasterProfile }) {
  const profile = override || row.profile;
  const label = profile?.displayName || profile?.username || short(row.address);
  const pfp = profile?.pfpUrl;

  return (
    <span className={`burn-pfp burn-pfp-${size}`} aria-label={label}>
      {pfp ? (
        <img src={pfp} alt={`${label} profile`} loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <img src="/tokens/toby.PNG" alt="Toby frog" loading="lazy" className="burn-pfp-fallback" />
      )}
      <i className="burn-pfp-shine" aria-hidden="true" />
    </span>
  );
}

function RankTitle({ row }: { row: Leader }) {
  return <span className={`burn-title-badge burn-title-${row.titleKey || "ember"}`}>{row.title}</span>;
}

function Medal({ rank }: { rank: number }) {
  if (rank > 3) return <span className="burn-rank-number">#{rank}</span>;
  return <span className={`burn-medal burn-medal-${rank}`} aria-label={`Rank ${rank}`}>{rank}</span>;
}

function farcasterProfileHref(profile?: FarcasterProfile) {
  return profile?.username ? `https://farcaster.xyz/@${encodeURIComponent(profile.username)}` : undefined;
}

function BurnerLink({ row, className, children }: { row: Leader; className: string; children: React.ReactNode }) {
  const farcasterHref = farcasterProfileHref(row.profile);
  const hasFarcasterIdentity = !!(row.profile?.fid || row.profile?.username);

  // Anonymous/onchain-only burners stay inside the leaderboard. Their truncated
  // wallet is shown beside the Toby frog instead of turning every row into a
  // BaseScan link. Farcaster-linked burners open their social profile.
  if (!hasFarcasterIdentity) {
    return <div className={`${className} burn-row-anonymous`}>{children}</div>;
  }

  const href = farcasterHref || "#";
  const onClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    if (row.profile?.fid) {
      try {
        if (await isInFarcasterMiniApp()) {
          const sdk = await getMiniSdk();
          const viewProfile = (sdk as any)?.actions?.viewProfile;
          if (typeof viewProfile === "function") {
            event.preventDefault();
            await viewProfile({ fid: row.profile.fid });
            return;
          }
        }
      } catch {}
    }

    if (!farcasterHref) {
      event.preventDefault();
      return;
    }

    if (await isInFarcasterMiniApp()) {
      event.preventDefault();
      const opened = await openInMini(farcasterHref);
      if (!opened) window.location.href = farcasterHref;
    }
  };

  return (
    <a href={href} className={className} onClick={onClick} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function PodiumCard({ row }: { row: Leader }) {
  return (
    <BurnerLink row={row} className={`burn-podium-card burn-podium-${row.rank}`}>
      <span className="burn-podium-glint" aria-hidden="true" />
      <Medal rank={row.rank} />
      <ProfileAvatar row={row} size="large" />
      <strong className="burn-podium-address">{displayName(row)}</strong>
      {row.profile?.username && row.profile.displayName && <span className="burn-podium-handle">@{row.profile.username}</span>}
      <RankTitle row={row} />
      <span className="burn-podium-amount">{prettyBurn(row.burned)} <small>TOBY</small></span>
      <span className="burn-podium-swaps">{row.swaps} swap{row.swaps === 1 ? "" : "s"}</span>
    </BurnerLink>
  );
}

export default function BurnerLeaderboard() {
  const { address } = useAccount();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveProfile, setLiveProfile] = useState<FarcasterProfile | undefined>();

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    try {
      const suffix = address ? `?address=${encodeURIComponent(address)}` : "";
      const cacheBust = manual ? `${suffix ? "&" : "?"}refresh=${Date.now()}` : "";
      const res = await fetch(`/api/leaderboard/burners${suffix}${cacheBust}`, { cache: manual ? "no-store" : "force-cache" });
      const json = (await res.json()) as Payload;
      setData(json);
    } catch (error: any) {
      setData({ ok: false, error: error?.message || "Unable to load leaderboard" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address]);

  useEffect(() => { void load(false); }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await isInFarcasterMiniApp()) || cancelled) return;
        const sdk = await getMiniSdk();
        const rawContext = (sdk as any)?.context;
        const context = typeof rawContext === "function" ? await rawContext() : await rawContext;
        const user = context?.user;
        if (!cancelled && user?.fid) {
          setLiveProfile({
            fid: Number(user.fid),
            username: user.username,
            displayName: user.displayName,
            pfpUrl: user.pfpUrl,
          });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const leaders = data?.leaders ?? [];
  const podium = useMemo(() => leaders.slice(0, 3), [leaders]);
  const rest = useMemo(() => leaders.slice(3), [leaders]);
  const viewer = data?.viewer || (address ? leaders.find((row) => row.address.toLowerCase() === address.toLowerCase()) : undefined);

  return (
    <section className="burn-board-shell">
      <div className="burn-board-head">
        <div>
          <span className="world-kicker">ONCHAIN · BASE · REMEMBERED</span>
          <h1 className="burn-board-title">Pond Burners</h1>
          <p className="burn-board-copy">The chain decides the rank. TobySwap remembers your best climb, title, and Farcaster face.</p>
        </div>
        <button className="metal-button burn-refresh" type="button" onClick={() => void load(true)} disabled={refreshing}>
          <span className={refreshing ? "burn-refresh-spin" : ""}>↻</span>
          {refreshing ? "Reading…" : "Refresh"}
        </button>
      </div>

      {viewer && (
        <div className="burn-me-card">
          <span className="burn-me-glow" aria-hidden="true" />
          <div className="burn-me-profile">
            <ProfileAvatar row={viewer} size="large" override={liveProfile} />
            <div>
              <small>YOUR POND RANK</small>
              <strong>{liveProfile?.displayName || displayName(viewer)}</strong>
              <RankTitle row={viewer} />
            </div>
          </div>
          <div className="burn-me-metrics">
            <div><small>Current</small><strong>#{viewer.rank}</strong></div>
            <div><small>Best</small><strong>#{viewer.bestRank || viewer.rank}</strong></div>
            <div><small>Burned</small><strong>{prettyBurn(viewer.burned)}</strong><span>TOBY</span></div>
          </div>
        </div>
      )}

      <div className="burn-stat-grid" aria-label="Leaderboard totals">
        <div className="burn-stat burn-stat-fire"><span>🔥</span><small>Burn tracked</small><strong>{data?.ok ? `${prettyBurn(data.totalFromEvents || "0")} TOBY` : "—"}</strong></div>
        <div className="burn-stat burn-stat-green"><span>↔</span><small>Swaps</small><strong>{data?.ok ? number.format(data.swapEvents || 0) : "—"}</strong></div>
      </div>

      <div className="burn-title-legend" aria-label="Burner rank titles">
        <span className="burn-title-crown">👑 #1 Pond Crown</span>
        <span className="burn-title-keeper">🔥 #2–3 Flame Keeper</span>
        <span className="burn-title-inferno">△ #4–10 Inferno Toad</span>
        <span className="burn-title-guardian">✦ #11–25 Ember Guardian</span>
        <span className="burn-title-ripple">◌ #26–50 Ripple Burner</span>
        <span className="burn-title-spark">• #51–100 Pond Spark</span>
      </div>

      {loading && (
        <div className="burn-loading" aria-live="polite">
          <div className="burn-orbit"><span /><span /><span /></div>
          <strong>Reading the burn trail…</strong>
          <small>Syncing Base events and restoring the pond&apos;s memory.</small>
        </div>
      )}

      {!loading && !data?.ok && (
        <div className="burn-error burn-error-upgraded" role="status">
          <span className="burn-error-orb">🌀</span>
          <div className="min-w-0 flex-1">
            <strong>The pond lost the Base signal.</strong>
            <p>{data?.error || "Try refreshing in a moment."}</p>
            {data?.hint && <small>{data.hint}</small>}
            <div className="burn-error-actions">
              <button type="button" className="metal-button compact-metal" onClick={() => void load(true)}>Try Base again</button>
              <a className="metal-button compact-metal" href="/#swap">Back to Swap</a>
            </div>
          </div>
        </div>
      )}

      {!loading && data?.ok && leaders.length === 0 && <div className="burn-empty">No burn events found in the indexed contract history yet.</div>}

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
                  <BurnerLink key={row.address} row={row} className={`burn-row burn-row-${row.titleKey || "ember"}`}>
                    <Medal rank={row.rank} />
                    <ProfileAvatar row={row} />
                    <span className="burn-row-user">
                      <strong>{displayName(row)}</strong>
                      <small>{row.profile?.username && row.profile.displayName ? `@${row.profile.username} · ` : ""}{row.swaps} swap{row.swaps === 1 ? "" : "s"}</small>
                    </span>
                    <span className="burn-row-title"><RankTitle row={row} />{row.bestRank && row.bestRank < row.rank ? <small>Best #{row.bestRank}</small> : null}</span>
                    <span className="burn-row-value"><strong>{prettyBurn(row.burned)}</strong><small>TOBY burned</small></span>
                    <span className="burn-row-arrow">↗</span>
                  </BurnerLink>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="burn-proof-strip">
        <span className="burn-proof-icon">◇</span>
        <p><strong>Proof + memory.</strong> Burn totals and current ranks come from <code>SwapSummary</code> on Base. Supabase only remembers indexed events, best rank, titles, and optional Farcaster display metadata.</p>
        <LinkMaybeMini href="https://basescan.org/address/0xfC098D8d13CD4583715ECc2eFC1894F39947599d">Contract ↗</LinkMaybeMini>
      </div>

      {data?.ok && data.warning && (
        <div className="burn-sync-note" role="status">
          <span>◌</span>
          <p><strong>Showing remembered ranks.</strong> Live Base sync will retry automatically. <small>{data.warning}</small></p>
        </div>
      )}

      {data?.updatedAt && <p className="burn-updated">Updated {new Date(data.updatedAt).toLocaleString()} · {data.source}{data.syncMode ? ` · ${data.syncMode}` : ""}{data.persistent ? " · persistent index" : " · live fallback"}</p>}
    </section>
  );
}
