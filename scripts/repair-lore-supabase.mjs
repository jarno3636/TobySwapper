#!/usr/bin/env node

import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";

/* =========================================================
   TOBYWORLD LORE — TARGETED SUPABASE REPAIR

   Expected minted token IDs:
   - Community: 1–1369
   - Treasury:  2501–3500
   - Reserve:   3501–4000
   Total:       2869

   This script:
   1) Audits Supabase first.
   2) Retries ONLY missing/incomplete metadata.
   3) Retries ONLY missing artwork.
   4) Learns a working gateway per IPFS CID and reuses it.
   5) Leaves completed records completely untouched.
   6) Finishes green even if a few IPFS files remain pending.
========================================================= */

const COLLECTION =
  "0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A";

const COLLECTION_LOWER =
  COLLECTION.toLowerCase();

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

const PRIMARY_GATEWAY = String(
  process.env.IPFS_PRIMARY_GATEWAY || "",
)
  .trim()
  .replace(/\/+$/, "");

const PUBLIC_GATEWAYS = (
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
  .map((value) =>
    value.endsWith("/")
      ? value
      : `${value}/`,
  );

const IPFS_GATEWAYS = [
  ...(PRIMARY_GATEWAY
    ? [
        PRIMARY_GATEWAY.endsWith("/ipfs")
          ? `${PRIMARY_GATEWAY}/`
          : PRIMARY_GATEWAY.endsWith("/ipfs/")
            ? PRIMARY_GATEWAY
            : `${PRIMARY_GATEWAY}/ipfs/`,
      ]
    : []),
  ...PUBLIC_GATEWAYS,
].filter(
  (value, index, arr) =>
    arr.indexOf(value) === index,
);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing Supabase URL or server key.",
  );

  process.exit(1);
}

/* =========================================================
   CLI
========================================================= */

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg) => {
      const [key, value = "true"] =
        arg
          .replace(/^--/, "")
          .split("=");

      return [key, value];
    }),
);

