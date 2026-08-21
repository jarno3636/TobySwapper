#!/usr/bin/env node

import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";

/* =========================================================
   CONFIG
========================================================= */

const COLLECTION =
  "0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A";

const BUCKET =
  process.env.LORE_ART_BUCKET ||
  "tobyswap-lore-art";

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
  .map((v) => v.trim())
  .filter(Boolean)
  .map((v) =>
    v.endsWith("/") ? v : `${v}/`,
  );

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing Supabase URL or server key.",
  );
  process.exit(1);
}

/* =========================================================
   CLI ARGS
========================================================= */

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg) => {
      const [key, value = "true"] = arg
        .replace(/^--/, "")
        .split("=");

      return [key, value];
    }),
);

function numericArg(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number(
    String(value)
      .replace(/,/g, "")
      .trim(),
  );

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

const FROM = Math.max(
  1,
  numericArg(args.from, 1),
);

const TO = Math.min(
  4000,
  numericArg(args.to, 4000),
);

const CONCURRENCY = Math.max(
  1,
  Math.min(
    6,
    numericArg(args.concurrency, 3),
  ),
);

const FORCE =
  args.force === "true";

const METADATA_ONLY =
  args["metadata-only"] === "true";

const RETRY_FAILED_ART =
  args["retry-art"] !== "false";

const MAX_IMAGE_BYTES =
  Math.max(
    1,
    numericArg(
      args["max-image-mb"],
      12,
    ),
  ) *
  1024 *
  1024;

const META_TIMEOUT = Math.max(
  2500,
  numericArg(
    args["metadata-timeout-ms"],
    6500,
  ),
);

const IMAGE_TIMEOUT = Math.max(
  3000,
  numericArg(
    args["image-timeout-ms"],
    15000,
  ),
);

const IMAGE_RACE_WIDTH = Math.max(
  1,
  Math.min(
    3,
    numericArg(
      args["image-race-width"],
      2,
    ),
  ),
);

if (TO < FROM) {
  console.error(
    `Invalid range ${FROM}-${TO}`,
  );
  process.exit(1);
}

/* =========================================================
   EXACT MINTED RANGES

   Community minted: 1-1369
   1370-2500: NEVER MINTED
   Treasury: 2501-3500
   Reserve: 3501-4000

   Total = 1369 + 1000 + 500 = 2869
========================================================= */

const MINTED_RANGES = [
  [1, 1369],
  [2501, 3500],
  [3501, 4000],
];

function isMintedId(tokenId) {
  return MINTED_RANGES.some(
    ([start, end]) =>
      tokenId >= start &&
      tokenId <= end,
  );
}

/* =========================================================
   CONTRACT
========================================================= */

const abi = [
  {
    type: "function",
    name: "revealed",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "bool",
      },
    ],
  },

  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [
      {
        type: "uint256",
      },
    ],
    outputs: [
      {
        type: "string",
      },
    ],
  },
];

const client =
  createPublicClient({
    chain: base,

    transport: fallback(
      RPCS.map((url) =>
        http(url, {
          timeout: 8000,
          retryCount: 2,
          retryDelay: 350,
        }),
      ),
    ),
  });

/* =========================================================
   HELPERS
========================================================= */

const sleep = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms),
  );

const scalar = (value) =>
  value == null ||
  [
    "string",
    "number",
    "boolean",
  ].includes(typeof value);

const asText = (value) =>
  value == null
    ? null
    : typeof value === "string"
      ? value
      : scalar(value)
        ? String(value)
        : JSON.stringify(value);

/* =========================================================
   TRAITS
========================================================= */

