import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { metadataHasLoreTraits, normalizeLoreMetadata } from "@/lib/lore-metadata-shared";
import { persistLoreMetadata } from "@/lib/lore-cache-server";

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
  if (!uri) return [] as string[];
  if (uri.startsWith("data:") || uri.startsWith("https://") || uri.startsWith("http://")) return [uri];
  if (uri.startsWith("ar://")) return [`https://arweave.net/${uri.slice(5)}`];

  const path = uri.startsWith("ipfs://ipfs/")
    ? uri.slice(12)
    : uri.startsWith("ipfs://")
      ? uri.slice(7)
      : null;

  if (!path) return [uri];

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

function looksPreReveal(metadata: any) {
  if (!metadata || typeof metadata !== "object") return true;
  const text = `${metadata.name || ""} ${metadata.description || ""}`.toLowerCase();
  return !metadataHasLoreTraits(metadata) || /sealed|behind the veil|waits behind|unrevealed|not revealed|landscape still waits/.test(text);
}

function responseHeaders(revealed: boolean, forceFresh: boolean) {
  if (revealed || forceFresh) return { "Cache-Control": "no-store, max-age=0" };
  return { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" };
}

function cacheBust(uri: string, forceFresh: boolean) {
  if (!forceFresh || !/^https?:\/\//i.test(uri)) return uri;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}tobyswap_reveal=${Date.now()}`;
}

export async function GET(request: NextRequest) {
  const tokenIdText = request.nextUrl.searchParams.get("tokenId") || "";
  const forceFresh = request.nextUrl.searchParams.get("fresh") === "1" || request.nextUrl.searchParams.get("reveal") === "1";

  if (!/^\d+$/.test(tokenIdText)) {
    return NextResponse.json({ error: "Invalid tokenId." }, { status: 400 });
  }

  const tokenId = BigInt(tokenIdText);
  if (tokenId < 1n || tokenId > 4000n) {
    return NextResponse.json({ error: "Lore tokenId out of range." }, { status: 400 });
  }

  try {
    const [revealedRaw, unrevealedUriRaw, tokenUriRaw] = await Promise.all([
      client.readContract({
        address: LORE_COLLECTION_ADDRESS,
        abi: LORE_DEEDS_ABI,
        functionName: "revealed",
      }),
      client.readContract({
        address: LORE_COLLECTION_ADDRESS,
        abi: LORE_DEEDS_ABI,
        functionName: "unrevealedURI",
      }),
      client.readContract({
        address: LORE_COLLECTION_ADDRESS,
        abi: LORE_DEEDS_ABI,
        functionName: "tokenURI",
        args: [tokenId],
      }),
    ]);

    const revealed = revealedRaw === true;
    const tokenUri = typeof tokenUriRaw === "string" ? tokenUriRaw.trim() : "";
    const unrevealedUri = typeof unrevealedUriRaw === "string" ? unrevealedUriRaw.trim() : "";
    const headers = responseHeaders(revealed, forceFresh);

    if (!tokenUri) {
      return NextResponse.json(
        { tokenId: tokenIdText, revealed, tokenUri: null, metadata: null, image: null, error: "No token URI returned." },
        { status: 502, headers },
      );
    }

    // Once reveal is live, the unrevealed URI is never a valid successful result.
    if (revealed && unrevealedUri && tokenUri === unrevealedUri) {
      return NextResponse.json(
        {
          tokenId: tokenIdText,
          revealed,
          tokenUri,
          unrevealedUri,
          metadata: null,
          image: null,
          error: "Reveal is live but tokenURI still equals unrevealedURI.",
        },
        { status: 409, headers },
      );
    }

    if (tokenUri.startsWith("data:application/json")) {
      const decoded = decodeInlineJson(tokenUri);
      const metadata = decoded ? normalizeLoreMetadata(decoded, tokenUri, tokenUri) : null;
      if (revealed && looksPreReveal(metadata)) {
        return NextResponse.json(
          { tokenId: tokenIdText, revealed, tokenUri, metadata: null, image: null, error: "Reveal is live but inline metadata still looks prereveal." },
          { status: 409, headers },
        );
      }
      if (metadata && revealed) {
        await persistLoreMetadata({ tokenId, tokenUri, metadataUri: tokenUri, metadata, revealed, source: "inline" });
      }
      return NextResponse.json(
        { tokenId: tokenIdText, revealed, tokenUri, metadata, image: metadata?.image || metadata?.image_url || metadata?.imageUrl || null, source: "inline" },
        { headers },
      );
    }

    if (isImageUri(tokenUri)) {
      return NextResponse.json(
        { tokenId: tokenIdText, revealed, tokenUri, metadata: null, image: tokenUri, source: "direct-image" },
        { headers },
      );
    }

    let lastError = "Metadata could not be loaded.";
    let staleMetadataSeen = false;

    for (const candidate of uriCandidates(tokenUri)) {
      try {
        const response = await fetch(cacheBust(candidate, revealed || forceFresh), {
          headers: { accept: "application/json,image/*;q=0.9,*/*;q=0.5", "cache-control": "no-cache" },
          cache: "no-store",
        });

        if (!response.ok) {
          lastError = `Metadata source returned ${response.status}.`;
          continue;
        }

        const contentType = response.headers.get("content-type");
        if (isImageUri(candidate, contentType)) {
          return NextResponse.json(
            { tokenId: tokenIdText, revealed, tokenUri, metadataUri: candidate, metadata: null, image: candidate, source: "direct-image" },
            { headers },
          );
        }

        const text = await response.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object") continue;
        const metadata = normalizeLoreMetadata(parsed, candidate, tokenUri);

        // Revealed() is authoritative. Never return a successful sealed/no-trait
        // payload after reveal; try the next gateway instead.
        if (revealed && looksPreReveal(metadata)) {
          staleMetadataSeen = true;
          lastError = "Gateway returned prereveal metadata after reveal.";
          continue;
        }

        if (revealed) {
          await persistLoreMetadata({
            tokenId,
            tokenUri,
            metadataUri: candidate,
            metadata,
            revealed,
            source: "canonical",
          });
        }

        return NextResponse.json(
          {
            tokenId: tokenIdText,
            revealed,
            tokenUri,
            metadataUri: candidate,
            metadata,
            image: metadata.image || metadata.image_url || metadata.imageUrl || null,
            source: "metadata",
          },
          { headers },
        );
      } catch (error: any) {
        lastError = String(error?.message || "Metadata source failed.").slice(0, 160);
      }
    }

    return NextResponse.json(
      {
        tokenId: tokenIdText,
        revealed,
        tokenUri,
        metadata: null,
        image: null,
        staleMetadataSeen,
        error: lastError,
      },
      { status: revealed ? 502 : 200, headers },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: String(error?.shortMessage || error?.message || "Lore read failed.").slice(0, 180) },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
