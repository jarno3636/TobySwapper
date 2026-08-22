#!/usr/bin/env node

import {
  createPublicClient,
  fallback,
  http,
} from "viem";

import { base } from "viem/chains";

/* =========================================================
   TOBYWORLD LORE — FINAL TARGETED REPAIR

   Canonical NFT:
   0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A

   Actual minted IDs:
   - Community: 1–1369
   - Treasury:  2501–3500
   - Reserve:   3501–4000

   Total minted: 2869

   This script:
   - Reads Supabase first.
   - Never touches already-complete NFTs.
   - Repairs only missing metadata / artwork.
   - Uses multiple repair passes.
   - Groups artwork by CID.
   - Learns successful gateways by CID.
   - Rotates gateway order each pass.
   - Retries Supabase transient failures.
   - Reports remaining IDs.
   - Exits green even if a few remote IPFS files remain.
========================================================= */

/* =========================================================
   CORE CONFIG
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

if (!SUPABASE_URL) {
  console.error(
    "Missing SUPABASE_URL.",
  );

  process.exit(1);
}

if (!SERVICE_KEY) {
  console.error(
    "Missing Supabase server/service-role key.",
  );

  process.exit(1);
}

/* =========================================================
   RPC
========================================================= */

const RPC_URLS = [
  process.env.BASE_RPC_URL,
  process.env.NEXT_PUBLIC_BASE_RPC_URL,

  // Last-resort fallback.
  "https://mainnet.base.org",
].filter(Boolean);

const client =
  createPublicClient({
    chain: base,

    transport: fallback(
      RPC_URLS.map((url) =>
        http(url, {
          timeout: 12000,
          retryCount: 3,
          retryDelay: 750,
        }),
      ),
    ),
  });

/* =========================================================
   IPFS GATEWAYS
========================================================= */

function normalizeGateway(value) {
  let gateway =
    String(value || "").trim();

  if (!gateway) {
    return null;
  }

  gateway =
    gateway.replace(
      /\/+$/,
      "",
    );

  if (
    gateway.endsWith("/ipfs")
  ) {
    return `${gateway}/`;
  }

  return `${gateway}/ipfs/`;
}

const PRIMARY_GATEWAY =
  normalizeGateway(
    process.env
      .IPFS_PRIMARY_GATEWAY,
  );

const ENV_GATEWAYS = (
  process.env.IPFS_GATEWAYS ||
  ""
)
  .split(",")
  .map((value) =>
    value.trim(),
  )
  .filter(Boolean)
  .map((value) => {
    if (
      value.endsWith(
        "/ipfs/",
      )
    ) {
      return value;
    }

    if (
      value.endsWith(
        "/ipfs",
      )
    ) {
      return `${value}/`;
    }

    return normalizeGateway(
      value,
    );
  })
  .filter(Boolean);

const DEFAULT_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://nftstorage.link/ipfs/",
];

const IPFS_GATEWAYS = [
  ...(PRIMARY_GATEWAY
    ? [PRIMARY_GATEWAY]
    : []),

  ...ENV_GATEWAYS,

  ...DEFAULT_GATEWAYS,
].filter(
  (
    value,
    index,
    array,
  ) =>
    value &&
    array.indexOf(value) ===
      index,
);

/* =========================================================
   CLI ARGS
========================================================= */

const args =
  Object.fromEntries(
    process.argv
      .slice(2)
      .map((argument) => {
        const [
          key,
          value = "true",
        ] = argument
          .replace(/^--/, "")
          .split("=");

        return [
          key,
          value,
        ];
      }),
  );