function extractTraits(metadata) {
  const sources = [
    metadata?.attributes,
    metadata?.traits,
    metadata?.features,
    metadata?.properties
      ?.attributes,
    metadata?.properties?.traits,
  ];

  let raw =
    sources.find(Array.isArray);

  if (
    !raw &&
    metadata?.properties &&
    typeof metadata.properties ===
      "object" &&
    !Array.isArray(
      metadata.properties,
    )
  ) {
    raw = Object.entries(
      metadata.properties,
    )
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
          ].includes(key) &&
          scalar(value),
      )
      .map(
        ([key, value]) => ({
          trait_type: key,
          value,
        }),
      );
  }

  if (!Array.isArray(raw)) {
    return [];
  }

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
          trait_type:
            String(traitType),

          value,

          value_text:
            asText(value),

          display_type:
            item.display_type ??
            item.displayType ??
            null,
        };
      }

      return {
        index,
        trait_type:
          `Trait ${index + 1}`,

        value: item,

        value_text:
          asText(item),

        display_type: null,
      };
    })
    .filter(
      (item) =>
        item.trait_type.trim(),
    );
}

/* =========================================================
   IPFS
========================================================= */

function uriCandidates(value) {
  const uri = String(
    value || "",
  ).trim();

  if (!uri) {
    return [];
  }

  if (
    /^https?:\/\//i.test(uri) ||
    uri.startsWith("data:")
  ) {
    return [uri];
  }

  if (
    uri.startsWith("ar://")
  ) {
    return [
      `https://arweave.net/${uri.slice(
        5,
      )}`,
    ];
  }

  const path =
    uri.startsWith(
      "ipfs://ipfs/",
    )
      ? uri.slice(12)
      : uri.startsWith(
            "ipfs://",
          )
        ? uri.slice(7)
        : null;

  if (!path) {
    return [uri];
  }

  return IPFS_GATEWAYS.map(
    (gateway) =>
      `${gateway}${path}`,
  );
}

function resolveRelative(
  value,
  metadataUri,
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const v = value.trim();

  if (
    /^(ipfs|ar|data|https?):\/\//i.test(
      v,
    )
  ) {
    return v;
  }

  if (
    /^https?:\/\//i.test(
      metadataUri || "",
    )
  ) {
    try {
      return new URL(
        v,
        metadataUri,
      ).toString();
    } catch {}
  }

  return v;
}

async function fetchWithTimeout(
  url,
  init = {},
  ms = 6500,
) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () =>
      controller.abort(
        new Error(
          `timeout after ${ms}ms`,
        ),
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

/* =========================================================
   METADATA FETCH
========================================================= */

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
    const comma =
      tokenUri.indexOf(",");

    const header =
      tokenUri.slice(0, comma);

    const raw =
      tokenUri.slice(comma + 1);

    const text =
      /;base64/i.test(header)
        ? Buffer.from(
            raw,
            "base64",
          ).toString("utf8")
        : decodeURIComponent(raw);

    return {
      metadata:
        JSON.parse(text),

      metadataUri:
        tokenUri,
    };
  }

  let last =
    "metadata unavailable";

  const candidates =
    uriCandidates(tokenUri);

  const offset =
    candidates.length
      ? (Number(tokenId) +
          attempt) %
        candidates.length
      : 0;

  const ordered =
    candidates.length
      ? [
          ...candidates.slice(
            offset,
          ),

          ...candidates.slice(
            0,
            offset,
          ),
        ]
      : candidates;

  for (const url of ordered) {
    try {
      const response =
        await fetchWithTimeout(
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
        last =
          `${response.status} ${url}`;

        continue;
      }

      const parsed =
        JSON.parse(
          await response.text(),
        );

      if (
        parsed &&
        typeof parsed ===
          "object"
      ) {
        return {
          metadata: parsed,
          metadataUri: url,
        };
      }

      last =
        `invalid metadata @ ${url}`;
    } catch (error) {
      last =
        `${
          error?.name ||
          "Error"
        }: ` +
        `${String(
          error?.message ||
            error,
        )} @ ${url}`;
    }
  }

  throw new Error(last);
}

/* =========================================================
   SUPABASE

   Keeps the SAME authentication pattern
   that worked in your original backfill.

   Adds safe retries for:
   - JWT issued at future
   - 429
   - 5xx
   - transient network errors
========================================================= */

