export type NormalizedLoreTrait = {
  trait_type: string;
  value: unknown;
  display_type?: string;
};

const RESERVED_PROPERTY_KEYS = new Set([
  "name", "description", "image", "image_url", "imageurl", "animation_url",
  "external_url", "attributes", "traits", "files", "creators", "category",
  "compiler", "dna", "edition", "date",
]);

function usableValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function labelFrom(item: any, fallback: string) {
  const label = item?.trait_type ?? item?.traitType ?? item?.type ?? item?.name ?? item?.key ?? fallback;
  return String(label || fallback).trim();
}

function valueFrom(item: any) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    if ("value" in item) return item.value;
    if ("trait_value" in item) return item.trait_value;
    if ("traitValue" in item) return item.traitValue;
  }
  return item;
}

function pushTrait(out: NormalizedLoreTrait[], label: string, value: unknown, displayType?: unknown) {
  const cleanLabel = String(label || "Trait").trim();
  if (!cleanLabel || !usableValue(value)) return;
  const key = `${cleanLabel.toLowerCase()}::${String(value).trim().toLowerCase()}`;
  if (out.some((trait) => `${trait.trait_type.toLowerCase()}::${String(trait.value).trim().toLowerCase()}` === key)) return;
  out.push({
    trait_type: cleanLabel,
    value,
    ...(typeof displayType === "string" && displayType.trim() ? { display_type: displayType.trim() } : {}),
  });
}

function collectContainer(out: NormalizedLoreTrait[], container: unknown) {
  if (Array.isArray(container)) {
    container.forEach((item, index) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        pushTrait(out, labelFrom(item, `Trait ${index + 1}`), valueFrom(item), (item as any).display_type ?? (item as any).displayType);
      } else {
        pushTrait(out, `Trait ${index + 1}`, item);
      }
    });
    return;
  }

  if (container && typeof container === "object") {
    Object.entries(container as Record<string, unknown>).forEach(([key, raw]) => {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const item = raw as any;
        pushTrait(out, labelFrom(item, key), valueFrom(item), item.display_type ?? item.displayType);
      } else {
        pushTrait(out, key, raw);
      }
    });
  }
}

/**
 * Accept the common ERC-721/OpenSea `attributes` shape, plus several alternate
 * metadata layouts used by generators and older NFT tooling. This keeps the UI
 * schema-agnostic without inventing trait names.
 */
export function extractLoreTraits(metadata: any): NormalizedLoreTrait[] {
  if (!metadata || typeof metadata !== "object") return [];
  const out: NormalizedLoreTrait[] = [];

  collectContainer(out, metadata.attributes);
  collectContainer(out, metadata.traits);
  collectContainer(out, metadata.features);
  collectContainer(out, metadata.properties?.attributes);
  collectContainer(out, metadata.properties?.traits);
  collectContainer(out, metadata.properties?.features);

  // Some generators store traits directly as scalar properties rather than an
  // attributes array. Only consume non-reserved scalar/value-wrapper entries.
  if (metadata.properties && typeof metadata.properties === "object" && !Array.isArray(metadata.properties)) {
    for (const [key, raw] of Object.entries(metadata.properties as Record<string, unknown>)) {
      if (RESERVED_PROPERTY_KEYS.has(key.toLowerCase())) continue;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const item = raw as any;
        if ("value" in item || "trait_value" in item || "traitValue" in item) {
          pushTrait(out, labelFrom(item, key), valueFrom(item), item.display_type ?? item.displayType);
        }
      } else {
        pushTrait(out, key, raw);
      }
    }
  }

  return out;
}

export function metadataHasLoreTraits(metadata: any) {
  return extractLoreTraits(metadata).length > 0;
}

function baseDirectory(uri: string) {
  const clean = uri.split("#")[0].split("?")[0];
  const slash = clean.lastIndexOf("/");
  return slash >= 0 ? clean.slice(0, slash + 1) : `${clean}/`;
}

/** Resolve relative artwork references against the metadata document itself. */
export function resolveMetadataAssetUri(asset: unknown, metadataUri?: string | null, tokenUri?: string | null) {
  if (typeof asset !== "string") return null;
  const value = asset.trim();
  if (!value) return null;
  if (/^(data:|https?:\/\/|ipfs:\/\/|ar:\/\/)/i.test(value)) return value;

  if (metadataUri && /^https?:\/\//i.test(metadataUri)) {
    try { return new URL(value, metadataUri).toString(); } catch {}
  }

  if (tokenUri?.startsWith("ipfs://")) {
    const base = baseDirectory(tokenUri);
    return `${base}${value.replace(/^\.\//, "")}`;
  }

  return value;
}

export function normalizeLoreMetadata(raw: any, metadataUri?: string | null, tokenUri?: string | null) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const metadata = { ...raw } as any;
  const traits = extractLoreTraits(raw);
  if (traits.length) metadata.attributes = traits;

  const image = raw.image ?? raw.image_url ?? raw.imageUrl;
  const resolvedImage = resolveMetadataAssetUri(image, metadataUri, tokenUri);
  if (resolvedImage) metadata.image = resolvedImage;

  const animation = resolveMetadataAssetUri(raw.animation_url, metadataUri, tokenUri);
  if (animation) metadata.animation_url = animation;

  return metadata;
}
