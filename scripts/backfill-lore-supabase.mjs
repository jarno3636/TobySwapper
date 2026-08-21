#!/usr/bin/env node
import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";

const COLLECTION = "0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A";
const BUCKET = process.env.LORE_ART_BUCKET || "tobyswap-lore-art";
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const RPCS = [process.env.BASE_RPC_URL, process.env.NEXT_PUBLIC_BASE_RPC_URL, "https://mainnet.base.org"].filter(Boolean);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));
const FROM = Math.max(1, Number(args.from || 1));
const TO = Math.min(4000, Number(args.to || 4000));
const CONCURRENCY = Math.max(1, Math.min(8, Number(args.concurrency || 3)));
const FORCE = args.force === "true";
const METADATA_ONLY = args["metadata-only"] === "true";
const MAX_IMAGE_BYTES = Math.max(1, Number(args["max-image-mb"] || 12)) * 1024 * 1024;

const abi = [
  { type: "function", name: "revealed", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "string" }] },
];

const client = createPublicClient({
  chain: base,
  transport: fallback(RPCS.map((url) => http(url, { timeout: 10_000, retryCount: 2, retryDelay: 300 }))),
});

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function scalar(value) {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}
function asText(value) {
  if (value == null) return null;
  return typeof value === "string" ? value : scalar(value) ? String(value) : JSON.stringify(value);
}
function extractTraits(metadata) {
  const sources = [metadata?.attributes, metadata?.traits, metadata?.features, metadata?.properties?.attributes, metadata?.properties?.traits];
  let raw = sources.find(Array.isArray);
  if (!raw && metadata?.properties && typeof metadata.properties === "object" && !Array.isArray(metadata.properties)) {
    raw = Object.entries(metadata.properties)
      .filter(([key, value]) => !["name","description","image","image_url","animation_url","external_url","attributes","traits"].includes(key) && scalar(value))
      .map(([key, value]) => ({ trait_type: key, value }));
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const traitType = item.trait_type ?? item.traitType ?? item.type ?? item.name ?? `Trait ${index + 1}`;
      const value = item.value ?? item.trait_value ?? item.traitValue ?? item.val ?? null;
      return { index, trait_type: String(traitType), value, value_text: asText(value), display_type: item.display_type ?? item.displayType ?? null };
    }
    return { index, trait_type: `Trait ${index + 1}`, value: item, value_text: asText(item), display_type: null };
  }).filter((x) => x.trait_type.trim());
}
function uriCandidates(value) {
  const uri = String(value || "").trim();
  if (!uri) return [];
  if (/^https?:\/\//i.test(uri) || uri.startsWith("data:")) return [uri];
  if (uri.startsWith("ar://")) return [`https://arweave.net/${uri.slice(5)}`];
  const path = uri.startsWith("ipfs://ipfs/") ? uri.slice(12) : uri.startsWith("ipfs://") ? uri.slice(7) : null;
  if (!path) return [uri];
  return [`https://dweb.link/ipfs/${path}`, `https://ipfs.io/ipfs/${path}`, `https://gateway.pinata.cloud/ipfs/${path}`];
}
function resolveRelative(value, metadataUri) {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  if (/^(ipfs|ar|data|https?):\/\//i.test(v)) return v;
  if (/^https?:\/\//i.test(metadataUri || "")) {
    try { return new URL(v, metadataUri).toString(); } catch {}
  }
  return v;
}
async function fetchWithTimeout(url, init = {}, ms = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
async function fetchMetadata(tokenUri) {
  if (tokenUri.startsWith("data:application/json")) {
    const comma = tokenUri.indexOf(",");
    const header = tokenUri.slice(0, comma);
    const raw = tokenUri.slice(comma + 1);
    const text = /;base64/i.test(header) ? Buffer.from(raw, "base64").toString("utf8") : decodeURIComponent(raw);
    return { metadata: JSON.parse(text), metadataUri: tokenUri };
  }
  let last = "metadata unavailable";
  for (const url of uriCandidates(tokenUri)) {
    try {
      const response = await fetchWithTimeout(url, { headers: { accept: "application/json,*/*;q=0.5" }, cache: "no-store" });
      if (!response.ok) { last = `${response.status} ${url}`; continue; }
      const parsed = JSON.parse(await response.text());
      if (parsed && typeof parsed === "object") return { metadata: parsed, metadataUri: url };
    } catch (error) { last = String(error?.message || error); }
  }
  throw new Error(last);
}
async function rest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
async function alreadyCached(tokenId) {
  if (FORCE) return false;
  const q = new URLSearchParams({ collection_address: `eq.${COLLECTION.toLowerCase()}`, token_id: `eq.${tokenId}`, select: "token_id,trait_count,art_cache_status,cached_image_url", limit: "1" });
  const rows = await rest(`tobyswap_lore_tokens?${q}`);
  const row = rows?.[0];
  return Boolean(row && Number(row.trait_count || 0) > 0 && (METADATA_ONLY || (row.art_cache_status === "cached" && row.cached_image_url)));
}
async function rpc(name, body) {
  return rest(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
}
async function uploadArt(tokenId, imageValue, metadataUri, tokenUri) {
  const resolved = resolveRelative(imageValue, metadataUri || tokenUri);
  if (!resolved) throw new Error("No image URI in metadata");
  let last = "image unavailable";
  for (const url of uriCandidates(resolved)) {
    try {
      const response = await fetchWithTimeout(url, { headers: { accept: "image/*,*/*;q=0.5" }, cache: "no-store" }, 20_000);
      if (!response.ok) { last = `${response.status} ${url}`; continue; }
      const contentType = (response.headers.get("content-type") || "image/png").split(";")[0].toLowerCase();
      if (!contentType.startsWith("image/")) { last = `not image: ${contentType}`; continue; }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`image is ${(bytes.length / 1024 / 1024).toFixed(2)} MB; over cap`);
      const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : contentType === "image/gif" ? "gif" : contentType === "image/svg+xml" ? "svg" : "png";
      const path = `canonical/${tokenId}.${ext}`;
      const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "public, max-age=31536000, immutable" },
        body: bytes,
      });
      if (!upload.ok) throw new Error(`storage ${upload.status}: ${(await upload.text()).slice(0, 200)}`);
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      await rpc("tobyswap_set_lore_art_cache", {
        p_collection_address: COLLECTION.toLowerCase(), p_token_id: tokenId, p_cached_image_url: publicUrl,
        p_storage_path: path, p_content_type: contentType, p_image_bytes: bytes.length, p_status: "cached", p_error: null,
      });
      return publicUrl;
    } catch (error) { last = String(error?.message || error); }
  }
  await rpc("tobyswap_set_lore_art_cache", {
    p_collection_address: COLLECTION.toLowerCase(), p_token_id: tokenId, p_cached_image_url: null,
    p_storage_path: null, p_content_type: null, p_image_bytes: null, p_status: "failed", p_error: last.slice(0, 500),
  }).catch(() => {});
  throw new Error(last);
}

