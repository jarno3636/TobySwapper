import "server-only";

import { unstable_cache } from "next/cache";
import { getLoreAtlasIndex, type LoreAtlasRecord } from "@/lib/lore-atlas-server";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

const PAGE_SIZE = 1000;

type ActiveProfileRow = {
  token_id: string | number;
  owner_address: string | null;
  keeper_name: string | null;
  keeper_social: string | null;
  keeper_link: string | null;
  description: string | null;
  community_name: string | null;
  updated_at: string | null;
};

type HistoryRow = {
  token_id: string | number;
  owner_address: string | null;
  keeper_name: string | null;
  keeper_social: string | null;
  keeper_link: string | null;
  description: string | null;
  community_name: string | null;
  became_previous_at: string | null;
};

export type KeeperLandSummary = {
  tokenId: string;
  name: string;
  imageUrl: string | null;
  story: string | null;
  signs: string[];
};

export type KeeperDirectoryRecord = {
  ownerAddress: string;
  keeperName: string | null;
  keeperSocial: string | null;
  keeperLink: string | null;
  updatedAt: string | null;
  currentLands: KeeperLandSummary[];
  storyCount: number;
};

export type KeeperDetailRecord = KeeperDirectoryRecord & {
  previousLands: Array<{
    tokenId: string;
    name: string;
    story: string | null;
    becamePreviousAt: string | null;
  }>;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function hasKeeperContribution(row: ActiveProfileRow) {
  return Boolean(
    clean(row.keeper_name) ||
      clean(row.keeper_social) ||
      clean(row.keeper_link) ||
      clean(row.description) ||
      clean(row.community_name),
  );
}

function signsForLand(land?: LoreAtlasRecord | null) {
  if (!land) return [];

  const order = ["Land", "Core", "Keeper", "Relic", "Background"];
  const values: string[] = [];

  for (const key of order) {
    const match = land.traits.find(
      (trait) => trait.traitType.toLowerCase() === key.toLowerCase(),
    );

    if (match && !values.includes(match.value)) values.push(match.value);
    if (values.length >= 3) break;
  }

  return values;
}

/**
 * Keep this deliberately boring.
 *
 * The Keeper directory is community/profile data, not a huge onchain index.
 * Avoid PostgREST order modifiers here so a formatting/version difference
 * cannot turn a real Keeper Mark into "0 keeper marks".
 */
async function readAllProfiles() {
  const rows: ActiveProfileRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URLSearchParams({
      select:
        "token_id,owner_address,keeper_name,keeper_social,keeper_link,description,community_name,updated_at",
    });

    const page = await supabaseRest<ActiveProfileRow[]>(
      `tobyswap_land_profiles?${query.toString()}`,
      {
        headers: {
          Range: `${offset}-${offset + PAGE_SIZE - 1}`,
          "Range-Unit": "items",
        },
      },
    );

    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function matchesQuery(row: ActiveProfileRow, query: string) {
  const q = clean(query).replace(/^#/, "").toLowerCase();

  if (!q) return true;

  const tokenId = clean(row.token_id).toLowerCase();

  if (/^\d+$/.test(q) && tokenId === q) return true;

  return [
    row.keeper_name,
    row.keeper_social,
    row.community_name,
    row.description,
    tokenId ? `#${tokenId}` : "",
    tokenId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

async function buildKeeperDirectory(
  searchQuery = "",
): Promise<KeeperDirectoryRecord[]> {
  if (!hasSupabaseServerEnv()) return [];

  const rows = await readAllProfiles();
  const contributed = rows.filter(hasKeeperContribution);
  const q = clean(searchQuery);

  let selectedRows = contributed;

  if (q) {
    const directlyMatched = contributed.filter((row) => matchesQuery(row, q));

    // If one land/profile matches a Keeper's name or deed number, return all
    // current lands for that same Keeper instead of a chopped-up result.
    const matchedOwners = new Set(
      directlyMatched
        .map((row) => clean(row.owner_address).toLowerCase())
        .filter(Boolean),
    );

    selectedRows = matchedOwners.size
      ? contributed.filter((row) =>
          matchedOwners.has(clean(row.owner_address).toLowerCase()),
        )
      : directlyMatched;
  }

  // Canonical Atlas information is decoration/enrichment only.
  // A Keeper Mark must remain searchable even if Atlas enrichment hiccups.
  let atlas: Awaited<ReturnType<typeof getLoreAtlasIndex>> | null = null;

  try {
    atlas = await getLoreAtlasIndex();
  } catch (error) {
    console.error("[keepers] Atlas enrichment unavailable:", error);
  }

  const grouped = new Map<string, KeeperDirectoryRecord>();

  for (const row of selectedRows) {
    const ownerAddress = clean(row.owner_address).toLowerCase();

    // A saved Keeper Mark should have owner_address because the profile write
    // is wallet-verified. If an old malformed row does not, don't fabricate
    // a public wallet identity.
    if (!ownerAddress) {
      console.warn(
        `[keepers] Profile for deed #${clean(row.token_id)} has Keeper data but no owner_address`,
      );
      continue;
    }

    let keeper = grouped.get(ownerAddress);

    if (!keeper) {
      keeper = {
        ownerAddress,
        keeperName: clean(row.keeper_name) || null,
        keeperSocial: clean(row.keeper_social) || null,
        keeperLink: clean(row.keeper_link) || null,
        updatedAt: row.updated_at || null,
        currentLands: [],
        storyCount: 0,
      };

      grouped.set(ownerAddress, keeper);
    }

    if (!keeper.keeperName && clean(row.keeper_name)) {
      keeper.keeperName = clean(row.keeper_name);
    }

    if (!keeper.keeperSocial && clean(row.keeper_social)) {
      keeper.keeperSocial = clean(row.keeper_social);
    }

    if (!keeper.keeperLink && clean(row.keeper_link)) {
      keeper.keeperLink = clean(row.keeper_link);
    }

    if (clean(row.description)) keeper.storyCount += 1;

    const tokenId = clean(row.token_id);
    const land = atlas?.byId?.[tokenId];

    keeper.currentLands.push({
      tokenId,
      name:
        clean(row.community_name) ||
        land?.canonicalName ||
        `Lore Land #${tokenId}`,
      imageUrl: land?.imageUrl || null,
      story: clean(row.description) || null,
      signs: signsForLand(land),
    });
  }

  return [...grouped.values()]
    .map((keeper) => ({
      ...keeper,
      currentLands: keeper.currentLands.sort(
        (a, b) => Number(a.tokenId) - Number(b.tokenId),
      ),
    }))
    .sort(
      (a, b) =>
        b.currentLands.length - a.currentLands.length ||
        (a.keeperName || a.keeperSocial || a.ownerAddress).localeCompare(
          b.keeperName || b.keeperSocial || b.ownerAddress,
        ),
    );
}

/**
 * Authoritative, uncached read for the Keepers page and search box.
 */
export async function getKeeperDirectoryFresh() {
  return buildKeeperDirectory();
}

/**
 * Authoritative direct search. Deed #30 and "Proof" are resolved from
 * tobyswap_land_profiles itself, not from whatever directory happened to
 * be loaded into the browser earlier.
 */
export async function searchKeeperDirectoryFresh(query: string) {
  return buildKeeperDirectory(query);
}

/**
 * Tiny cache only for preview shelves where immediate editing freshness is
 * less important.
 */
export const getKeeperDirectory = unstable_cache(
  buildKeeperDirectory,
  ["tobyswap-keeper-directory-v4"],
  { revalidate: 60 },
);

export async function getKeeperDetail(
  ownerAddress: string,
): Promise<KeeperDetailRecord | null> {
  const owner = clean(ownerAddress).toLowerCase();

  if (!owner || !hasSupabaseServerEnv()) return null;

  const directory = await getKeeperDirectoryFresh();
  const current = directory.find((keeper) => keeper.ownerAddress === owner);

  if (!current) return null;

  let history: HistoryRow[] = [];

  try {
    // Fetch history broadly and compare addresses case-insensitively in JS.
    // Older rows may contain checksum casing even though newer rows are lowercased.
    const query = new URLSearchParams({
      select:
        "token_id,owner_address,keeper_name,keeper_social,keeper_link,description,community_name,became_previous_at",
      limit: "200",
    });

    const allHistory = await supabaseRest<HistoryRow[]>(
      `tobyswap_land_keeper_history?${query.toString()}`,
    );

    history = allHistory
      .filter(
        (row) => clean(row.owner_address).toLowerCase() === owner,
      )
      .sort(
        (a, b) =>
          new Date(b.became_previous_at || 0).getTime() -
          new Date(a.became_previous_at || 0).getTime(),
      )
      .slice(0, 40);
  } catch {
    history = [];
  }

  return {
    ...current,
    previousLands: history.map((row) => ({
      tokenId: clean(row.token_id),
      name: clean(row.community_name) || `Lore Land #${clean(row.token_id)}`,
      story: clean(row.description) || null,
      becamePreviousAt: row.became_previous_at || null,
    })),
  };
}
