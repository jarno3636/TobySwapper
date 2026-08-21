#!/usr/bin/env node

import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";

const COLLECTION = "0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A";
const BUCKET = process.env.LORE_ART_BUCKET || "tobyswap-lore-art";

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

const RPCS = [
  process.env.BASE_RPC_URL,
  process.env.NEXT_PUBLIC_BASE_RPC_URL,
  "https://mainnet.base.org",
].filter(Boolean);

const IPFS_GATEWAYS = (
  process.env.IPFS_GATEWAYS ||
  [
    "https://ipfs.io/ipfs/",
    "https://dweb.link/ipfs/",
    "https://w3s.link/ipfs/",
    "https://nftstorage.link/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
  ].join(",")
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => (value.endsWith("/") ? value : `${value}/`));

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY.",
  );
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

function numericArg(value, fallback) {
  if (value == null || value === "") return fallback;

  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : fallback;
}

const FROM = Math.max(1, numericArg(args.from, 1));
const TO = Math.min(4000, numericArg(args.to, 4000));

const CONCURRENCY = Math.max(
  1,
  Math.min(6, numericArg(args.concurrency, 3)),
);

const FORCE = args.force === "true";
const METADATA_ONLY = args["metadata-only"] === "true";

const MAX_IMAGE_BYTES =
  Math.max(1, numericArg(args["max-image-mb"], 12)) * 1024 * 1024;

const META_TIMEOUT = Math.max(
  2500,
  numericArg(args["metadata-timeout-ms"], 6500),
);

const IMAGE_TIMEOUT = Math.max(
  3000,
  numericArg(args["image-timeout-ms"], 15000),
);

const IMAGE_RACE_WIDTH = Math.max(
  1,
  Math.min(3, numericArg(args["image-race-width"], 2)),
);

const RETRY_FAILED_ART = args["retry-art"] !== "false";

if (TO < FROM) {
  console.error(`Invalid token range: ${FROM}-${TO}`);
  process.exit(1);
}

const abi = [
  {
    type: "function",
    name: "revealed",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "string" }],
  },
];

const client = createPublicClient({
  chain: base,
  transport: fallback(
    RPCS.map((url) =>
      http(url, {
        timeout: 8_000,
        retryCount: 2,
        retryDelay: 350,
      }),
    ),
  ),
});

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const scalar = (value) =>
  value == null ||
  ["string", "number", "boolean"].includes(typeof value);

const asText = (value) =>
  value == null
    ? null
    : typeof value === "string"
      ? value
      : scalar(value)
        ? String(value)
        : JSON.stringify(value);

function extractTraits(metadata) {
  const sources = [
    metadata?.attributes,
    metadata?.traits,
    metadata?.features,
    metadata?.properties?.attributes,
    metadata?.properties?.traits,
  ];

  let raw = sources.find(Array.isArray);

  if (
    !raw &&
    metadata?.properties &&
    typeof metadata.properties === "object" &&
    !Array.isArray(metadata.properties)
  ) {
    raw = Object.entries(metadata.properties)
      .filter(
        ([key, value]) =>
          ![
            "name",
            "description",
            "image",
            "image_url",
            "animation_url",
            "external_url",
            "attributes",
            "traits",
          ].includes(key) && scalar(value),
      )
      .map(([key, value]) => ({
        trait_type: key,
        value,
      }));
  }

  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (
        item &&
        typeof item === "object" &&
        !Array.isArray(item)
      ) {
        const traitType =
          item.trait_type ??
          item.traitType ??
          item.type ??
          item.name ??
          `Trait ${index + 1}`;

        const value =
          item.value ??
          item.trait_value ??
          item.traitValue ??
          item.val ??
          null;

        return {
          index,
          trait_type: String(traitType),
          value,
          value_text: asText(value),
          display_type:
            item.display_type ??
            item.displayType ??
            null,
        };
      }

      return {
        index,
        trait_type: `Trait ${index + 1}`,
        value: item,
        value_text: asText(item),
        display_type: null,
      };
    })
    .filter((item) => item.trait_type.trim());
}

function uriCandidates(value) {
  const uri = String(value || "").trim();

  if (!uri) return [];

  if (
    /^https?:\/\//i.test(uri) ||
    uri.startsWith("data:")
  ) {
    return [uri];
  }

  if (uri.startsWith("ar://")) {
    return [`https://arweave.net/${uri.slice(5)}`];
  }

  const path = uri.startsWith("ipfs://ipfs/")
    ? uri.slice(12)
    : uri.startsWith("ipfs://")
      ? uri.slice(7)
      : null;

  if (!path) return [uri];

  return IPFS_GATEWAYS.map(
    (gateway) => `${gateway}${path}`,
  );
}