function num(value, fallback) {
  if (
    value == null ||
    value === ""
  ) {
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

const METADATA_WORKERS = Math.max(
  1,
  Math.min(
    4,
    num(
      args["metadata-workers"],
      2,
    ),
  ),
);

const ART_WORKERS = Math.max(
  1,
  Math.min(
    6,
    num(
      args["art-workers"],
      3,
    ),
  ),
);

const META_TIMEOUT = Math.max(
  3000,
  num(
    args["metadata-timeout-ms"],
    9000,
  ),
);

const IMAGE_TIMEOUT = Math.max(
  5000,
  num(
    args["image-timeout-ms"],
    18000,
  ),
);

const IMAGE_RACE_WIDTH = Math.max(
  1,
  Math.min(
    3,
    num(
      args["image-race-width"],
      2,
    ),
  ),
);

const MAX_IMAGE_BYTES =
  Math.max(
    1,
    num(
      args["max-image-mb"],
      12,
    ),
  ) *
  1024 *
  1024;

const PAGE_SIZE = 1000;

/* =========================================================
   EXPECTED TOKEN IDS
========================================================= */

const EXPECTED_IDS = [
  ...Array.from(
    { length: 1369 },
    (_, i) => i + 1,
  ),

  ...Array.from(
    { length: 1000 },
    (_, i) => 2501 + i,
  ),

  ...Array.from(
    { length: 500 },
    (_, i) => 3501 + i,
  ),
];

const EXPECTED_SET =
  new Set(EXPECTED_IDS);

/* =========================================================
   CONTRACT ABI
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
          timeout: 10000,
          retryCount: 3,
          retryDelay: 500,
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
   IPFS HELPERS
========================================================= */

function parseIpfs(value) {
  const uri = String(
    value || "",
  ).trim();

  let path = null;

  if (
    uri.startsWith(
      "ipfs://ipfs/",
    )
  ) {
    path = uri.slice(12);
  } else if (
    uri.startsWith(
      "ipfs://",
    )
  ) {
    path = uri.slice(7);
  }

  if (!path) {
    return null;
  }

  const slash =
    path.indexOf("/");

  return {
    cid:
      slash === -1
        ? path
        : path.slice(
            0,
            slash,
          ),

    path,
  };
}

function uriCandidates(
  value,
  preferredGateway = null,
) {
  const uri = String(
    value || "",
  ).trim();

  if (!uri) {
    return [];
  }

  if (
    /^https?:\/\//i.test(
      uri,
    ) ||
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

  const parsed =
    parseIpfs(uri);

  if (!parsed) {
    return [uri];
  }

  const gateways = [
    ...(preferredGateway
      ? [preferredGateway]
      : []),

    ...IPFS_GATEWAYS,
  ].filter(
    (value, index, arr) =>
      value &&
      arr.indexOf(value) ===
        index,
  );

  return gateways.map(
    (gateway) =>
      `${gateway}${parsed.path}`,
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

  const v =
    value.trim();

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

/* =========================================================
   SUPABASE RETRY WRAPPER
========================================================= */

function supabaseHeaders(
  extra = {},
) {
  return {
    apikey: SERVICE_KEY,

    Authorization:
      `Bearer ${SERVICE_KEY}`,

    ...extra,
  };
}

async function supabaseFetch(
  url,
  init = {},
  {
    parseJson = false,
  } = {},
) {
  const maxAttempts = 6;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      const response =
        await fetch(url, {
          ...init,

          headers:
            supabaseHeaders(
              init.headers || {},
            ),
        });

      const text =
        await response.text();

      if (response.ok) {
        if (!parseJson) {
          return {
            response,
            text,
          };
        }

        return {
          response,
          text,

          data:
            text
              ? JSON.parse(text)
              : null,
        };
      }

      const jwtFuture =
        response.status === 401 &&
        text.includes(
          "JWT issued at future",
        );

      const retryable =
        jwtFuture ||
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;

      if (
        retryable &&
        attempt < maxAttempts
      ) {
        const waitMs =
          jwtFuture
            ? Math.min(
                60000,
                12000 *
                  attempt,
              )
            : Math.min(
                15000,
                750 *
                  2 **
                    (attempt -
                      1),
              );

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
        Math.min(
          15000,
          750 *
            2 **
              (attempt - 1),
        );

      console.warn(
        `Supabase network error attempt ${attempt}/${maxAttempts}: ` +
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

async function rest(
  path,
  init = {},
) {
  const result =
    await supabaseFetch(
      `${SUPABASE_URL}/rest/v1/${path}`,

      {
        ...init,

        headers: {
          "Content-Type":
            "application/json",

          ...(init.headers ||
            {}),
        },
      },

      {
        parseJson: true,
      },
    );

  return result.data;
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

/* =========================================================
   AUDIT SUPABASE
========================================================= */

async function loadAllLoreRows() {
  const rows = [];

  let start = 0;

  while (true) {
    const end =
      start +
      PAGE_SIZE -
      1;

    const query =
      new URLSearchParams({
        collection_address:
          `eq.${COLLECTION_LOWER}`,

        select:
          "token_id,token_uri,metadata_uri,image_uri,trait_count,art_cache_status,cached_image_url",

        order:
          "token_id.asc",
      });

    const result =
      await supabaseFetch(
        `${SUPABASE_URL}/rest/v1/tobyswap_lore_tokens?${query}`,

        {
          headers: {
            "Content-Type":
              "application/json",

            Range:
              `${start}-${end}`,

            Prefer:
              "count=none",
          },
        },

        {
          parseJson: true,
        },
      );

    const page =
      Array.isArray(result.data)
        ? result.data
        : [];

    rows.push(...page);

    if (
      page.length <
      PAGE_SIZE
    ) {
      break;
    }

    start +=
      PAGE_SIZE;
  }

  return rows;
}

function metadataReady(row) {
  return Boolean(
    row &&
      Number(
        row.trait_count ||
          0,
      ) > 0 &&
      typeof row.image_uri ===
        "string" &&
      row.image_uri.trim(),
  );
}

function artReady(row) {
  return Boolean(
    row &&
      row.art_cache_status ===
        "cached" &&
      typeof row.cached_image_url ===
        "string" &&
      row.cached_image_url.trim(),
  );
}

/* =========================================================
   METADATA FETCH
========================================================= */

async function fetchWithTimeout(
  url,
  init = {},
  timeoutMs =
    META_TIMEOUT,
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(
          new Error(
            `timeout after ${timeoutMs}ms`,
          ),
        ),

      timeoutMs,
    );

  try {
    return await fetch(
      url,

      {
        ...init,

        signal:
          controller.signal,
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMetadata(
  tokenUri,
  tokenId,
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
      tokenUri.slice(
        0,
        comma,
      );

    const raw =
      tokenUri.slice(
        comma + 1,
      );

    const text =
      /;base64/i.test(
        header,
      )
        ? Buffer.from(
            raw,
            "base64",
          ).toString(
            "utf8",
          )
        : decodeURIComponent(
            raw,
          );

    return {
      metadata:
        JSON.parse(text),

      metadataUri:
        tokenUri,
    };
  }

  const candidates =
    uriCandidates(
      tokenUri,
    );

  const offset =
    candidates.length
      ? (Number(
          tokenId,
        ) +
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

  let last =
    "metadata unavailable";

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

            cache:
              "no-store",
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
          metadata:
            parsed,

          metadataUri:
            url,
        };
      }

      last =
        `invalid metadata @ ${url}`;
    } catch (error) {
      last =
        `${
          error?.name ||
          "Error"
        }: ${String(
          error?.message ||
            error,
        )} @ ${url}`;
    }
  }

  throw new Error(last);
}

/* =========================================================
   ARTWORK FETCH
========================================================= */

const CID_GATEWAY =
  new Map();

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

function gatewayFromUrl(
  url,
  parsed,
) {
  if (!parsed) {
    return null;
  }

  const suffix =
    parsed.path;

  if (
    !url.endsWith(
      suffix,
    )
  ) {
    return null;
  }

  return url.slice(
    0,
    url.length -
      suffix.length,
  );
}

async function fetchImageCandidate(
  url,
  parentSignal,
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
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
        "gateway race cancelled after winner",
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
      await fetch(
        url,

        {
          headers: {
            accept:
              "image/*,*/*;q=0.5",
          },

          cache:
            "no-store",

          signal:
            controller.signal,
        },
      );

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

    const contentLength =
      Number(
        response.headers.get(
          "content-length",
        ) || 0,
      );

    if (
      contentLength &&
      contentLength >
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
        "empty image",
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
      bytes,
      contentType,
      url,
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

async function raceCandidates(
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
            (url) =>
              fetchImageCandidate(
                url,
                controller.signal,
              ).catch(
                (error) => {
                  lastError =
                    error;

                  throw error;
                },
              ),
          ),
        );

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
        lastError =
          error;
      }
    }
  }

  throw lastError;
}

async function downloadArt(
  imageValue,
  metadataUri,
  tokenUri,
) {
  const resolved =
    resolveRelative(
      imageValue,
      metadataUri ||
        tokenUri,
    );

  if (!resolved) {
    throw new Error(
      "No image URI",
    );
  }

  const parsed =
    parseIpfs(resolved);

  const preferred =
    parsed
      ? CID_GATEWAY.get(
          parsed.cid,
        ) || null
      : null;

  /*
   * If we've already learned a working
   * gateway for this CID, try it FIRST.
   */
  if (
    parsed &&
    preferred
  ) {
    try {
      const url =
        `${preferred}${parsed.path}`;

      return await fetchImageCandidate(
        url,
      );
    } catch {
      CID_GATEWAY.delete(
        parsed.cid,
      );
    }
  }

  const candidates =
    uriCandidates(
      resolved,
    );

  if (!candidates.length) {
    throw new Error(
      "No image candidates",
    );
  }

  const winner =
    await raceCandidates(
      candidates,
    );

  if (parsed) {
    const winningGateway =
      gatewayFromUrl(
        winner.url,
        parsed,
      );

    if (winningGateway) {
      CID_GATEWAY.set(
        parsed.cid,
        winningGateway,
      );
    }
  }

  return winner;
}

async function markArtFailure(
  tokenId,
  message,
) {
  await rpc(
    "tobyswap_set_lore_art_cache",

    {
      p_collection_address:
        COLLECTION_LOWER,

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
        String(
          message,
        ).slice(
          0,
          500,
        ),
    },
  ).catch(() => {});
}

async function uploadArt(
  tokenId,
  imageValue,
  metadataUri,
  tokenUri,
) {
  let fetched;

  try {
    fetched =
      await downloadArt(
        imageValue,
        metadataUri,
        tokenUri,
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

  const result =
    await supabaseFetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,

      {
        method:
          "POST",

        headers: {
          "Content-Type":
            contentType,

          "x-upsert":
            "true",

          "Cache-Control":
            "public, max-age=31536000, immutable",
        },

        body:
          bytes,
      },
    );

  if (
    !result.response.ok
  ) {
    throw new Error(
      `storage ${result.response.status}`,
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
        COLLECTION_LOWER,

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
   WORKER POOL
========================================================= */

async function runPool(
  items,
  workerCount,
  handler,
) {
  let cursor = 0;

  async function worker() {
    while (
      cursor <
      items.length
    ) {
      const item =
        items[
          cursor++
        ];

      await handler(item);
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            workerCount,
            Math.max(
              1,
              items.length,
            ),
          ),
      },

      () => worker(),
    ),
  );
}

/* =========================================================
   START
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

console.log("");
console.log(
  "──── TOBYWORLD LORE TARGETED REPAIR ────",
);

console.log(
  `Expected minted deeds: ${EXPECTED_IDS.length}`,
);

console.log(
  `Metadata workers: ${METADATA_WORKERS}`,
);

console.log(
  `Artwork workers: ${ART_WORKERS}`,
);

console.log(
  `Artwork gateway race width: ${IMAGE_RACE_WIDTH}`,
);

console.log(
  `Primary gateway configured: ${
    PRIMARY_GATEWAY
      ? "yes"
      : "no"
  }`,
);

console.log("");

/* =========================================================
   AUDIT CURRENT DB
========================================================= */

const rows =
  await loadAllLoreRows();

const rowMap =
  new Map(
    rows
      .filter((row) =>
        EXPECTED_SET.has(
          Number(
            row.token_id,
          ),
        ),
      )
      .map((row) => [
        Number(
          row.token_id,
        ),

        row,
      ]),
  );

const missingMetadata = [];

const pendingArt = [];

for (
  const tokenId
  of EXPECTED_IDS
) {
  const row =
    rowMap.get(
      tokenId,
    );

  if (
    !metadataReady(row)
  ) {
    missingMetadata.push(
      tokenId,
    );

    continue;
  }

  if (!artReady(row)) {
    pendingArt.push({
      tokenId,

      image:
        row.image_uri,

      metadataUri:
        row.metadata_uri,

      tokenUri:
        row.token_uri,
    });
  }
}

console.log(
  `Audit: ${
    2869 -
    missingMetadata.length -
    pendingArt.length
  } complete`,
);

console.log(
  `Audit: ${pendingArt.length} artwork pending`,
);

console.log(
  `Audit: ${missingMetadata.length} metadata missing/incomplete`,
);

console.log("");

/* =========================================================
   REPAIR METADATA
========================================================= */

const metadataStats = {
  repaired: 0,
  failed: [],
};

const metadataArtItems = [];

await runPool(
  missingMetadata,
  METADATA_WORKERS,

  async (tokenId) => {
    try {
      const tokenUri =
        await client.readContract({
          address:
            COLLECTION,

          abi,

          functionName:
            "tokenURI",

          args: [
            BigInt(
              tokenId,
            ),
          ],
        });

      let result = null;
      let lastError = null;

      /*
       * Two metadata passes.
       * Second pass rotates gateway order.
       */
      for (
        let attempt = 0;
        attempt < 2 &&
        !result;
        attempt++
      ) {
        try {
          result =
            await fetchMetadata(
              String(
                tokenUri,
              ),

              tokenId,
              attempt,
            );
        } catch (error) {
          lastError =
            error;

          if (
            attempt === 0
          ) {
            await sleep(
              500,
            );
          }
        }
      }

      if (!result) {
        throw (
          lastError ||
          new Error(
            "metadata unavailable",
          )
        );
      }

      const {
        metadata,
        metadataUri,
      } = result;

      const traits =
        extractTraits(
          metadata,
        );

      const image =
        metadata?.image ??
        metadata?.image_url ??
        metadata?.imageUrl ??
        null;

      await rpc(
        "tobyswap_upsert_lore_metadata",

        {
          p_collection_address:
            COLLECTION_LOWER,

          p_chain_id:
            8453,

          p_token_id:
            tokenId,

          p_token_uri:
            String(
              tokenUri,
            ),

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
            asText(
              image,
            ),

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
            "repair-targeted-v1",

          p_traits:
            traits,
        },
      );

      metadataStats.repaired++;

      console.log(
        `#${tokenId} METADATA repaired`,
      );

      if (image) {
        metadataArtItems.push({
          tokenId,
          image,
          metadataUri,

          tokenUri:
            String(
              tokenUri,
            ),
        });
      }
    } catch (error) {
      metadataStats.failed.push(
        tokenId,
      );

      console.warn(
        `#${tokenId} METADATA still missing: ${String(
          error?.message ||
            error,
        ).slice(
          0,
          220,
        )}`,
      );
    }
  },
);

/* =========================================================
   BUILD ART QUEUE
========================================================= */

const artItemsById =
  new Map();

for (
  const item
  of [
    ...pendingArt,
    ...metadataArtItems,
  ]
) {
  artItemsById.set(
    item.tokenId,
    item,
  );
}

const artItems = [
  ...artItemsById.values(),
];

/*
 * Group by CID so once a gateway works
 * for a CID, nearby jobs reuse it.
 */
artItems.sort(
  (a, b) => {
    const cidA =
      parseIpfs(
        a.image,
      )?.cid || "";

    const cidB =
      parseIpfs(
        b.image,
      )?.cid || "";

    return (
      cidA.localeCompare(
        cidB,
      ) ||
      a.tokenId -
        b.tokenId
    );
  },
);

/* =========================================================
   REPAIR ART
========================================================= */

const artStats = {
  repaired: 0,
  failed: [],
};

await runPool(
  artItems,
  ART_WORKERS,

  async (item) => {
    try {
      await uploadArt(
        item.tokenId,
        item.image,
        item.metadataUri,
        item.tokenUri,
      );

      artStats.repaired++;

      const parsed =
        parseIpfs(
          item.image,
        );

      const learned =
        parsed
          ? CID_GATEWAY.get(
              parsed.cid,
            )
          : null;

      console.log(
        `#${item.tokenId} ART repaired` +
          `${
            learned
              ? ` · ${
                  new URL(
                    learned,
                  ).hostname
                }`
              : ""
          }`,
      );
    } catch (error) {
      artStats.failed.push(
        item.tokenId,
      );

      console.warn(
        `#${item.tokenId} ART still pending: ${String(
          error?.message ||
            error,
        ).slice(
          0,
          200,
        )}`,
      );
    }
  },
);

/* =========================================================
   FINAL AUDIT
========================================================= */

const finalRows =
  await loadAllLoreRows();

const finalMap =
  new Map(
    finalRows
      .filter((row) =>
        EXPECTED_SET.has(
          Number(
            row.token_id,
          ),
        ),
      )
      .map((row) => [
        Number(
          row.token_id,
        ),

        row,
      ]),
  );

const finalMetadataMissing = [];

const finalArtPending = [];

let complete = 0;

for (
  const tokenId
  of EXPECTED_IDS
) {
  const row =
    finalMap.get(
      tokenId,
    );

  if (
    !metadataReady(row)
  ) {
    finalMetadataMissing.push(
      tokenId,
    );
  } else if (
    !artReady(row)
  ) {
    finalArtPending.push(
      tokenId,
    );
  } else {
    complete++;
  }
}

/* =========================================================
   FINAL REPORT
========================================================= */

console.log("");

console.log(
  "════════ REPAIR COMPLETE ════════",
);

console.log(
  `Complete collection: ${complete}/2869`,
);

console.log(
  `Metadata repaired this run: ${metadataStats.repaired}`,
);

console.log(
  `Artwork repaired this run: ${artStats.repaired}`,
);

console.log(
  `Metadata still missing: ${finalMetadataMissing.length}`,
);

console.log(
  `Artwork still pending: ${finalArtPending.length}`,
);

if (
  finalMetadataMissing.length
) {
  console.log(
    `Remaining metadata IDs: ${finalMetadataMissing.join(
      ",",
    )}`,
  );
}

if (
  finalArtPending.length
) {
  console.log(
    `Remaining artwork IDs: ${finalArtPending.join(
      ",",
    )}`,
  );
}

if (
  CID_GATEWAY.size
) {
  console.log("");

  console.log(
    "Working gateway learned by CID:",
  );

  for (
    const [
      cid,
      gateway,
    ]
    of CID_GATEWAY.entries()
  ) {
    console.log(
      `  ${cid} -> ${gateway}`,
    );
  }
}

console.log(
  "═════════════════════════════════",
);

/*
 * Intentionally exit successfully.
 *
 * If a few remote IPFS files are still unavailable,
 * the workflow remains GREEN and reports exactly
 * which token IDs still need another repair run.
 */
