import "server-only";

import { unstable_cache } from "next/cache";
import { LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";
import { extractLoreTraits } from "@/lib/lore-metadata-shared";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

const PAGE_SIZE = 1000;
export const LORE_ATLAS_TOTAL = 2869;

type LoreRow = {
  token_id: string | number;
  name: string | null;
  cached_image_url: string | null;
  image_uri: string | null;
  metadata: Record<string, unknown> | null;
  revealed: boolean | null;
};

type ProfileRow = {
  token_id: string | number;
  community_name: string | null;
  description: string | null;
  keeper_name: string | null;
  keeper_social: string | null;
  keeper_link: string | null;
  banner_theme: string | null;
  updated_at: string | null;
};

export type AtlasTrait = {
  traitType: string;
  value: string;
};

export type LoreAtlasRecord = {
  tokenId: string;
  canonicalName: string | null;
  imageUrl: string | null;
  traits: AtlasTrait[];
  communityName: string | null;
  keeperStory: string | null;
  keeperName: string | null;
  keeperSocial: string | null;
  keeperLink: string | null;
  bannerTheme: string;
  updatedAt: string | null;
};

export type TraitDiscoveryValue = {
  value: string;
  count: number;
  percentage: number;
};

export type TraitDiscoveryGroup = {
  traitType: string;
  count: number;
  values: TraitDiscoveryValue[];
};

type AtlasIndex = {
  lands: LoreAtlasRecord[];
  byId: Record<string, LoreAtlasRecord>;
  discovery: TraitDiscoveryGroup[];
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function traitKey(traitType: unknown, value: unknown) {
  return `${clean(traitType).toLowerCase()}::${clean(value).toLowerCase()}`;
}

async function readPaged<T>(pathForRange: (offset: number) => string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await supabaseRest<T[]>(pathForRange(offset), {
      headers: { Range: `${offset}-${offset + PAGE_SIZE - 1}` },
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export const getLoreAtlasIndex = unstable_cache(
  async (): Promise<AtlasIndex> => {
    if (!hasSupabaseServerEnv()) throw new Error("Supabase server environment is not configured");

    const collection = LORE_COLLECTION_ADDRESS.toLowerCase();
    const loreRows = await readPaged<LoreRow>(() => {
      const query = new URLSearchParams({
        collection_address: `eq.${collection}`,
        revealed: "eq.true",
        select: "token_id,name,cached_image_url,image_uri,metadata,revealed",
        order: "token_id.asc",
      });
      return `tobyswap_lore_tokens?${query.toString()}`;
    });

    let profileRows: ProfileRow[] = [];
    try {
      profileRows = await readPaged<ProfileRow>(() => {
        const query = new URLSearchParams({
          select: "token_id,community_name,description,keeper_name,keeper_social,keeper_link,banner_theme,updated_at",
          order: "token_id.asc",
        });
        return `tobyswap_land_profiles?${query.toString()}`;
      });
    } catch {
      profileRows = [];
    }

    const profiles = new Map(profileRows.map((row) => [String(row.token_id), row]));
    const discoveryCounts = new Map<string, Map<string, { value: string; count: number }>>();

    const lands: LoreAtlasRecord[] = loreRows.map((row) => {
      const tokenId = String(row.token_id);
      const profile = profiles.get(tokenId);
      const traits: AtlasTrait[] = [];
      const seen = new Set<string>();

      if (row.metadata) {
        for (const trait of extractLoreTraits(row.metadata)) {
          const traitType = clean(trait.trait_type);
          const value = clean(trait.value);
          const key = traitKey(traitType, value);
          if (!traitType || !value || seen.has(key)) continue;
          seen.add(key);
          traits.push({ traitType, value });

          let values = discoveryCounts.get(traitType);
          if (!values) {
            values = new Map();
            discoveryCounts.set(traitType, values);
          }
          const normalizedValue = value.toLowerCase();
          const current = values.get(normalizedValue);
          values.set(normalizedValue, { value: current?.value || value, count: (current?.count || 0) + 1 });
        }
      }

      return {
        tokenId,
        canonicalName: row.name || null,
        imageUrl: row.cached_image_url || row.image_uri || null,
        traits,
        communityName: profile?.community_name || null,
        keeperStory: profile?.description || null,
        keeperName: profile?.keeper_name || null,
        keeperSocial: profile?.keeper_social || null,
        keeperLink: profile?.keeper_link || null,
        bannerTheme: profile?.banner_theme || "moss",
        updatedAt: profile?.updated_at || null,
      };
    });

    const discovery: TraitDiscoveryGroup[] = [...discoveryCounts.entries()]
      .map(([traitType, values]) => ({
        traitType,
        count: [...values.values()].reduce((sum, item) => sum + item.count, 0),
        values: [...values.values()]
          .map((item) => ({
            value: item.value,
            count: item.count,
            percentage: (item.count / LORE_ATLAS_TOTAL) * 100,
          }))
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      }))
      .sort((a, b) => a.traitType.localeCompare(b.traitType));

    return {
      lands,
      byId: Object.fromEntries(lands.map((land) => [land.tokenId, land])),
      discovery,
    };
  },
  ["tobyswap-lore-atlas-v2"],
  { revalidate: 900 },
);

export function landMatchesQuery(land: LoreAtlasRecord, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    land.tokenId,
    `#${land.tokenId}`,
    land.canonicalName,
    land.communityName,
    land.keeperStory,
    land.keeperName,
    land.keeperSocial,
    ...land.traits.flatMap((trait) => [trait.traitType, trait.value, `${trait.traitType} ${trait.value}`]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function landHasTrait(land: LoreAtlasRecord, traitType?: string | null, value?: string | null) {
  if (!traitType || !value) return true;
  const wanted = traitKey(traitType, value);
  return land.traits.some((trait) => traitKey(trait.traitType, trait.value) === wanted);
}

export function sharedSigns(index: AtlasIndex, tokenId: string, limit = 6) {
  const source = index.byId[tokenId];
  if (!source) return [];
  const sourceKeys = new Set(source.traits.map((trait) => traitKey(trait.traitType, trait.value)));

  return index.lands
    .filter((land) => land.tokenId !== tokenId)
    .map((land) => {
      const shared = land.traits.filter((trait) => sourceKeys.has(traitKey(trait.traitType, trait.value)));
      return { land, shared };
    })
    .filter((item) => item.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || Number(a.land.tokenId) - Number(b.land.tokenId))
    .slice(0, limit);
}