async function rest(
  path,
  init = {},
) {
  const maxAttempts = 5;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      const response =
        await fetch(
          `${SUPABASE_URL}/rest/v1/${path}`,

          {
            ...init,

            headers: {
              apikey:
                SERVICE_KEY,

              Authorization:
                `Bearer ${SERVICE_KEY}`,

              "Content-Type":
                "application/json",

              ...(init.headers ||
                {}),
            },
          },
        );

      const text =
        await response.text();

      if (response.ok) {
        return text
          ? JSON.parse(text)
          : null;
      }

      const jwtFuture =
        response.status === 401 &&
        text.includes(
          "JWT issued at future",
        );

      const retryable =
        response.status === 429 ||
        response.status >= 500;

      if (
        (jwtFuture ||
          retryable) &&
        attempt < maxAttempts
      ) {
        const waitMs =
          jwtFuture
            ? 15000 * attempt
            : 1000 *
              2 ** (attempt - 1);

        console.warn(
          `Supabase ${response.status}` +
            ` attempt ${attempt}/${maxAttempts}` +
            `${
              jwtFuture
                ? " · JWT clock skew"
                : ""
            }` +
            ` · retrying in ${Math.round(
              waitMs / 1000,
            )}s`,
        );

        await sleep(waitMs);

        continue;
      }

      throw new Error(
        `Supabase ${
          response.status
        }: ${text.slice(
          0,
          500,
        )}`,
      );
    } catch (error) {
      const message =
        String(
          error?.message ||
            error,
        );

      if (
        message.startsWith(
          "Supabase ",
        )
      ) {
        throw error;
      }

      if (
        attempt >= maxAttempts
      ) {
        throw error;
      }

      const waitMs =
        1000 *
        2 ** (attempt - 1);

      console.warn(
        `Supabase network error` +
          ` attempt ${attempt}/${maxAttempts}: ` +
          `${message.slice(
            0,
            160,
          )}` +
          ` · retrying in ${Math.round(
            waitMs / 1000,
          )}s`,
      );

      await sleep(waitMs);
    }
  }

  throw new Error(
    "Supabase request exhausted retries",
  );
}

async function cachedRecord(
  tokenId,
) {
  if (FORCE) {
    return null;
  }

  const q =
    new URLSearchParams({
      collection_address:
        `eq.${COLLECTION.toLowerCase()}`,

      token_id:
        `eq.${tokenId}`,

      select:
        "token_id,token_uri,metadata_uri,image_uri,trait_count,art_cache_status,cached_image_url",

      limit: "1",
    });

  const rows =
    await rest(
      `tobyswap_lore_tokens?${q}`,
    );

  return rows?.[0] || null;
}

async function rpc(
  name,
  body,
) {
  return rest(
    `rpc/${name}`,

    {
      method: "POST",

      body:
        JSON.stringify(body),
    },
  );
}

async function markArtFailure(
  tokenId,
  message,
) {
  await rpc(
    "tobyswap_set_lore_art_cache",

    {
      p_collection_address:
        COLLECTION.toLowerCase(),

      p_token_id:
        tokenId,

      p_cached_image_url:
        null,

      p_storage_path:
        null,

      p_content_type:
        null,

      p_image_bytes:
        null,

      p_status:
        "failed",

      p_error:
        String(message).slice(
          0,
          500,
        ),
    },
  ).catch(() => {});
}

/* =========================================================
   IMAGE RACING
========================================================= */

function contentTypeToExt(
  contentType,
) {
  if (
    contentType ===
    "image/jpeg"
  ) {
    return "jpg";
  }

  if (
    contentType ===
    "image/webp"
  ) {
    return "webp";
  }

  if (
    contentType ===
    "image/gif"
  ) {
    return "gif";
  }

  if (
    contentType ===
    "image/svg+xml"
  ) {
    return "svg";
  }

  return "png";
}