function resolveRelative(value, metadataUri) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const v = value.trim();

  if (/^(ipfs|ar|data|https?):\/\//i.test(v)) {
    return v;
  }

  if (/^https?:\/\//i.test(metadataUri || "")) {
    try {
      return new URL(v, metadataUri).toString();
    } catch {}
  }

  return v;
}

async function fetchWithTimeout(
  url,
  init = {},
  ms = 6500,
) {
  const controller = new AbortController();

  const timer = setTimeout(
    () =>
      controller.abort(
        new Error(`timeout after ${ms}ms`),
      ),
    ms,
  );

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------
   METADATA
------------------------------------------------------- */

async function fetchMetadata(
  tokenUri,
  tokenId = 0,
  attempt = 0,
) {
  if (
    tokenUri.startsWith(
      "data:application/json",
    )
  ) {
    const comma = tokenUri.indexOf(",");
    const header = tokenUri.slice(0, comma);
    const raw = tokenUri.slice(comma + 1);

    const text = /;base64/i.test(header)
      ? Buffer.from(raw, "base64").toString(
          "utf8",
        )
      : decodeURIComponent(raw);

    return {
      metadata: JSON.parse(text),
      metadataUri: tokenUri,
    };
  }

  let last = "metadata unavailable";

  const candidates = uriCandidates(tokenUri);

  const offset = candidates.length
    ? (Number(tokenId || 0) + attempt) %
      candidates.length
    : 0;

  const ordered = candidates.length
    ? [
        ...candidates.slice(offset),
        ...candidates.slice(0, offset),
      ]
    : candidates;

  for (const url of ordered) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            accept:
              "application/json,*/*;q=0.5",
          },
          cache: "no-store",
        },
        META_TIMEOUT,
      );

      if (!response.ok) {
        last = `${response.status} ${url}`;
        continue;
      }

      const parsed = JSON.parse(
        await response.text(),
      );

      if (
        parsed &&
        typeof parsed === "object"
      ) {
        return {
          metadata: parsed,
          metadataUri: url,
        };
      }

      last = `invalid JSON object ${url}`;
    } catch (error) {
      last = `${
        error?.name || "Error"
      }: ${String(
        error?.message || error,
      )} @ ${url}`;
    }
  }

  throw new Error(last);
}

/* -------------------------------------------------------
   SUPABASE
------------------------------------------------------- */

