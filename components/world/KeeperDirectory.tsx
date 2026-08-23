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

function filterKeepers(
  keepers: KeeperDirectoryRecord[],
  query: string,
) {
  const q = query.trim().toLowerCase();

  if (!q) return keepers;

  return keepers.filter((keeper) =>
    [
      keeper.keeperName,
      keeper.keeperSocial,
      ...keeper.currentLands.flatMap((land) => [
        land.name,
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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(
    () => filterKeepers(keepers, deferredQuery),
    [keepers, deferredQuery],
  );

  // Refresh once on the client so a Keeper Mark saved moments ago appears
  // even if the visitor reached this page through a previously cached route.
  useEffect(() => {
    let cancelled = false;

    async function refreshKeepers() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch("/api/keepers?limit=100", {
          cache: "no-store",
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            payload?.error || "Keeper Marks could not be refreshed.",
          );
        }

        if (!cancelled && Array.isArray(payload?.keepers)) {
          setKeepers(payload.keepers);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Keeper Marks could not be refreshed.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    refreshKeepers();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="keeper-directory-panel">
      <div className="keeper-directory-head">
        <div>
          <span className="land-section-kicker">KEEPER MARKS</span>
          <h1>Meet the Keepers</h1>
          <p>
            Keeper-written identity lives beside the canonical Lore Land,
            never inside it. Explore the people currently tending places
            across Tobyworld.
          </p>
        </div>

        <label>
          <span>FIND A KEEPER</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, handle, land, sign…"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="keeper-directory-count" aria-live="polite">
        {loading && !keepers.length
          ? "Finding Keeper Marks…"
          : `${filtered.length.toLocaleString()} keeper ${
              filtered.length === 1 ? "mark" : "marks"
            }`}
      </div>

      {loadError && !keepers.length ? (
        <div className="keeper-directory-empty">
          <strong>The Keeper trail is temporarily quiet.</strong>
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
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
                {first?.imageUrl ? (
                  <img
                    src={first.imageUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <TobyworldIcon
                    kind="lore"
                    size={68}
                    className="tw-placeholder-lore"
                  />
                )}

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
          <strong>No Keeper Mark matched that trail.</strong>
          <span>
            Try a Keeper name, public handle, land name, deed number, or
            canonical sign.
          </span>
        </div>
      ) : null}
    </section>
  );
}
