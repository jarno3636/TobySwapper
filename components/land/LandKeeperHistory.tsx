"use client";

import { useEffect, useMemo, useState } from "react";

type KeeperHistoryEntry = {
  id: string | number;
  owner_address?: string | null;
  transfer_nonce?: string | number | null;
  community_name?: string | null;
  description?: string | null;
  keeper_name?: string | null;
  keeper_social?: string | null;
  keeper_link?: string | null;
  became_previous_at?: string | null;
  created_at?: string | null;
};

function shortAddress(value?: string | null) {
  if (!value) return "Previous Keeper";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(date);
}

export default function LandKeeperHistory({ tokenId }: { tokenId: bigint }) {
  const [history, setHistory] = useState<KeeperHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/land/history?tokenId=${tokenId.toString()}`, { cache: "force-cache" })
      .then(async (response) => (response.ok ? response.json() : { history: [] }))
      .then((body) => {
        if (cancelled) return;
        setHistory(Array.isArray(body?.history) ? body.history : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  const visible = useMemo(() => (expanded ? history : history.slice(0, 3)), [expanded, history]);

  if (!loading && history.length === 0) return null;

  return (
    <section className="keeper-history" aria-labelledby="keeper-history-title">
      <div className="keeper-history-head">
        <div>
          <span className="land-section-kicker">LAND MEMORY</span>
          <h2 id="keeper-history-title">Previous Keepers</h2>
          <p>Keeper-written marks are preserved as the deed changes hands. Canonical traits stay untouched.</p>
        </div>
        {!loading ? <span className="keeper-history-count">{history.length} remembered</span> : null}
      </div>

      {loading ? (
        <div className="keeper-history-loading">Reading the land&apos;s memory…</div>
      ) : (
        <div className="keeper-history-list">
          {visible.map((entry) => {
            const keeper = entry.keeper_name || entry.keeper_social || shortAddress(entry.owner_address);
            const leftAt = formatDate(entry.became_previous_at || entry.created_at);
            return (
              <article className="keeper-history-entry" key={String(entry.id)}>
                <div className="keeper-history-sigil" aria-hidden="true">◌</div>
                <div className="keeper-history-copy">
                  <div className="keeper-history-meta">
                    <strong>{keeper}</strong>
                    {leftAt ? <span>Previous keeper · {leftAt}</span> : <span>Previous keeper</span>}
                  </div>
                  {entry.community_name ? <h3>{entry.community_name}</h3> : null}
                  {entry.description ? <blockquote>{entry.description}</blockquote> : <p>No Keeper&apos;s Story was preserved for this generation.</p>}
                  <div className="keeper-history-links">
                    {entry.keeper_social ? <span>{entry.keeper_social}</span> : null}
                    {entry.keeper_link ? <a href={entry.keeper_link} target="_blank" rel="noreferrer">Visit mark ↗</a> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && history.length > 3 ? (
        <button type="button" className="keeper-history-toggle" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : `Read all ${history.length} previous keepers`}
        </button>
      ) : null}
    </section>
  );
}