async function rest(path, init = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...init,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Supabase ${
        response.status
      }: ${(await response.text()).slice(
        0,
        300,
      )}`,
    );
  }

  const text = await response.text();

  return text ? JSON.parse(text) : null;
}

async function cachedRecord(tokenId) {
  if (FORCE) return null;

  const q = new URLSearchParams({
    collection_address: `eq.${COLLECTION.toLowerCase()}`,
    token_id: `eq.${tokenId}`,
    select:
      "token_id,token_uri,metadata_uri,image_uri,trait_count,art_cache_status,cached_image_url",
    limit: "1",
  });

  const rows = await rest(
    `tobyswap_lore_tokens?${q}`,
  );

  return rows?.[0] || null;
}

async function rpc(name, body) {
  return rest(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function markArtFailure(
  tokenId,
  message,
) {
  await rpc("tobyswap_set_lore_art_cache", {
    p_collection_address:
      COLLECTION.toLowerCase(),
    p_token_id: tokenId,
    p_cached_image_url: null,
    p_storage_path: null,
    p_content_type: null,
    p_image_bytes: null,
    p_status: "failed",
    p_error: String(message).slice(0, 500),
  }).catch(() => {});
}

/* -------------------------------------------------------
   ARTWORK — PARALLEL GATEWAY RACING
------------------------------------------------------- */

function contentTypeToExt(contentType) {
  if (contentType === "image/jpeg") {
    return "jpg";
  }

  if (contentType === "image/webp") {
    return "webp";
  }

  if (contentType === "image/gif") {
    return "gif";
  }

  if (contentType === "image/svg+xml") {
    return "svg";
  }

  return "png";
}

async function fetchImageCandidate(
  url,
  externalSignal,
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort(
      new Error(
        `timeout after ${IMAGE_TIMEOUT}ms`,
      ),
    );
  }, IMAGE_TIMEOUT);

  const abortFromParent = () => {
    controller.abort(
      new Error(
        "cancelled after another gateway succeeded",
      ),
    );
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromParent();
    } else {
      externalSignal.addEventListener(
        "abort",
        abortFromParent,
        { once: true },
      );
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        accept: "image/*,*/*;q=0.5",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `${response.status} ${url}`,
      );
    }

    const contentType = (
      response.headers.get("content-type") ||
      ""
    )
      .split(";")[0]
      .toLowerCase();

    if (!contentType.startsWith("image/")) {
      throw new Error(
        `not image: ${
          contentType || "unknown"
        } @ ${url}`,
      );
    }

    const contentLength = Number(
      response.headers.get(
        "content-length",
      ) || 0,
    );

    if (
      contentLength &&
      contentLength > MAX_IMAGE_BYTES
    ) {
      throw new Error(
        `image is ${(
          contentLength /
          1024 /
          1024
        ).toFixed(2)} MB; over cap`,
      );
    }

    const bytes = Buffer.from(
      await response.arrayBuffer(),
    );

    if (!bytes.length) {
      throw new Error(
        `empty image @ ${url}`,
      );
    }

    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(
        `image is ${(
          bytes.length /
          1024 /
          1024
        ).toFixed(2)} MB; over cap`,
      );
    }

    return {
      bytes,
      contentType,
      url,
    };
  } finally {
    clearTimeout(timeout);

    if (externalSignal) {
      externalSignal.removeEventListener(
        "abort",
        abortFromParent,
      );
    }
  }
}

async function raceImageCandidates(
  candidates,
) {
  let lastError = new Error(
    "image unavailable",
  );

  /*
   * Race a SMALL GROUP of gateways.
   *
   * With width=2:
   *
   * gateway A ─┐
   *            ├── first success wins
   * gateway B ─┘
   *
   * If both fail, move to the next pair.
   *
   * This avoids hammering all gateways while
   * eliminating the huge serial timeout problem.
   */

  for (
    let i = 0;
    i < candidates.length;
    i += IMAGE_RACE_WIDTH
  ) {
    const batch = candidates.slice(
      i,
      i + IMAGE_RACE_WIDTH,
    );

    const groupController =
      new AbortController();

    try {
      const winner = await Promise.any(
        batch.map((url) =>
          fetchImageCandidate(
            url,
            groupController.signal,
          ).catch((error) => {
            lastError = error;
            throw error;
          }),
        ),
      );

      /*
       * We have the full valid image.
       * Kill the losing gateway request.
       */
      groupController.abort();

      return winner;
    } catch (error) {
      groupController.abort();

      if (error?.errors?.length) {
        lastError =
          error.errors[
            error.errors.length - 1
          ];
      } else {
        lastError = error;
      }
    }
  }

  throw lastError;
}

async function uploadArt(
  tokenId,
  imageValue,
  metadataUri,
  tokenUri,
  attempt = 0,
) {
  const resolved = resolveRelative(
    imageValue,
    metadataUri || tokenUri,
  );

  if (!resolved) {
    throw new Error(
      "No image URI in metadata",
    );
  }

  const candidates =
    uriCandidates(resolved);

  if (!candidates.length) {
    throw new Error(
      "No usable image URI",
    );
  }

  /*
   * Rotate starting position by token ID.
   * This spreads requests across gateways.
   */
  const offset =
    (Number(tokenId || 0) + attempt) %
    candidates.length;

  const ordered = [
    ...candidates.slice(offset),
    ...candidates.slice(0, offset),
  ];

  let fetched;

  try {
    fetched =
      await raceImageCandidates(ordered);
  } catch (error) {
    const message = `${
      error?.name || "Error"
    }: ${String(
      error?.message || error,
    )}`;

    await markArtFailure(
      tokenId,
      message,
    );

    throw new Error(message);
  }

  const { bytes, contentType } = fetched;

  const ext =
    contentTypeToExt(contentType);

  const path = `canonical/${tokenId}.${ext}`;

  try {
    const upload = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: "POST",

        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": contentType,
          "x-upsert": "true",
          "Cache-Control":
            "public, max-age=31536000, immutable",
        },

        body: bytes,
      },
    );

    if (!upload.ok) {
      throw new Error(
        `storage ${
          upload.status
        }: ${(await upload.text()).slice(
          0,
          200,
        )}`,
      );
    }

    const publicUrl =
      `${SUPABASE_URL}` +
      `/storage/v1/object/public/` +
      `${BUCKET}/${path}`;

    await rpc(
      "tobyswap_set_lore_art_cache",
      {
        p_collection_address:
          COLLECTION.toLowerCase(),

        p_token_id: tokenId,

        p_cached_image_url:
          publicUrl,

        p_storage_path: path,

        p_content_type:
          contentType,

        p_image_bytes:
          bytes.length,

        p_status: "cached",

        p_error: null,
      },
    );

    return publicUrl;
  } catch (error) {
    const message = `${
      error?.name || "Error"
    }: ${String(
      error?.message || error,
    )}`;

    await markArtFailure(
      tokenId,
      message,
    );

    throw error;
  }
}

/* -------------------------------------------------------
   VERIFY REVEAL
------------------------------------------------------- */

const revealed =
  await client.readContract({
    address: COLLECTION,
    abi,
    functionName: "revealed",
  });

if (!revealed) {
  console.error(
    "Canonical collection is not revealed. Backfill stopped.",
  );

  process.exit(1);
}

/* -------------------------------------------------------
   QUEUES + STATS
------------------------------------------------------- */

const queue = Array.from(
  {
    length: TO - FROM + 1,
  },
  (_, i) => FROM + i,
);

const artRetryQueue = [];

const stats = {
  metadataCached: 0,
  artCached: 0,
  skipped: 0,
  metadataFailed: 0,
  artFailed: 0,
};

const total = queue.length;

console.log(
  `Backfilling ${total} Lore deeds (${FROM}-${TO})`,
);

console.log(
  `Workers=${CONCURRENCY} · artwork=${!METADATA_ONLY}`,
);

console.log(
  `Timeouts: metadata=${META_TIMEOUT}ms · image=${IMAGE_TIMEOUT}ms · image-race=${IMAGE_RACE_WIDTH}`,
);

console.log(
  `IPFS gateways (${IPFS_GATEWAYS.length}): ${IPFS_GATEWAYS.join(
    " | ",
  )}`,
);

function progress() {
  const processed =
    stats.metadataCached +
    stats.skipped +
    stats.metadataFailed;

  if (
    processed % 25 === 0 ||
    processed === total
  ) {
    console.log(
      `progress ${processed}/${total}` +
        ` · metadata ${stats.metadataCached}` +
        ` · art ${stats.artCached}` +
        ` · skipped ${stats.skipped}` +
        ` · metadata-failed ${stats.metadataFailed}` +
        ` · art-pending ${stats.artFailed}`,
    );
  }
}

/* -------------------------------------------------------
   TOKEN PROCESSING
------------------------------------------------------- */

async function processToken(tokenId) {
  const existing =
    await cachedRecord(tokenId);

  const metadataReady = Boolean(
    existing &&
      Number(
        existing.trait_count || 0,
      ) > 0 &&
      existing.image_uri,
  );

  const artReady = Boolean(
    existing &&
      existing.art_cache_status ===
        "cached" &&
      existing.cached_image_url,
  );

  /*
   * BEST CASE:
   * Everything is already cached.
   */
  if (
    metadataReady &&
    (METADATA_ONLY || artReady)
  ) {
    stats.skipped++;
    progress();
    return;
  }

  /*
   * Metadata exists.
   * Artwork does NOT.
   *
   * Do not hit contract.
   * Do not retrieve metadata.
   * ONLY retrieve artwork.
   */
  if (
    metadataReady &&
    !METADATA_ONLY &&
    !artReady
  ) {
    try {
      await uploadArt(
        tokenId,
        existing.image_uri,
        existing.metadata_uri,
        existing.token_uri,
      );

      stats.artCached++;
    } catch (error) {
      stats.artFailed++;

      artRetryQueue.push({
        tokenId,
        image: existing.image_uri,
        metadataUri:
          existing.metadata_uri,
        tokenUri:
          existing.token_uri,
      });

      console.warn(
        `#${tokenId} ART pending: ${String(
          error?.message || error,
        ).slice(0, 180)}`,
      );
    }

    /*
     * This token's metadata was already
     * complete before this run.
     */
    stats.metadataCached++;

    progress();
    return;
  }

  /*
   * Brand new / incomplete metadata.
   */
  let tokenUri;
  let metadata;
  let metadataUri;
  let image;

  try {
    tokenUri =
      await client.readContract({
        address: COLLECTION,
        abi,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      });

    ({
      metadata,
      metadataUri,
    } = await fetchMetadata(
      String(tokenUri),
      tokenId,
    ));

    const traits =
      extractTraits(metadata);

    image =
      metadata?.image ??
      metadata?.image_url ??
      metadata?.imageUrl ??
      null;

    await rpc(
      "tobyswap_upsert_lore_metadata",
      {
        p_collection_address:
          COLLECTION.toLowerCase(),

        p_chain_id: 8453,

        p_token_id: tokenId,

        p_token_uri:
          String(tokenUri),

        p_metadata_uri:
          metadataUri,

        p_name:
          asText(metadata?.name),

        p_description:
          asText(
            metadata?.description,
          ),

        p_image_uri:
          asText(image),

        p_animation_uri:
          asText(
            metadata?.animation_url,
          ),

        p_external_url:
          asText(
            metadata?.external_url,
          ),

        p_metadata:
          metadata,

        p_metadata_hash:
          null,

        p_revealed:
          true,

        p_source:
          "backfill-v3-race",

        p_traits:
          traits,
      },
    );

    stats.metadataCached++;
  } catch (error) {
    stats.metadataFailed++;

    console.error(
      `#${tokenId} METADATA failed: ${String(
        error?.message || error,
      ).slice(0, 260)}`,
    );

    progress();

    await sleep(100);

    return;
  }

  /*
   * Metadata is safely stored.
   * Artwork failure cannot undo it.
   */
  if (!METADATA_ONLY) {
    try {
      await uploadArt(
        tokenId,
        image,
        metadataUri,
        String(tokenUri),
      );

      stats.artCached++;
    } catch (error) {
      stats.artFailed++;

      artRetryQueue.push({
        tokenId,
        image,
        metadataUri,
        tokenUri:
          String(tokenUri),
      });

      console.warn(
        `#${tokenId} ART pending; metadata + traits saved: ${String(
          error?.message || error,
        ).slice(0, 180)}`,
      );
    }
  }

  progress();
}

/* -------------------------------------------------------
   MAIN WORKERS
------------------------------------------------------- */

async function worker() {
  while (queue.length) {
    const tokenId =
      queue.shift();

    if (!tokenId) return;

    await processToken(tokenId);
  }
}

await Promise.all(
  Array.from(
    {
      length: CONCURRENCY,
    },
    () => worker(),
  ),
);

/* -------------------------------------------------------
   ART-ONLY RETRY PASS
------------------------------------------------------- */

if (
  !METADATA_ONLY &&
  RETRY_FAILED_ART &&
  artRetryQueue.length
) {
  const retryItems = [
    ...artRetryQueue,
  ];

  artRetryQueue.length = 0;

  /*
   * Retry art slightly more conservatively.
   * Metadata is NOT touched.
   */
  const RETRY_WORKERS = Math.min(
    3,
    Math.max(1, CONCURRENCY),
  );

  console.log(
    `ART repair pass: ${retryItems.length} item(s) · workers=${RETRY_WORKERS}`,
  );

  let cursor = 0;

  const retryWorker = async () => {
    while (
      cursor < retryItems.length
    ) {
      const item =
        retryItems[cursor++];

      /*
       * Tiny stagger prevents all retry
       * workers from firing simultaneously.
       */
      await sleep(200);

      try {
        await uploadArt(
          item.tokenId,
          item.image,
          item.metadataUri,
          item.tokenUri,
          1,
        );

        stats.artCached++;

        stats.artFailed =
          Math.max(
            0,
            stats.artFailed - 1,
          );

        console.log(
          `#${item.tokenId} ART repaired`,
        );
      } catch (error) {
        console.warn(
          `#${item.tokenId} ART still pending: ${String(
            error?.message || error,
          ).slice(0, 180)}`,
        );
      }
    }
  };

  await Promise.all(
    Array.from(
      {
        length: RETRY_WORKERS,
      },
      () => retryWorker(),
    ),
  );
}

/* -------------------------------------------------------
   FINAL SUMMARY
------------------------------------------------------- */

console.log("");
console.log("──────── BACKFILL COMPLETE ────────");

console.log(
  `Metadata handled: ${stats.metadataCached}`,
);

console.log(
  `Artwork cached/repaired: ${stats.artCached}`,
);

console.log(
  `Fully skipped: ${stats.skipped}`,
);

console.log(
  `Metadata failures: ${stats.metadataFailed}`,
);

console.log(
  `Artwork still pending: ${stats.artFailed}`,
);

console.log("───────────────────────────────────");

/*
 * Artwork failure does NOT fail the Action.
 * We can safely repair it later.
 *
 * Metadata failure DOES matter.
 */
if (stats.metadataFailed) {
  process.exitCode = 2;
}
