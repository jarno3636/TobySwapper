import "server-only";

import { createHash } from "crypto";
import { base } from "viem/chains";
import { LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";
import { extractLoreTraits, normalizeLoreMetadata } from "@/lib/lore-metadata-shared";
import { hasSupabaseServerEnv, supabaseRpc } from "@/lib/supabase/rest";

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function metadataHash(metadata: unknown) {
  try {
    return createHash("sha256").update(JSON.stringify(metadata)).digest("hex");
  } catch {
    return null;
  }
}

export async function persistLoreMetadata(input: {
  tokenId: bigint | string;
  tokenUri: string;
  metadataUri?: string | null;
  metadata: Record<string, unknown>;
  revealed: boolean;
  source?: string | null;
}) {
  if (!hasSupabaseServerEnv()) return false;

  const tokenId = String(input.tokenId);
  const normalized = normalizeLoreMetadata(input.metadata, input.metadataUri, input.tokenUri) as Record<string, unknown>;
  const traits = extractLoreTraits(normalized).map((trait, index) => ({
    index,
    trait_type: trait.trait_type,
    value: trait.value,
    value_text: stringValue(trait.value),
    display_type: trait.display_type || null,
  }));

  const image = normalized.image ?? normalized.image_url ?? normalized.imageUrl ?? null;
  const animation = normalized.animation_url ?? null;
  const external = normalized.external_url ?? null;

  try {
    await supabaseRpc("tobyswap_upsert_lore_metadata", {
      p_collection_address: LORE_COLLECTION_ADDRESS.toLowerCase(),
      p_chain_id: base.id,
      p_token_id: tokenId,
      p_token_uri: input.tokenUri,
      p_metadata_uri: input.metadataUri || null,
      p_name: typeof normalized.name === "string" ? normalized.name : null,
      p_description: typeof normalized.description === "string" ? normalized.description : null,
      p_image_uri: typeof image === "string" ? image : null,
      p_animation_uri: typeof animation === "string" ? animation : null,
      p_external_url: typeof external === "string" ? external : null,
      p_metadata: normalized,
      p_metadata_hash: metadataHash(normalized),
      p_revealed: input.revealed,
      p_source: input.source || "canonical",
      p_traits: traits,
    });
    return true;
  } catch (error) {
    console.warn("Lore metadata cache write failed", error);
    return false;
  }
}
