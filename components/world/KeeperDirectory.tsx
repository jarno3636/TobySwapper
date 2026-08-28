"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { KeeperDirectoryRecord } from "@/lib/keeper-directory-server";
import TobyworldIcon from "@/components/TobyworldIcon";

function identity(keeper: KeeperDirectoryRecord) {
  const land = keeper.currentLands[0];

  return (
    keeper.keeperName ||
    keeper.keeperSocial ||
    (land ? `Keeper of #${land.tokenId}` : "Tobyworld Keeper")
  );
}

function localFilter(
  keepers: KeeperDirectoryRecord[],
  query: string,
) {
  const q = query.trim().replace(/^#/, "").toLowerCase();

  if (!q) return keepers;

  return keepers.filter((keeper) =>
    [
      keeper.keeperName,
      keeper.keeperSocial,
      ...keeper.currentLands.flatMap((land) => [
        land.name,
        land.tokenId,
        `#${land.tokenId}`,
        ...land.signs,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

export default function KeeperDirectory({
  keepers: initialKeepers,
}: {
  keepers: KeeperDirectoryRecord[];
}) {
  const [keepers, setKeepers] = useState(initialKeepers);
  const [serverResults, setServerResults] = useState<
    KeeperDirectoryRecord[] | null
  >(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const deferredQuery = useDeferredValue(query.trim());

  /*
   * Critical change:
   * The search field now asks the server/Supabase directly.
   *
   * If the page happened to open with an empty/stale Keeper directory,
   * typing "30" or "Proof" can still recover the saved Keeper Mark.
   */
  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError("");

      try {
        const params = new URLSearchParams({
          limit: "100",
        });

        if (deferredQuery) {
          params.set("q", deferredQuery);
        }

        const response = await fetch(`/api/keepers?${params.toString()}`, {
          cache: "no-store",
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            payload?.error || "Keeper Marks could not be loaded.",
          );
        }

        if (cancelled) return;

        const results = Array.isArray(payload?.keepers)
          ? payload.keepers
          : [];

        if (deferredQuery) {
          setServerResults(results);
        } else {
          setKeepers(results);
          setServerResults(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Keeper Marks could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, deferredQuery ? 260 : 40);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredQuery]);

  const filtered = useMemo(() => {
    if (deferredQuery && serverResults !== null) {
      return serverResults;
    }

    return localFilter(keepers, deferredQuery);
  }, [keepers, serverResults, deferredQuery]);

  return (
    <section className="keeper-directory-panel">
      <div className="keeper-directory-head">
        <div>
          <span className="land-section-kicker">KEEPER MARKS</span>
          <h1>Meet the Keepers</h1>
          <p>
            Keeper-written identity lives beside the canonical Lore Land,
            never inside it. Search by Keeper name, public handle, or Lore
            Deed number.
          </p>
        </div>

        <label className="keeper-search-field">
          <span className="keeper-search-label">FIND A KEEPER OR DEED</span>

          <div className="keeper-search-control">
            <svg
              className="keeper-search-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>

            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setServerResults(null);
              }}
              placeholder="Search Proof, #30, or 30"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search Keeper Marks by name or deed number"
            />

            <span className="keeper-search-badge" aria-hidden="true">
              SEARCH
            </span>
          </div>

          <small className="keeper-search-hint">
            Keeper name, public handle, or canonical Lore Deed number.
          </small>
        </label>
      </div>

      <div className="keeper-directory-count" aria-live="polite">
        {loading
          ? "Following the trail…"
          : `${filtered.length.toLocaleString()} keeper ${
              filtered.length === 1 ? "mark" : "marks"
            }`}
      </div>

      {loadError ? (
        <div className="keeper-directory-notice" role="status">
          <strong>Keeper search could not reach the directory.</strong>
          <span>{loadError}</span>
        </div>
      ) : null}

      <div className="keeper-directory-grid">
        {filtered.map((keeper) => {
          const first = keeper.currentLands[0];

          return (
            <Link
              prefetch={false}
              href={`/keeper/${keeper.ownerAddress}`}
              className="keeper-directory-card"
              key={keeper.ownerAddress}
            >
              <div className="keeper-directory-art">
                <TobyworldIcon kind="toby" size={54} />

                <b>
                  {keeper.currentLands.length}{" "}
                  {keeper.currentLands.length === 1 ? "LAND" : "LANDS"}
                </b>
              </div>

              <div className="keeper-directory-copy">
                <span>KEEPER MARK</span>
                <h2>{identity(keeper)}</h2>

                <p>
                  {keeper.keeperSocial && keeper.keeperName
                    ? keeper.keeperSocial
                    : first
                      ? `Keeper of Lore Land #${first.tokenId}`
                      : "Community Keeper Mark"}
                </p>

                {first ? (
                  <div className="keeper-directory-land">
                    <small>CURRENT PLACE</small>
                    <strong>{first.name}</strong>
                    <em>#{first.tokenId}</em>
                  </div>
                ) : null}

                <footer>
                  <small>
                    {keeper.storyCount
                      ? `${keeper.storyCount} keeper ${
                          keeper.storyCount === 1 ? "story" : "stories"
                        }`
                      : "No public story yet"}
                  </small>

                  <b>Visit Keeper →</b>
                </footer>
              </div>
            </Link>
          );
        })}
      </div>

      {!loading && !loadError && !filtered.length ? (
        <div className="keeper-directory-empty">
          <strong>No saved Keeper Mark matched this search.</strong>

          <span>
            If this deed already has a Keeper Mark, try the exact deed number
            (for example <b>30</b>) or the exact public Keeper name.
          </span>
        </div>
      ) : null}
    </section>
  );
}
