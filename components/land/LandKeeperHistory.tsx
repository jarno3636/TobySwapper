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

function keeperTitle(position: number) {
  if (position === 1) return "THE FIRST KEEPER";
  if (position === 2) return "THE SECOND KEEPER";
  if (position === 3) return "THE THIRD KEEPER";
  return `KEEPER ${position}`;
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
          <h2 id="keeper-history-title">Keepers Before You</h2>
          <p>Every keeper leaves a trace. Their words remain with the land even after the deed changes hands.</p>
        </div>
        {!loading ? <span className="keeper-history-count"><i aria-hidden="true" /> {history.length} {history.length === 1 ? "memory" : "memories"}</span> : null}
      </div>

      {loading ? (
        <div className="keeper-history-loading">Reading the land&apos;s memory…</div>
      ) : (
        <div className="keeper-history-list">
          {visible.map((entry, index) => {
            const position = Math.max(1, history.length - index);
            const keeper = entry.keeper_name || entry.keeper_social || null;
            const leftAt = formatDate(entry.became_previous_at || entry.created_at);
            return (
              <article className="keeper-history-entry" key={String(entry.id)}>
                <div className="keeper-history-sigil" aria-hidden="true">◌</div>
                <div className="keeper-history-copy">
                  <div className="keeper-history-meta">
                    <strong>{keeperTitle(position)}</strong>
                    {leftAt ? <time>{leftAt}</time> : null}
                  </div>
                  {keeper ? <div className="keeper-history-name">{keeper}</div> : null}
                  {entry.community_name ? <h3>{entry.community_name}</h3> : null}
                  {entry.description ? <blockquote>“{entry.description}”</blockquote> : <p className="keeper-history-empty">No Keeper&apos;s Story was preserved for this chapter.</p>}
                  {entry.keeper_link ? <div className="keeper-history-links"><a href={entry.keeper_link} target="_blank" rel="noreferrer">Follow their mark <span aria-hidden="true">↗</span></a></div> : null}
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
