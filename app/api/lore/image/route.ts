import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";
import { fetchWithTimeout, ipfsCandidates } from "@/lib/ipfs-gateways";

import {
  LORE_COLLECTION_ADDRESS,
  LORE_DEEDS_ABI,
} from "@/lib/lore-deeds";

import {
  extractLoreTraits,
  normalizeLoreMetadata,
  resolveMetadataAssetUri,
} from "@/lib/lore-metadata-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const endpoints = [
  process.env.BASE_RPC_URL,
  process.env.NEXT_PUBLIC_BASE_RPC_URL,
  "https://mainnet.base.org",
].filter((value): value is string => Boolean(value));

const client = createPublicClient({
  chain: base,
  transport: fallback(
    endpoints.map((url) =>
      http(url, {
        batch: true,
        retryCount: 1,
        retryDelay: 200,
        timeout: 8_000,
      }),
    ),
  ),
});

function candidates(value: string) {
  return ipfsCandidates(value);
}

function decodeInlineJson(uri: string) {
  try {
    const comma = uri.indexOf(",");

    if (comma < 0) return null;

    const header = uri.slice(0, comma);
    const raw = uri.slice(comma + 1);

    const text = /;base64/i.test(header)
      ? Buffer.from(raw, "base64").toString("utf8")
      : decodeURIComponent(raw);

    const parsed = JSON.parse(text);

    return parsed && typeof parsed === "object"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function imageField(metadata: any) {
  return (
    metadata?.image ||
    metadata?.image_url ||
    metadata?.imageUrl ||
    null
  );
}

function hasTraits(metadata: any) {
  return extractLoreTraits(metadata).length > 0;
}

function looksPreReveal(metadata: any) {
  if (!metadata || typeof metadata !== "object") {
    return true;
  }

  const text =
    `${metadata.name || ""} ${metadata.description || ""}`.toLowerCase();

  return (
    !hasTraits(metadata) ||
    /sealed|behind the veil|waits behind|unrevealed|not revealed|landscape still waits/.test(
      text,
    )
  );
}

function isDirectImage(value: string) {
  return (
    value.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(value)
  );
}

async function resolveMetadata(
  tokenUri: string,
  revealed: boolean,
) {
  if (tokenUri.startsWith("data:application/json")) {
    return normalizeLoreMetadata(
      decodeInlineJson(tokenUri),
      tokenUri,
      tokenUri,
    );
  }

  if (isDirectImage(tokenUri)) {
    return {
      image: tokenUri,
    };
  }

  for (const uri of candidates(tokenUri)) {
    try {
      const requestUri =
        revealed && /^https?:\/\//i.test(uri)
          ? `${uri}${uri.includes("?") ? "&" : "?"}tobyswap_reveal=${Date.now()}`
          : uri;

      const response = await fetchWithTimeout(requestUri, {
        headers: {
          accept: "application/json,*/*;q=0.5",
          "cache-control": "no-cache",
        },
        cache: "no-store",
      }, 4_500);

      if (!response.ok) continue;

      const contentType =
        response.headers.get("content-type") || "";

      if (
        contentType
          .toLowerCase()
          .startsWith("image/")
      ) {
        return {
          image: uri,
        };
      }

      const text = await response.text();

      try {
        const parsed = JSON.parse(text);

        if (
          parsed &&
          typeof parsed === "object"
        ) {
          const normalized =
            normalizeLoreMetadata(
              parsed,
              uri,
              tokenUri,
            );

          if (
            revealed &&
            looksPreReveal(normalized)
          ) {
            continue;
          }

          return normalized;
        }
      } catch {
        // Try the next gateway.
      }
    } catch {
      // Try the next gateway.
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
) {
  const tokenIdText =
    request.nextUrl.searchParams.get(
      "tokenId",
    ) || "";

  if (!/^\d+$/.test(tokenIdText)) {
    return NextResponse.json(
      {
        error: "Invalid tokenId.",
      },
      {
        status: 400,
      },
    );
  }

  const tokenId = BigInt(tokenIdText);

  if (
    tokenId < 1n ||
    tokenId > 4000n
  ) {
    return NextResponse.json(
      {
        error:
          "Lore tokenId out of range.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const [
      revealedRaw,
      unrevealedUriRaw,
      tokenUriRaw,
    ] = await Promise.all([
      client.readContract({
        address:
          LORE_COLLECTION_ADDRESS,
        abi: LORE_DEEDS_ABI,
        functionName: "revealed",
      }),

      client.readContract({
        address:
          LORE_COLLECTION_ADDRESS,
        abi: LORE_DEEDS_ABI,
        functionName:
          "unrevealedURI",
      }),

      client.readContract({
        address:
          LORE_COLLECTION_ADDRESS,
        abi: LORE_DEEDS_ABI,
        functionName: "tokenURI",
        args: [tokenId],
      }),
    ]);

    const revealed =
      revealedRaw === true;

    const tokenUri =
      typeof tokenUriRaw === "string"
        ? tokenUriRaw.trim()
        : "";

    const unrevealedUri =
      typeof unrevealedUriRaw ===
      "string"
        ? unrevealedUriRaw.trim()
        : "";

    if (!tokenUri) {
      return NextResponse.json(
        {
          error: "No token URI.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    if (
      revealed &&
      unrevealedUri &&
      tokenUri === unrevealedUri
    ) {
      return NextResponse.json(
        {
          error:
            "Reveal is live but tokenURI still equals unrevealedURI.",
        },
        {
          status: 409,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    const metadata =
      await resolveMetadata(
        tokenUri,
        revealed,
      );

    const rawImage =
      resolveMetadataAssetUri(
        imageField(metadata),
        null,
        tokenUri,
      );

    if (
      typeof rawImage !== "string" ||
      !rawImage.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "No image in canonical metadata.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Inline artwork has to be returned
     * directly because there is no remote
     * destination to redirect the browser to.
     */
    if (
      rawImage.startsWith(
        "data:image/",
      )
    ) {
      const comma =
        rawImage.indexOf(",");

      if (comma < 0) {
        return NextResponse.json(
          {
            error:
              "Invalid inline image.",
          },
          {
            status: 404,
          },
        );
      }

      const header =
        rawImage.slice(0, comma);

      const raw =
        rawImage.slice(comma + 1);

      const mime =
        header.match(
          /^data:([^;,]+)/i,
        )?.[1] || "image/png";

      const bytes =
        /;base64/i.test(header)
          ? Buffer.from(
              raw,
              "base64",
            )
          : Buffer.from(
              decodeURIComponent(raw),
              "utf8",
            );

      return new NextResponse(
        bytes,
        {
          headers: {
            "Content-Type": mime,

            "Cache-Control":
              revealed
                ? "public, s-maxage=3600, stale-while-revalidate=86400"
                : "public, s-maxage=300, stale-while-revalidate=3600",
          },
        },
      );
    }

    /*
     * IMPORTANT:
     *
     * Canonical Lore artwork is NOT copied
     * into Supabase Storage anymore.
     *
     * We test the available canonical
     * gateway URLs and redirect the browser
     * directly to the first healthy one.
     *
     * That means the large image body travels:
     *
     * IPFS gateway -> browser
     *
     * instead of:
     *
     * IPFS -> Vercel -> Supabase -> browser
     *
     * or:
     *
     * IPFS -> Vercel -> browser
     */

    for (const uri of candidates(rawImage)) {
      try {
        if (
          !/^https?:\/\//i.test(uri)
        ) {
          continue;
        }

        /*
         * HEAD lets us check whether a
         * gateway is alive without pulling
         * the multi-megabyte artwork through
         * the Vercel function.
         */
        const response =
          await fetchWithTimeout(uri, {
            method: "HEAD",
            headers: {
              accept:
                "image/*,*/*;q=0.5",
            },
            cache: "no-store",
          }, 2_500);

        if (!response.ok) {
          continue;
        }

        return NextResponse.redirect(
          uri,
          {
            status: 307,
            headers: {
              "Cache-Control":
                revealed
                  ? "public, s-maxage=3600, stale-while-revalidate=86400"
                  : "public, s-maxage=300, stale-while-revalidate=3600",
            },
          },
        );
      } catch {
        // Try next gateway.
      }
    }

    /*
     * Some IPFS gateways don't implement
     * HEAD reliably even though GET works.
     *
     * Rather than proxying the whole image
     * through Vercel, fall back to the first
     * canonical gateway candidate and let
     * the browser request it directly.
     */

    const fallbackUri =
      candidates(rawImage).find(
        (uri) =>
          /^https?:\/\//i.test(uri),
      );

    if (fallbackUri) {
      return NextResponse.redirect(
        fallbackUri,
        {
          status: 307,
          headers: {
            "Cache-Control":
              revealed
                ? "public, s-maxage=3600, stale-while-revalidate=86400"
                : "public, s-maxage=300, stale-while-revalidate=3600",
          },
        },
      );
    }

    return NextResponse.json(
      {
        error:
          "Canonical image could not be resolved.",
      },
      {
        status: 502,
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: String(
          error?.shortMessage ||
            error?.message ||
            "Lore image failed.",
        ).slice(0, 180),
      },
      {
        status: 502,
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  }
}
