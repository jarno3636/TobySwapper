import "server-only";

import { LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";
import { hasSupabaseServerEnv, supabaseRpc } from "@/lib/supabase/rest";

export const LORE_ART_BUCKET = "tobyswap-lore-art";

function supabaseBaseUrl() {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
}

function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

function extensionFor(contentType: string) {
  const type = contentType.toLowerCase().split(";")[0].trim();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/svg+xml") return "svg";
  return "png";
}

function publicObjectUrl(path: string) {
  return `${supabaseBaseUrl()}/storage/v1/object/public/${LORE_ART_BUCKET}/${path}`;
}

export async function setLoreArtCacheStatus(input: {
  tokenId: bigint | string;
  status: "pending" | "cached" | "failed" | "skipped";
  cachedImageUrl?: string | null;
  storagePath?: string | null;
  contentType?: string | null;
  imageBytes?: number | null;
  error?: string | null;
}) {
  if (!hasSupabaseServerEnv()) return false;
  try {
    await supabaseRpc("tobyswap_set_lore_art_cache", {
      p_collection_address: LORE_COLLECTION_ADDRESS.toLowerCase(),
      p_token_id: String(input.tokenId),
      p_cached_image_url: input.cachedImageUrl || null,
      p_storage_path: input.storagePath || null,
      p_content_type: input.contentType || null,
      p_image_bytes: input.imageBytes ?? null,
      p_status: input.status,
      p_error: input.error || null,
    });
    return true;
  } catch (error) {
    console.warn("Lore art cache status update failed", error);
    return false;
  }
}

export async function cacheLoreArtwork(input: {
  tokenId: bigint | string;
  bytes: ArrayBuffer | Uint8Array | Buffer;
  contentType: string;
}) {
  if (!hasSupabaseServerEnv()) return null;
  const baseUrl = supabaseBaseUrl();
  const key = serviceKey();
  if (!baseUrl || !key) return null;

  const byteLength = input.bytes instanceof ArrayBuffer
    ? input.bytes.byteLength
    : input.bytes.byteLength;
  if (byteLength <= 0 || byteLength > 12 * 1024 * 1024) {
    await setLoreArtCacheStatus({
      tokenId: input.tokenId,
      status: "skipped",
      error: `Artwork size ${byteLength} is outside cache limits.`,
    });
    return null;
  }

  const contentType = (input.contentType || "image/png").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) return null;

  const token = String(input.tokenId);
  const path = `canonical/${token}.${extensionFor(contentType)}`;

  try {
    const response = await fetch(`${baseUrl}/storage/v1/object/${LORE_ART_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: input.bytes as BodyInit,
      cache: "no-store",
    });

    if (!response.ok) {
      const message = (await response.text()).slice(0, 300);
      await setLoreArtCacheStatus({ tokenId: token, status: "failed", error: `Storage ${response.status}: ${message}` });
      return null;
    }

    const url = publicObjectUrl(path);
    await setLoreArtCacheStatus({
      tokenId: token,
      status: "cached",
      cachedImageUrl: url,
      storagePath: path,
      contentType,
      imageBytes: byteLength,
    });
    return url;
  } catch (error: any) {
    await setLoreArtCacheStatus({
      tokenId: token,
      status: "failed",
      error: String(error?.message || "Storage upload failed").slice(0, 300),
    });
    return null;
  }
}