function numericArg(
  value,
  fallbackValue,
) {
  if (
    value == null ||
    value === ""
  ) {
    return fallbackValue;
  }

  const parsed =
    Number(
      String(value)
        .replace(/,/g, "")
        .trim(),
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallbackValue;
}

const METADATA_WORKERS =
  Math.max(
    1,
    Math.min(
      3,
      numericArg(
        args[
          "metadata-workers"
        ],
        1,
      ),
    ),
  );

const ART_WORKERS =
  Math.max(
    1,
    Math.min(
      4,
      numericArg(
        args[
          "art-workers"
        ],
        2,
      ),
    ),
  );

const META_TIMEOUT =
  Math.max(
    5000,
    numericArg(
      args[
        "metadata-timeout-ms"
      ],
      18000,
    ),
  );

const IMAGE_TIMEOUT =
  Math.max(
    8000,
    numericArg(
      args[
        "image-timeout-ms"
      ],
      30000,
    ),
  );

const IMAGE_RACE_WIDTH =
  Math.max(
    1,
    Math.min(
      3,
      numericArg(
        args[
          "image-race-width"
        ],
        3,
      ),
    ),
  );

const REPAIR_PASSES =
  Math.max(
    1,
    Math.min(
      5,
      numericArg(
        args.passes,
        3,
      ),
    ),
  );

const MAX_IMAGE_BYTES =
  Math.max(
    1,
    numericArg(
      args[
        "max-image-mb"
      ],
      15,
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
    {
      length: 1369,
    },
    (_, index) =>
      index + 1,
  ),

  ...Array.from(
    {
      length: 1000,
    },
    (_, index) =>
      2501 + index,
  ),

  ...Array.from(
    {
      length: 500,
    },
    (_, index) =>
      3501 + index,
  ),
];

const EXPECTED_SET =
  new Set(
    EXPECTED_IDS,
  );

const EXPECTED_TOTAL =
  EXPECTED_IDS.length;

/* =========================================================
   CONTRACT ABI
========================================================= */

const ABI = [
  {
    type: "function",

    name: "revealed",

    stateMutability:
      "view",

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

    stateMutability:
      "view",

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

/* =========================================================
   BASIC HELPERS
========================================================= */

const sleep = (ms) =>
  new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  );

const scalar = (value) =>
  value == null ||
  [
    "string",
    "number",
    "boolean",
  ].includes(
    typeof value,
  );

const asText = (value) =>
  value == null
    ? null
    : typeof value ===
        "string"
      ? value
      : scalar(value)
        ? String(value)
        : JSON.stringify(
            value,
          );

/* =========================================================
   TRAITS
========================================================= */

function extractTraits(
  metadata,
) {
  const possibleSources = [
    metadata?.attributes,
    metadata?.traits,
    metadata?.features,
    metadata
      ?.properties
      ?.attributes,
    metadata
      ?.properties
      ?.traits,
  ];

  let raw =
    possibleSources.find(
      Array.isArray,
    );

  if (
    !raw &&
    metadata?.properties &&
    typeof metadata
      .properties ===
      "object" &&
    !Array.isArray(
      metadata.properties,
    )
  ) {
    raw =
      Object.entries(
        metadata.properties,
      )
        .filter(
          ([
            key,
            value,
          ]) =>
            ![
              "name",
              "description",
              "image",
              "image_url",
              "animation_url",
              "external_url",
              "attributes",
              "traits",
            ].includes(
              key,
            ) &&
            scalar(value),
        )
        .map(
          ([
            key,
            value,
          ]) => ({
            trait_type:
              key,

            value,
          }),
        );
  }

  if (
    !Array.isArray(raw)
  ) {
    return [];
  }

  return raw
    .map(
      (
        item,
        index,
      ) => {
        if (
          item &&
          typeof item ===
            "object" &&
          !Array.isArray(
            item,
          )
        ) {
          const traitType =
            item.trait_type ??
            item.traitType ??
            item.type ??
            item.name ??
            `Trait ${
              index + 1
            }`;

          const value =
            item.value ??
            item.trait_value ??
            item.traitValue ??
            item.val ??
            null;

          return {
            index,

            trait_type:
              String(
                traitType,
              ),

            value,

            value_text:
              asText(
                value,
              ),

            display_type:
              item.display_type ??
              item.displayType ??
              null,
          };
        }

        return {
          index,

          trait_type:
            `Trait ${
              index + 1
            }`,

          value:
            item,

          value_text:
            asText(
              item,
            ),

          display_type:
            null,
        };
      },
    )
    .filter(
      (trait) =>
        trait.trait_type
          .trim()
          .length > 0,
    );
}

/* =========================================================
   SUPABASE
========================================================= */

function supabaseHeaders(
  extra = {},
) {
  return {
    apikey:
      SERVICE_KEY,

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
  const MAX_ATTEMPTS = 7;

  for (
    let attempt = 1;
    attempt <=
    MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      const response =
        await fetch(
          url,
          {
            ...init,

            headers:
              supabaseHeaders(
                init.headers ||
                  {},
              ),
          },
        );

      const text =
        await response.text();

      if (response.ok) {
        return {
          response,

          text,

          data:
            parseJson &&
            text
              ? JSON.parse(
                  text,
                )
              : null,
        };
      }

      const jwtFuture =
        response.status ===
          401 &&
        text.includes(
          "JWT issued at future",
        );

      const retryable =
        jwtFuture ||
        response.status ===
          408 ||
        response.status ===
          425 ||
        response.status ===
          429 ||
        response.status >=
          500;

      if (
        retryable &&
        attempt <
          MAX_ATTEMPTS
      ) {
        let waitMs;

        if (jwtFuture) {
          waitMs =
            Math.min(
              60000,
              12000 *
                attempt,
            );
        } else {
          waitMs =
            Math.min(
              20000,
              1000 *
                2 **
                  (attempt -
                    1),
            );
        }

        console.warn(
          `Supabase ${
            response.status
          } attempt ${attempt}/${MAX_ATTEMPTS}` +
            `${
              jwtFuture
                ? " · JWT clock skew"
                : ""
            }` +
            ` · retry in ${Math.round(
              waitMs /
                1000,
            )}s`,
        );

        await sleep(
          waitMs,
        );

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
        attempt >=
        MAX_ATTEMPTS
      ) {
        throw error;
      }

      const waitMs =
        Math.min(
          20000,
          1000 *
            2 **
              (attempt - 1),
        );

      console.warn(
        `Supabase network error attempt ${attempt}/${MAX_ATTEMPTS}: ` +
          `${message.slice(
            0,
            180,
          )}` +
          ` · retry in ${Math.round(
            waitMs /
              1000,
          )}s`,
      );

      await sleep(
        waitMs,
      );
    }
  }

  throw new Error(
    "Supabase retries exhausted",
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
        parseJson:
          true,
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
      method:
        "POST",

      body:
        JSON.stringify(
          body,
        ),
    },
  );
}

/* =========================================================
   LOAD SUPABASE COLLECTION
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
          parseJson:
            true,
        },
      );

    const page =
      Array.isArray(
        result.data,
      )
        ? result.data
        : [];

    rows.push(
      ...page,
    );

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

function metadataReady(
  row,
) {
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

function artworkReady(
  row,
) {
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
   IPFS
========================================================= */

function parseIpfs(
  value,
) {
  const uri =
    String(
      value || "",
    ).trim();

  let path = null;

  if (
    uri.startsWith(
      "ipfs://ipfs/",
    )
  ) {
    path =
      uri.slice(12);
  } else if (
    uri.startsWith(
      "ipfs://",
    )
  ) {
    path =
      uri.slice(7);
  }

  if (!path) {
    return null;
  }

  const slash =
    path.indexOf("/");

  const cid =
    slash === -1
      ? path
      : path.slice(
          0,
          slash,
        );

  return {
    cid,
    path,
  };
}

function rotateArray(
  array,
  amount,
) {
  if (!array.length) {
    return array;
  }

  const offset =
    ((amount %
      array.length) +
      array.length) %
    array.length;

  return [
    ...array.slice(
      offset,
    ),

    ...array.slice(
      0,
      offset,
    ),
  ];
}

function uriCandidates(
  value,
  gatewayRotation = 0,
) {
  const uri =
    String(
      value || "",
    ).trim();

  if (!uri) {
    return [];
  }

  if (
    /^https?:\/\//i.test(
      uri,
    ) ||
    uri.startsWith(
      "data:",
    )
  ) {
    return [uri];
  }

  if (
    uri.startsWith(
      "ar://",
    )
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

  const gateways =
    rotateArray(
      IPFS_GATEWAYS,
      gatewayRotation,
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
    typeof value !==
      "string" ||
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
   GENERAL FETCH TIMEOUT
========================================================= */

async function fetchWithTimeout(
  url,
  init = {},
  timeoutMs,
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
    clearTimeout(
      timer,
    );
  }
}

/* =========================================================
   METADATA FETCH
========================================================= */

async function fetchMetadata(
  tokenUri,
  tokenId,
  passNumber = 0,
) {
  if (
    tokenUri.startsWith(
      "data:application/json",
    )
  ) {
    const comma =
      tokenUri.indexOf(
        ",",
      );

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
        JSON.parse(
          text,
        ),

      metadataUri:
        tokenUri,
    };
  }

  const candidates =
    uriCandidates(
      tokenUri,
      Number(tokenId) +
        passNumber,
    );

  let lastError =
    new Error(
      "metadata unavailable",
    );

  for (
    const url
    of candidates
  ) {
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
        lastError =
          new Error(
            `${response.status} ${url}`,
          );

        continue;
      }

      const text =
        await response.text();

      const metadata =
        JSON.parse(
          text,
        );

      if (
        metadata &&
        typeof metadata ===
          "object"
      ) {
        return {
          metadata,

          metadataUri:
            url,
        };
      }

      lastError =
        new Error(
          `Invalid metadata from ${url}`,
        );
    } catch (error) {
      lastError =
        error;
    }
  }

  throw lastError;
}

