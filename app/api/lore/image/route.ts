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

function candidates(value: string) {
  const v = value.trim();
  if (!v) return [] as string[];
  if (v.startsWith("https://") || v.startsWith("http://") || v.startsWith("data:")) {
    return [v];
  }
  if (v.startsWith("ar://")) return [`https://arweave.net/${v.slice(5)}`];

  const path =
    v.startsWith("ipfs://ipfs/")
      ? v.slice(12)
      : v.startsWith("ipfs://")
        ? v.slice(7)
        : null;

  if (!path) return [v];

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

function imageField(metadata: any) {
  return metadata?.image || metadata?.image_url || metadata?.imageUrl || null;
}

function isDirectImage(value: string) {
  return value.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(value);
}

async function resolveMetadata(tokenUri: string) {
  if (tokenUri.startsWith("data:application/json")) {
    return decodeInlineJson(tokenUri);
  }

  if (isDirectImage(tokenUri)) {
    return { image: tokenUri };
  }

  for (const uri of candidates(tokenUri)) {
    try {
      const response = await fetch(uri, {
        headers: { accept: "application/json,*/*;q=0.5" },
        // Avoid pinning pre-reveal metadata inside Next's fetch cache. This
        // endpoint is only reached when direct client image loading has failed.
        cache: "no-store",
      });
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "";
      if (contentType.toLowerCase().startsWith("image/")) {
        return { image: uri };
      }

      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") return parsed;
      } catch {}
    } catch {}
  }

  return null;
}

export async function GET(request: NextRequest) {
  const tokenIdText = request.nextUrl.searchParams.get("tokenId") || "";

  if (!/^\d+$/.test(tokenIdText)) {
    return NextResponse.json({ error: "Invalid tokenId." }, { status: 400 });
  }

  const tokenId = BigInt(tokenIdText);
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
      return NextResponse.json({ error: "No token URI." }, { status: 404 });
    }

    const metadata = await resolveMetadata(tokenUri);
    const rawImage = imageField(metadata);

    if (typeof rawImage !== "string" || !rawImage.trim()) {
      return NextResponse.json({ error: "No image in canonical metadata." }, { status: 404 });
    }

    if (rawImage.startsWith("data:image/")) {
      const comma = rawImage.indexOf(",");
      if (comma < 0) return NextResponse.json({ error: "Invalid inline image." }, { status: 404 });

      const header = rawImage.slice(0, comma);
      const raw = rawImage.slice(comma + 1);
      const mime = header.match(/^data:([^;,]+)/i)?.[1] || "image/png";
      const bytes = /;base64/i.test(header)
        ? Buffer.from(raw, "base64")
        : Buffer.from(decodeURIComponent(raw), "utf8");

      return new NextResponse(bytes, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    }

    for (const uri of candidates(rawImage)) {
      try {
        const response = await fetch(uri, {
          headers: { accept: "image/*,*/*;q=0.5" },
          next: { revalidate: 86400 },
        });
        if (!response.ok) continue;

        const contentType = response.headers.get("content-type") || "image/png";
        const bytes = await response.arrayBuffer();

        return new NextResponse(bytes, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      } catch {}
    }

    return NextResponse.json({ error: "Canonical image could not be fetched." }, { status: 502 });
  } catch (error: any) {
    return NextResponse.json(
      { error: String(error?.shortMessage || error?.message || "Lore image failed.").slice(0, 180) },
      { status: 502, headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }
}