async function fetchImageCandidate(
  url,
  parentSignal,
) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () =>
      controller.abort(
        new Error(
          `timeout after ${IMAGE_TIMEOUT}ms`,
        ),
      ),
    IMAGE_TIMEOUT,
  );

  const parentAbort = () =>
    controller.abort(
      new Error(
        "gateway race cancelled",
      ),
    );

  if (parentSignal) {
    if (
      parentSignal.aborted
    ) {
      parentAbort();
    } else {
      parentSignal.addEventListener(
        "abort",
        parentAbort,
        {
          once: true,
        },
      );
    }
  }

  try {
    const response =
      await fetch(url, {
        headers: {
          accept:
            "image/*,*/*;q=0.5",
        },

        cache: "no-store",

        signal:
          controller.signal,
      });

    if (!response.ok) {
      throw new Error(
        `${response.status} ${url}`,
      );
    }

    const contentType = (
      response.headers.get(
        "content-type",
      ) || ""
    )
      .split(";")[0]
      .toLowerCase();

    if (
      !contentType.startsWith(
        "image/",
      )
    ) {
      throw new Error(
        `not image: ${
          contentType ||
          "unknown"
        } @ ${url}`,
      );
    }

    const declaredLength =
      Number(
        response.headers.get(
          "content-length",
        ) || 0,
      );

    if (
      declaredLength &&
      declaredLength >
        MAX_IMAGE_BYTES
    ) {
      throw new Error(
        "image exceeds size cap",
      );
    }

    const bytes =
      Buffer.from(
        await response.arrayBuffer(),
      );

    if (!bytes.length) {
      throw new Error(
        "empty image response",
      );
    }

    if (
      bytes.length >
      MAX_IMAGE_BYTES
    ) {
      throw new Error(
        "image exceeds size cap",
      );
    }

    return {
      url,
      contentType,
      bytes,
    };
  } finally {
    clearTimeout(timer);

    if (parentSignal) {
      parentSignal.removeEventListener(
        "abort",
        parentAbort,
      );
    }
  }
}

async function raceImageCandidates(
  candidates,
) {
  let lastError =
    new Error(
      "image unavailable",
    );

  for (
    let i = 0;
    i < candidates.length;
    i += IMAGE_RACE_WIDTH
  ) {
    const batch =
      candidates.slice(
        i,
        i +
          IMAGE_RACE_WIDTH,
      );

    const controller =
      new AbortController();

    try {
      const winner =
        await Promise.any(
          batch.map(
            async (url) => {
              try {
                return await fetchImageCandidate(
                  url,
                  controller.signal,
                );
              } catch (error) {
                lastError =
                  error;

                throw error;
              }
            },
          ),
        );

      /*
       * One complete image won.
       * Kill the losing request.
       */
      controller.abort();

      return winner;
    } catch (error) {
      controller.abort();

      if (
        error?.errors?.length
      ) {
        lastError =
          error.errors[
            error.errors.length -
              1
          ];
      } else {
        lastError = error;
      }
    }
  }

  throw lastError;
}

/* =========================================================
   ART CACHE
========================================================= */

async function uploadArt(
  tokenId,
  imageValue,
  metadataUri,
  tokenUri,
  attempt = 0,
) {
  const resolved =
    resolveRelative(
      imageValue,
      metadataUri ||
        tokenUri,
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
      "No image candidates",
    );
  }

  /*
   * Spread first-choice gateway
   * across tokens.
   */
  const offset =
    (Number(tokenId) +
      attempt) %
    candidates.length;

  const ordered = [
    ...candidates.slice(
      offset,
    ),

    ...candidates.slice(
      0,
      offset,
    ),
  ];

  let fetched;

  try {
    fetched =
      await raceImageCandidates(
        ordered,
      );
  } catch (error) {
    const message =
      `${
        error?.name ||
        "Error"
      }: ${String(
        error?.message ||
          error,
      )}`;

    await markArtFailure(
      tokenId,
      message,
    );

    throw new Error(message);
  }

  const {
    bytes,
    contentType,
  } = fetched;

  const ext =
    contentTypeToExt(
      contentType,
    );

  const path =
    `canonical/${tokenId}.${ext}`;

  const upload =
    await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,

      {
        method: "POST",

        headers: {
          apikey:
            SERVICE_KEY,

          Authorization:
            `Bearer ${SERVICE_KEY}`,

          "Content-Type":
            contentType,

          "x-upsert":
            "true",

          "Cache-Control":
            "public, max-age=31536000, immutable",
        },

        body: bytes,
      },
    );

  if (!upload.ok) {
    const message =
      `storage ${
        upload.status
      }: ${(
        await upload.text()
      ).slice(
        0,
        300,
      )}`;

    await markArtFailure(
      tokenId,
      message,
    );

    throw new Error(message);
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

      p_token_id:
        tokenId,

      p_cached_image_url:
        publicUrl,

      p_storage_path:
        path,

      p_content_type:
        contentType,

      p_image_bytes:
        bytes.length,

      p_status:
        "cached",

      p_error:
        null,
    },
  );

  return publicUrl;
}