/* =========================================================
   IMAGE DOWNLOAD
========================================================= */

const CID_GATEWAY =
  new Map();

function contentTypeToExt(
  contentType,
) {
  switch (
    contentType
  ) {
    case "image/jpeg":
      return "jpg";

    case "image/webp":
      return "webp";

    case "image/gif":
      return "gif";

    case "image/svg+xml":
      return "svg";

    default:
      return "png";
  }
}

function gatewayFromImageUrl(
  url,
  parsed,
) {
  if (!parsed) {
    return null;
  }

  if (
    !url.endsWith(
      parsed.path,
    )
  ) {
    return null;
  }

  return url.slice(
    0,
    url.length -
      parsed.path.length,
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

  const cancel = () =>
    controller.abort(
      new Error(
        "cancelled after gateway winner",
      ),
    );

  if (parentSignal) {
    if (
      parentSignal.aborted
    ) {
      cancel();
    } else {
      parentSignal.addEventListener(
        "abort",
        cancel,
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
        `HTTP ${
          response.status
        } @ ${url}`,
      );
    }

    const contentType = (
      response.headers.get(
        "content-type",
      ) || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (
      !contentType.startsWith(
        "image/",
      )
    ) {
      throw new Error(
        `Not an image (${contentType}) @ ${url}`,
      );
    }

    const declaredBytes =
      Number(
        response.headers.get(
          "content-length",
        ) || 0,
      );

    if (
      declaredBytes >
      MAX_IMAGE_BYTES
    ) {
      throw new Error(
        "Image exceeds configured size limit",
      );
    }

    const bytes =
      Buffer.from(
        await response.arrayBuffer(),
      );

    if (!bytes.length) {
      throw new Error(
        "Empty image",
      );
    }

    if (
      bytes.length >
      MAX_IMAGE_BYTES
    ) {
      throw new Error(
        "Image exceeds configured size limit",
      );
    }

    return {
      bytes,

      contentType,

      url,
    };
  } finally {
    clearTimeout(
      timer,
    );

    if (parentSignal) {
      parentSignal.removeEventListener(
        "abort",
        cancel,
      );
    }
  }
}

async function raceImageCandidates(
  candidates,
) {
  let lastError =
    new Error(
      "No gateway succeeded",
    );

  for (
    let index = 0;
    index <
    candidates.length;
    index +=
      IMAGE_RACE_WIDTH
  ) {
    const batch =
      candidates.slice(
        index,
        index +
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

      controller.abort();

      return winner;
    } catch (error) {
      controller.abort();

      if (
        Array.isArray(
          error?.errors,
        ) &&
        error.errors.length
      ) {
        lastError =
          error.errors[
            error.errors.length -
              1
          ];
      }
    }
  }

  throw lastError;
}

async function downloadArtwork(
  imageUri,
  metadataUri,
  tokenUri,
  passNumber,
) {
  const resolved =
    resolveRelative(
      imageUri,
      metadataUri ||
        tokenUri,
    );

  if (!resolved) {
    throw new Error(
      "No artwork URI",
    );
  }

  const parsed =
    parseIpfs(
      resolved,
    );

  /*
   * FIRST:
   * If this CID already succeeded through a
   * gateway, give that gateway one direct try.
   */
  if (parsed) {
    const learned =
      CID_GATEWAY.get(
        parsed.cid,
      );

    if (learned) {
      try {
        return await fetchImageCandidate(
          `${learned}${parsed.path}`,
        );
      } catch {
        CID_GATEWAY.delete(
          parsed.cid,
        );
      }
    }
  }

  const candidates =
    uriCandidates(
      resolved,
      passNumber,
    );

  if (
    !candidates.length
  ) {
    throw new Error(
      "No artwork gateway candidates",
    );
  }

  const winner =
    await raceImageCandidates(
      candidates,
    );

  if (parsed) {
    const gateway =
      gatewayFromImageUrl(
        winner.url,
        parsed,
      );

    if (gateway) {
      CID_GATEWAY.set(
        parsed.cid,
        gateway,
      );
    }
  }

  return winner;
}

/* =========================================================
   ART CACHE
========================================================= */

async function markArtFailure(
  tokenId,
  error,
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
          error,
        ).slice(
          0,
          500,
        ),
    },
  ).catch(
    () => {},
  );
}

