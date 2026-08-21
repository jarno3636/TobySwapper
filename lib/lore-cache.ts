import { LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";
import { normalizeLoreMetadata } from "@/lib/lore-metadata-shared";
import type { LoreMetadata, LoreMetadataResult } from "@/lib/lore-metadata";

type CachedLoreRow = {
  token_id: number | string;
  token_uri: string | null;
  metadata_uri: string | null;
  name: string | null;
  description: string | null;
  image_uri: string | null;
  metadata: Record<string, unknown> | null;
  trait_count: number | null;
  revealed: boolean | null;
  fetched_at: string | null;
  last_verified_at: string | null;
};

export type CachedLoreMetadata = LoreMetadataResult & {
  tokenId: string;
  fetchedAt: string | null;
  lastVerifiedAt: string | null;
  traitCount: number;
  cacheSource: "supabase";
};

const MEMORY_TTL_MS = 10 * 60_000;
const memory = new Map<string, { at: number; value: CachedLoreMetadata | null }>();

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

function cacheKey(tokenId: string) {
  return `${LORE_COLLECTION_ADDRESS.toLowerCase()}:${tokenId}`;
}

export async function readCachedLoreMetadata(tokenId: bigint | string, force = false): Promise<CachedLoreMetadata | null> {
  const id = String(tokenId);
  if (!/^\d+$/.test(id)) return null;

  const key = cacheKey(id);
  if (!force) {
    const hot = memory.get(key);
    if (hot && Date.now() - hot.at < MEMORY_TTL_MS) return hot.value;
  }

  const supabase = publicSupabase();
  if (!supabase) return null;

  try {
    const collection = LORE_COLLECTION_ADDRESS.toLowerCase();
    const query = new URLSearchParams({
      collection_address: `eq.${collection}`,
      token_id: `eq.${id}`,
      select: "token_id,token_uri,metadata_uri,name,description,image_uri,metadata,trait_count,revealed,fetched_at,last_verified_at",
      limit: "1",
    });

    const response = await fetch(`${supabase.url}/rest/v1/tobyswap_lore_tokens?${query.toString()}`, {
      headers: {
        apikey: supabase.key,
        Authorization: `Bearer ${supabase.key}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;
    const rows = await response.json() as CachedLoreRow[];
    const row = rows[0];
    if (!row?.metadata || row.revealed !== true) {
      memory.set(key, { at: Date.now(), value: null });
      return null;
    }

    const normalized = normalizeLoreMetadata(row.metadata, row.metadata_uri, row.token_uri) as LoreMetadata;
    const result: CachedLoreMetadata = {
      tokenId: id,
      metadata: normalized,
      sourceUri: row.token_uri,
      resolvedMetadataUri: row.metadata_uri,
      directImage: null,
      error: null,
      fetchedAt: row.fetched_at,
      lastVerifiedAt: row.last_verified_at,
      traitCount: Number(row.trait_count || 0),
      cacheSource: "supabase",
    };

    memory.set(key, { at: Date.now(), value: result });
    return result;
  } catch {
    return null;
  }
}

export function clearCachedLoreMetadata(tokenId?: bigint | string) {
  if (tokenId === undefined) {
    memory.clear();
    return;
  }
  memory.delete(cacheKey(String(tokenId)));
}