const revealed = await client.readContract({ address: COLLECTION, abi, functionName: "revealed" });
if (!revealed) {
  console.error("Canonical collection is not revealed. Backfill stopped.");
  process.exit(1);
}

let done = 0, skipped = 0, failed = 0;
const queue = Array.from({ length: TO - FROM + 1 }, (_, i) => FROM + i);
console.log(`Backfilling ${queue.length} Lore deeds (${FROM}-${TO}), concurrency=${CONCURRENCY}, art=${!METADATA_ONLY}`);

async function worker(workerId) {
  while (queue.length) {
    const tokenId = queue.shift();
    if (!tokenId) return;
    try {
      if (await alreadyCached(tokenId)) { skipped++; continue; }
      const tokenUri = await client.readContract({ address: COLLECTION, abi, functionName: "tokenURI", args: [BigInt(tokenId)] });
      const { metadata, metadataUri } = await fetchMetadata(String(tokenUri));
      const traits = extractTraits(metadata);
      const image = metadata?.image ?? metadata?.image_url ?? metadata?.imageUrl ?? null;
      await rpc("tobyswap_upsert_lore_metadata", {
        p_collection_address: COLLECTION.toLowerCase(), p_chain_id: 8453, p_token_id: tokenId,
        p_token_uri: String(tokenUri), p_metadata_uri: metadataUri, p_name: asText(metadata?.name),
        p_description: asText(metadata?.description), p_image_uri: asText(image), p_animation_uri: asText(metadata?.animation_url),
        p_external_url: asText(metadata?.external_url), p_metadata: metadata, p_metadata_hash: null,
        p_revealed: true, p_source: "backfill", p_traits: traits,
      });
      if (!METADATA_ONLY) await uploadArt(tokenId, image, metadataUri, String(tokenUri));
      done++;
      if ((done + skipped + failed) % 25 === 0) console.log(`progress ${done + skipped + failed}/${TO - FROM + 1} · cached ${done} · skipped ${skipped} · failed ${failed}`);
    } catch (error) {
      failed++;
      console.error(`#${tokenId} failed: ${String(error?.message || error).slice(0, 220)}`);
      await sleep(250);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
console.log(`Done. cached=${done}, skipped=${skipped}, failed=${failed}`);
if (failed) process.exitCode = 2;