/* =========================================================
   CHECK REVEAL
========================================================= */

const revealed =
  await client.readContract({
    address:
      COLLECTION,

    abi,

    functionName:
      "revealed",
  });

if (!revealed) {
  console.error(
    "Canonical collection is not revealed.",
  );

  process.exit(1);
}

/* =========================================================
   BUILD QUEUE

   THIS is what prevents 1370-2500
   from ever being touched.
========================================================= */

const requestedIds =
  Array.from(
    {
      length:
        TO - FROM + 1,
    },

    (_, i) =>
      FROM + i,
  );

const queue =
  requestedIds.filter(
    isMintedId,
  );

const excludedUnminted =
  requestedIds.length -
  queue.length;

const total =
  queue.length;

const artRetryQueue = [];

const stats = {
  metadataCached: 0,
  artCached: 0,
  skipped: 0,
  metadataFailed: 0,
  artFailed: 0,
};

console.log("");
console.log(
  "──── TOBYWORLD LORE BACKFILL ────",
);

console.log(
  `Requested: ${FROM}-${TO}`,
);

console.log(
  `Minted queued: ${total}`,
);

console.log(
  `Unminted excluded: ${excludedUnminted}`,
);

console.log(
  "Ranges: 1-1369 | 2501-3500 | 3501-4000",
);

console.log(
  `Workers: ${CONCURRENCY}`,
);

console.log(
  `Metadata timeout: ${META_TIMEOUT}ms`,
);

console.log(
  `Image timeout: ${IMAGE_TIMEOUT}ms`,
);

console.log(
  `Gateway race: ${IMAGE_RACE_WIDTH}`,
);

console.log(
  `Artwork: ${!METADATA_ONLY}`,
);

console.log(
  `Force: ${FORCE}`,
);

console.log(
  `Gateways (${IPFS_GATEWAYS.length}):`,
);

for (
  const gateway
  of IPFS_GATEWAYS
) {
  console.log(
    `  ${gateway}`,
  );
}

if (total === 0) {
  console.log(
    "No minted IDs in requested range.",
  );

  process.exit(0);
}

/* =========================================================
   PROGRESS
========================================================= */

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

/* =========================================================
   PROCESS TOKEN
========================================================= */

