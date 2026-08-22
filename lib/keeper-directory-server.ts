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
    const match = land.traits.find((trait) => trait.traitType.toLowerCase() === key.toLowerCase());
    if (match && !values.includes(match.value)) values.push(match.value);
    if (values.length >= 3) break;
  }
  return values;
}

async function readAllProfiles() {
  const rows: ActiveProfileRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URLSearchParams({
      select: "token_id,owner_address,keeper_name,keeper_social,keeper_link,description,community_name,updated_at",
      order: "updated_at.desc.nullslast",
    });
    const page = await supabaseRest<ActiveProfileRow[]>(`tobyswap_land_profiles?${query.toString()}`, {
      headers: { Range: `${offset}-${offset + PAGE_SIZE - 1}` },
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export const getKeeperDirectory = unstable_cache(
  async (): Promise<KeeperDirectoryRecord[]> => {
    if (!hasSupabaseServerEnv()) return [];

    const [rows, atlas] = await Promise.all([readAllProfiles(), getLoreAtlasIndex()]);
    const grouped = new Map<string, KeeperDirectoryRecord>();

    for (const row of rows) {
      const ownerAddress = clean(row.owner_address).toLowerCase();
      if (!ownerAddress || !hasKeeperContribution(row)) continue;

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

      if (!keeper.keeperName && clean(row.keeper_name)) keeper.keeperName = clean(row.keeper_name);
      if (!keeper.keeperSocial && clean(row.keeper_social)) keeper.keeperSocial = clean(row.keeper_social);
      if (!keeper.keeperLink && clean(row.keeper_link)) keeper.keeperLink = clean(row.keeper_link);
      if (clean(row.description)) keeper.storyCount += 1;

      const tokenId = String(row.token_id);
      const land = atlas.byId[tokenId];
      keeper.currentLands.push({
        tokenId,
        name: clean(row.community_name) || land?.canonicalName || `Lore Land #${tokenId}`,
        imageUrl: land?.imageUrl || null,
        story: clean(row.description) || null,
        signs: signsForLand(land),
      });
    }

    return [...grouped.values()]
      .map((keeper) => ({
        ...keeper,
        currentLands: keeper.currentLands.sort((a, b) => Number(a.tokenId) - Number(b.tokenId)),
      }))
      .sort(
        (a, b) =>
          b.currentLands.length - a.currentLands.length ||
          (a.keeperName || a.keeperSocial || a.ownerAddress).localeCompare(
            b.keeperName || b.keeperSocial || b.ownerAddress,
          ),
      );
  },
  ["tobyswap-keeper-directory-v1"],
  { revalidate: 300 },
);

export async function getKeeperDetail(ownerAddress: string): Promise<KeeperDetailRecord | null> {
  const owner = clean(ownerAddress).toLowerCase();
  if (!owner || !hasSupabaseServerEnv()) return null;

  const directory = await getKeeperDirectory();
  const current = directory.find((keeper) => keeper.ownerAddress === owner);
  if (!current) return null;

  let history: HistoryRow[] = [];
  try {
    const query = new URLSearchParams({
      owner_address: `eq.${owner}`,
      select: "token_id,owner_address,keeper_name,keeper_social,keeper_link,description,community_name,became_previous_at",
      order: "became_previous_at.desc",
      limit: "40",
    });
    history = await supabaseRest<HistoryRow[]>(`tobyswap_land_keeper_history?${query.toString()}`);
  } catch {
    history = [];
  }

  return {
    ...current,
    previousLands: history.map((row) => ({
      tokenId: String(row.token_id),
      name: clean(row.community_name) || `Lore Land #${String(row.token_id)}`,
      story: clean(row.description) || null,
      becamePreviousAt: row.became_previous_at || null,
    })),
  };
}
