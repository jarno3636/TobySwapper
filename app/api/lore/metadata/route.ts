import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";

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

function uriCandidates(value: string) {
  const uri = value.trim();
  if (!uri) return [];
  if (uri.startsWith("data:") || uri.startsWith("https://") || uri.startsWith("http://")) {
    return [uri];
  }
  if (uri.startsWith("ar://")) return [`https://arweave.net/${uri.slice(5)}`];

  const path =
    uri.startsWith("ipfs://ipfs/")
      ? uri.slice(12)
      : uri.startsWith("ipfs://")
        ? uri.slice(7)
        : null;

  if (!path) return [uri];

  // Different public gateways fail independently. Server-side fetch also avoids
  // browser CORS rules that can block otherwise valid NFT metadata.
  return [
    `https://dweb.link/ipfs/${path}`,
    `https://ipfs.io/ipfs/${path}`,
    `https://gateway.pinata.cloud/ipfs/${path}`,
  ];
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
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isImageUri(uri: string, contentType?: string | null) {
  if (contentType?.toLowerCase().startsWith("image/")) return true;
  if (uri.startsWith("data:image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(uri);
}

export async function GET(request: NextRequest) {
  const tokenIdText = request.nextUrl.searchParams.get("tokenId") || "";
  const revealRefresh = request.nextUrl.searchParams.get("reveal") === "1";
  const cacheHeader = revealRefresh
    ? "no-store, max-age=0"
    : "public, s-maxage=300, stale-while-revalidate=900";

  if (!/^\d+$/.test(tokenIdText)) {
    return NextResponse.json({ error: "Invalid tokenId." }, { status: 400 });
  }

  const tokenId = BigInt(tokenIdText);

  // Canonical ids are inherited from the 1..4000 Lore partition.
  if (tokenId < 1n || tokenId > 4000n) {
    return NextResponse.json({ error: "Lore tokenId out of range." }, { status: 400 });
  }

  try {
    const tokenUri = await client.readContract({
      address: LORE_COLLECTION_ADDRESS,
      abi: LORE_DEEDS_ABI,
      functionName: "tokenURI",
      args: [tokenId],
    });

    if (typeof tokenUri !== "string" || !tokenUri.trim()) {
      return NextResponse.json(
        { tokenId: tokenIdText, tokenUri: null, metadata: null, image: null, error: "No token URI returned." },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
      );
    }

    if (tokenUri.startsWith("data:application/json")) {
      const metadata = decodeInlineJson(tokenUri);
      return NextResponse.json(
        { tokenId: tokenIdText, tokenUri, metadata, image: metadata?.image || metadata?.image_url || metadata?.imageUrl || null, source: "inline" },
        { headers: { "Cache-Control": cacheHeader } },
      );
    }

    if (isImageUri(tokenUri)) {
      return NextResponse.json(
        { tokenId: tokenIdText, tokenUri, metadata: null, image: tokenUri, source: "direct-image" },
        { headers: { "Cache-Control": cacheHeader } },
      );
    }

    let lastError = "Metadata could not be loaded.";

    for (const candidate of uriCandidates(tokenUri)) {
      try {
        const requestUri = revealRefresh && /^https?:\/\//i.test(candidate)
          ? `${candidate}${candidate.includes("?") ? "&" : "?"}tobyswap_reveal=1`
          : candidate;
        const response = await fetch(requestUri, {
          headers: { accept: "application/json,image/*;q=0.9,*/*;q=0.5" },
          // This route is only a fallback for gateways that block browser CORS.
          // Do not let a pre-reveal gateway response sit in Next's data cache.
          cache: "no-store",
        });

        if (!response.ok) {
          lastError = `Metadata source returned ${response.status}.`;
          continue;
        }

        const contentType = response.headers.get("content-type");
        if (isImageUri(candidate, contentType)) {
          return NextResponse.json(
            { tokenId: tokenIdText, tokenUri, metadataUri: candidate, metadata: null, image: candidate, source: "direct-image" },
            { headers: { "Cache-Control": cacheHeader } },
          );
        }

        const text = await response.text();
        const metadata = JSON.parse(text);
        if (!metadata || typeof metadata !== "object") continue;

        return NextResponse.json(
          {
            tokenId: tokenIdText,
            tokenUri,
            metadataUri: candidate,
            metadata,
            image: metadata.image || metadata.image_url || metadata.imageUrl || null,
            source: "metadata",
          },
          { headers: { "Cache-Control": cacheHeader } },
        );
      } catch (error: any) {
        lastError = String(error?.message || "Metadata source failed.").slice(0, 160);
      }
    }

    return NextResponse.json(
      { tokenId: tokenIdText, tokenUri, metadata: null, image: null, error: lastError },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: String(error?.shortMessage || error?.message || "Lore read failed.").slice(0, 180) },
      { status: 502, headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }
}