async function processToken(
  tokenId,
) {
  /*
   * Additional belt-and-suspenders check.
   * Queue should already contain only minted IDs.
   */
  if (
    !isMintedId(tokenId)
  ) {
    return;
  }

  const existing =
    await cachedRecord(
      tokenId,
    );

  const metadataReady =
    Boolean(
      existing &&
        Number(
          existing.trait_count ||
            0,
        ) > 0 &&
        existing.image_uri,
    );

  const artReady =
    Boolean(
      existing &&
        existing.art_cache_status ===
          "cached" &&
        existing.cached_image_url,
    );

  /*
   * EVERYTHING DONE:
   * zero RPC
   * zero metadata fetch
   * zero artwork fetch
   */
  if (
    metadataReady &&
    (METADATA_ONLY ||
      artReady)
  ) {
    stats.skipped++;

    progress();

    return;
  }

  /*
   * Metadata already cached.
   * Only repair artwork.
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

        image:
          existing.image_uri,

        metadataUri:
          existing.metadata_uri,

        tokenUri:
          existing.token_uri,
      });

      console.warn(
        `#${tokenId} ART pending: ` +
          String(
            error?.message ||
              error,
          ).slice(
            0,
            180,
          ),
      );
    }

    stats.metadataCached++;

    progress();

    return;
  }

  /*
   * Need metadata.
   */
  let tokenUri;
  let metadata;
  let metadataUri;
  let image;

  try {
    tokenUri =
      await client.readContract({
        address:
          COLLECTION,

        abi,

        functionName:
          "tokenURI",

        args: [
          BigInt(tokenId),
        ],
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

        p_chain_id:
          8453,

        p_token_id:
          tokenId,

        p_token_uri:
          String(tokenUri),

        p_metadata_uri:
          metadataUri,

        p_name:
          asText(
            metadata?.name,
          ),

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
          "backfill-v4-valid-ranges",

        p_traits:
          traits,
      },
    );

    stats.metadataCached++;
  } catch (error) {
    stats.metadataFailed++;

    console.error(
      `#${tokenId} METADATA failed: ` +
        String(
          error?.message ||
            error,
        ).slice(
          0,
          260,
        ),
    );

    progress();

    await sleep(100);

    return;
  }

  /*
   * Metadata is now safely stored.
   * Artwork is separate.
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
        `#${tokenId} ART pending; metadata saved: ` +
          String(
            error?.message ||
              error,
          ).slice(
            0,
            180,
          ),
      );
    }
  }

  progress();
}

/* =========================================================
   MAIN WORKERS
========================================================= */

async function worker() {
  while (queue.length) {
    const tokenId =
      queue.shift();

    if (!tokenId) {
      return;
    }

    await processToken(
      tokenId,
    );
  }
}

await Promise.all(
  Array.from(
    {
      length:
        CONCURRENCY,
    },

    () => worker(),
  ),
);

/* =========================================================
   ART-ONLY REPAIR PASS
========================================================= */

if (
  !METADATA_ONLY &&
  RETRY_FAILED_ART &&
  artRetryQueue.length
) {
  const retryItems = [
    ...artRetryQueue,
  ];

  const RETRY_WORKERS =
    Math.min(
      3,
      Math.max(
        1,
        CONCURRENCY,
      ),
    );

  console.log("");

  console.log(
    `ART repair pass: ${retryItems.length} items · workers=${RETRY_WORKERS}`,
  );

  let cursor = 0;

  async function retryWorker() {
    while (
      cursor <
      retryItems.length
    ) {
      const item =
        retryItems[
          cursor++
        ];

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
            stats.artFailed -
              1,
          );

        console.log(
          `#${item.tokenId} ART repaired`,
        );
      } catch (error) {
        console.warn(
          `#${item.tokenId} ART still pending: ` +
            String(
              error?.message ||
                error,
            ).slice(
              0,
              180,
            ),
        );
      }
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          RETRY_WORKERS,
      },

      () =>
        retryWorker(),
    ),
  );
}

/* =========================================================
   SUMMARY
========================================================= */

console.log("");

console.log(
  "──────── BACKFILL COMPLETE ────────",
);

console.log(
  `requested range: ${FROM}-${TO}`,
);

console.log(
  `minted processed: ${total}`,
);

console.log(
  `unminted excluded: ${excludedUnminted}`,
);

console.log(
  `metadata handled: ${stats.metadataCached}`,
);

console.log(
  `art cached/repaired: ${stats.artCached}`,
);

console.log(
  `already complete: ${stats.skipped}`,
);

console.log(
  `real metadata failures: ${stats.metadataFailed}`,
);

console.log(
  `art still pending: ${stats.artFailed}`,
);

console.log(
  "───────────────────────────────────",
);

/*
 * Artwork misses do NOT fail the Action.
 * Metadata failures still do.
 */
if (
  stats.metadataFailed
) {
  process.exitCode = 2;
}