async function uploadArtwork(
  item,
  passNumber,
) {
  const {
    tokenId,
    image,
    metadataUri,
    tokenUri,
  } = item;

  let fetched;

  try {
    fetched =
      await downloadArtwork(
        image,
        metadataUri,
        tokenUri,
        passNumber,
      );
  } catch (error) {
    await markArtFailure(
      tokenId,
      error?.message ||
        error,
    );

    throw error;
  }

  const {
    bytes,
    contentType,
  } = fetched;

  const extension =
    contentTypeToExt(
      contentType,
    );

  const storagePath =
    `canonical/${tokenId}.${extension}`;

  const upload =
    await supabaseFetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,

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
    !upload.response.ok
  ) {
    throw new Error(
      `Storage upload failed ${upload.response.status}`,
    );
  }

  const publicUrl =
    `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

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
        storagePath,

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
   POOL
========================================================= */

async function runPool(
  items,
  workerCount,
  handler,
) {
  if (!items.length) {
    return;
  }

  let cursor = 0;

  async function worker() {
    while (
      cursor <
      items.length
    ) {
      const index =
        cursor++;

      const item =
        items[index];

      await handler(
        item,
      );
    }
  }

  const actualWorkers =
    Math.min(
      workerCount,
      items.length,
    );

  await Promise.all(
    Array.from(
      {
        length:
          actualWorkers,
      },

      () => worker(),
    ),
  );
}

/* =========================================================
   AUDIT
========================================================= */

async function audit() {
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

  const missingMetadata =
    [];

  const pendingArt =
    [];

  let complete = 0;

  for (
    const tokenId
    of EXPECTED_IDS
  ) {
    const row =
      rowMap.get(
        tokenId,
      );

    if (
      !metadataReady(
        row,
      )
    ) {
      missingMetadata.push(
        tokenId,
      );

      continue;
    }

    if (
      !artworkReady(
        row,
      )
    ) {
      pendingArt.push({
        tokenId,

        image:
          row.image_uri,

        metadataUri:
          row.metadata_uri,

        tokenUri:
          row.token_uri,
      });

      continue;
    }

    complete++;
  }

  return {
    rows,

    rowMap,

    complete,

    missingMetadata,

    pendingArt,
  };
}

/* =========================================================
   METADATA REPAIR
========================================================= */

async function repairMetadataToken(
  tokenId,
  passNumber,
) {
  const tokenUri =
    await client.readContract({
      address:
        COLLECTION,

      abi:
        ABI,

      functionName:
        "tokenURI",

      args: [
        BigInt(
          tokenId,
        ),
      ],
    });

  const {
    metadata,
    metadataUri,
  } =
    await fetchMetadata(
      String(
        tokenUri,
      ),

      tokenId,

      passNumber,
    );

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
        "repair-final-v2",

      p_traits:
        traits,
    },
  );

  return {
    tokenId,

    image,

    metadataUri,

    tokenUri:
      String(
        tokenUri,
      ),
  };
}

/* =========================================================
   VERIFY REVEAL
========================================================= */

const revealed =
  await client.readContract({
    address:
      COLLECTION,

    abi:
      ABI,

    functionName:
      "revealed",
  });

if (!revealed) {
  console.error(
    "Canonical collection reports revealed=false.",
  );

  process.exit(1);
}

/* =========================================================
   START
========================================================= */

console.log("");
console.log(
  "══════════════════════════════════════════",
);

console.log(
  " TOBYWORLD FINAL LORE REPAIR",
);

console.log(
  "══════════════════════════════════════════",
);

console.log(
  `Expected minted: ${EXPECTED_TOTAL}`,
);

console.log(
  `Metadata workers: ${METADATA_WORKERS}`,
);

console.log(
  `Artwork workers: ${ART_WORKERS}`,
);

console.log(
  `Repair passes: ${REPAIR_PASSES}`,
);

console.log(
  `Metadata timeout: ${META_TIMEOUT}ms`,
);

console.log(
  `Artwork timeout: ${IMAGE_TIMEOUT}ms`,
);

console.log(
  `Gateway race width: ${IMAGE_RACE_WIDTH}`,
);

console.log(
  `IPFS gateways: ${IPFS_GATEWAYS.length}`,
);

console.log("");

let totalMetadataRepaired =
  0;

let totalArtworkRepaired =
  0;

/* =========================================================
   MULTI-PASS REPAIR
========================================================= */

for (
  let pass = 0;
  pass <
  REPAIR_PASSES;
  pass++
) {
  const passNumber =
    pass + 1;

  console.log("");
  console.log(
    `──── REPAIR PASS ${passNumber}/${REPAIR_PASSES} ────`,
  );

  const before =
    await audit();

  console.log(
    `Complete: ${before.complete}/${EXPECTED_TOTAL}`,
  );

  console.log(
    `Metadata missing: ${before.missingMetadata.length}`,
  );

  console.log(
    `Artwork pending: ${before.pendingArt.length}`,
  );

  if (
    before.complete ===
    EXPECTED_TOTAL
  ) {
    console.log(
      "Collection already fully cached.",
    );

    break;
  }

  /* -------------------------
     Metadata
  ------------------------- */

  const newArtworkItems =
    [];

  if (
    before
      .missingMetadata
      .length
  ) {
    console.log("");
    console.log(
      `Repairing ${before.missingMetadata.length} metadata record(s)...`,
    );

    await runPool(
      before.missingMetadata,

      METADATA_WORKERS,

      async (
        tokenId,
      ) => {
        try {
          const item =
            await repairMetadataToken(
              tokenId,

              pass,
            );

          totalMetadataRepaired++;

          console.log(
            `#${tokenId} METADATA repaired`,
          );

          if (
            item.image
          ) {
            newArtworkItems.push(
              item,
            );
          }
        } catch (error) {
          console.warn(
            `#${tokenId} METADATA pending: ${String(
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
  }

  /* -------------------------
     Artwork
  ------------------------- */

  const artMap =
    new Map();

  for (
    const item
    of [
      ...before.pendingArt,
      ...newArtworkItems,
    ]
  ) {
    artMap.set(
      item.tokenId,
      item,
    );
  }

  const artworkItems =
    [
      ...artMap.values(),
    ];

  /*
   * Keep same-CID artwork close together
   * so learned gateways are useful.
   */
  artworkItems.sort(
    (
      first,
      second,
    ) => {
      const firstCid =
        parseIpfs(
          first.image,
        )?.cid || "";

      const secondCid =
        parseIpfs(
          second.image,
        )?.cid || "";

      return (
        firstCid.localeCompare(
          secondCid,
        ) ||
        first.tokenId -
          second.tokenId
      );
    },
  );

  if (
    artworkItems.length
  ) {
    console.log("");
    console.log(
      `Repairing ${artworkItems.length} artwork item(s)...`,
    );

    await runPool(
      artworkItems,

      ART_WORKERS,

      async (item) => {
        try {
          await uploadArtwork(
            item,
            pass,
          );

          totalArtworkRepaired++;

          const cid =
            parseIpfs(
              item.image,
            )?.cid;

          const learned =
            cid
              ? CID_GATEWAY.get(
                  cid,
                )
              : null;

          console.log(
            `#${item.tokenId} ART repaired` +
              `${
                learned
                  ? ` · ${new URL(
                      learned,
                    ).hostname}`
                  : ""
              }`,
          );
        } catch (error) {
          console.warn(
            `#${item.tokenId} ART pending: ${String(
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
  }

  const after =
    await audit();

  console.log("");
  console.log(
    `Pass ${passNumber} result:`,
  );

  console.log(
    `  Complete: ${after.complete}/${EXPECTED_TOTAL}`,
  );

  console.log(
    `  Metadata missing: ${after.missingMetadata.length}`,
  );

  console.log(
    `  Artwork pending: ${after.pendingArt.length}`,
  );

  if (
    after.complete ===
    EXPECTED_TOTAL
  ) {
    break;
  }

  /*
   * Don't immediately hammer the same
   * gateway/CID again.
   */
  if (
    passNumber <
    REPAIR_PASSES
  ) {
    console.log(
      "Cooling down 8 seconds before next pass...",
    );

    await sleep(
      8000,
    );
  }
}

/* =========================================================
   FINAL AUDIT
========================================================= */

const finalAudit =
  await audit();

console.log("");
console.log(
  "════════ FINAL REPAIR REPORT ════════",
);

console.log(
  `Complete collection: ${finalAudit.complete}/${EXPECTED_TOTAL}`,
);

console.log(
  `Metadata repaired during job: ${totalMetadataRepaired}`,
);

console.log(
  `Artwork repaired during job: ${totalArtworkRepaired}`,
);

console.log(
  `Metadata still missing: ${finalAudit.missingMetadata.length}`,
);

console.log(
  `Artwork still pending: ${finalAudit.pendingArt.length}`,
);

if (
  finalAudit
    .missingMetadata
    .length
) {
  console.log("");

  console.log(
    "Remaining metadata IDs:",
  );

  console.log(
    finalAudit.missingMetadata.join(
      ",",
    ),
  );
}

if (
  finalAudit
    .pendingArt
    .length
) {
  console.log("");

  console.log(
    "Remaining artwork IDs:",
  );

  console.log(
    finalAudit.pendingArt
      .map(
        (item) =>
          item.tokenId,
      )
      .join(","),
  );
}

if (
  CID_GATEWAY.size
) {
  console.log("");
  console.log(
    "Successful gateways learned:",
  );

  for (
    const [
      cid,
      gateway,
    ]
    of CID_GATEWAY.entries()
  ) {
    console.log(
      `${cid} -> ${gateway}`,
    );
  }
}

console.log("");
console.log(
  "══════════════════════════════════════",
);

/*
 * IMPORTANT:
 *
 * Do NOT make GitHub Actions red just
 * because an external IPFS file is still
 * temporarily unavailable.
 *
 * A successful execution exits 0 and
 * reports any remaining records.
 */
process.exitCode = 0;
