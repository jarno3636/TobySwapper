import { NextResponse } from "next/server";
import {
  createPublicClient,
  getAddress,
  http,
} from "viem";
import { base } from "viem/chains";

import {
  KEEPER_OF_TOBY,
  keeperOfTobyAbi,
  resolveKeeperUri,
} from "@/lib/keeper-of-toby";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = createPublicClient({
  chain: base,
  transport: http(
    process.env.BASE_RPC_URL ||
      process.env.NEXT_PUBLIC_BASE_RPC_URL ||
      "https://mainnet.base.org",
    {
      retryCount: 2,
      timeout: 15_000,
    },
  ),
});

type ExistingRow = {
  token_id: number | string;
  wallet_address: string;
};

type StateRow = {
  last_scanned_block?: number | string | null;
};

function authorized(request: Request) {
  const configured = process.env.KEEPER_SYNC_SECRET || "";
  if (!configured) return false;

  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${configured}`;
}

async function metadataFor(tokenUri: string) {
  const url = resolveKeeperUri(tokenUri);
  if (!url) return { imageUri: null, imageUrl: null };

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(9_000),
    });

    if (!response.ok) return { imageUri: null, imageUrl: null };

    const json = await response.json();
    const imageUri =
      typeof json?.image === "string" ? json.image.trim() : null;

    return {
      imageUri,
      imageUrl: resolveKeeperUri(imageUri),
    };
  } catch {
    return { imageUri: null, imageUrl: null };
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!hasSupabaseServerEnv()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  try {
    const [
      totalMintedRaw,
      metadataFrozen,
      baseUri,
      contractUri,
      artist,
      commissionedBy,
      latestBlock,
      stateRows,
      existingRows,
    ] = await Promise.all([
      client.readContract({
        address: KEEPER_OF_TOBY,
        abi: keeperOfTobyAbi,
        functionName: "totalMinted",
      }),
      client.readContract({
        address: KEEPER_OF_TOBY,
        abi: keeperOfTobyAbi,
        functionName: "metadataFrozen",
      }),
      client.readContract({
        address: KEEPER_OF_TOBY,
        abi: keeperOfTobyAbi,
        functionName: "baseURI",
      }),
      client.readContract({
        address: KEEPER_OF_TOBY,
        abi: keeperOfTobyAbi,
        functionName: "contractURI",
      }),
      client.readContract({
        address: KEEPER_OF_TOBY,
        abi: keeperOfTobyAbi,
        functionName: "artist",
      }),
      client.readContract({
        address: KEEPER_OF_TOBY,
        abi: keeperOfTobyAbi,
        functionName: "commissionedBy",
      }),
      client.getBlockNumber(),
      supabaseRest<StateRow[]>(
        "tobyswap_keeper_of_toby_state?id=eq.1&select=last_scanned_block&limit=1",
      ).catch(() => []),
      supabaseRest<ExistingRow[]>(
        "tobyswap_keeper_of_toby?select=token_id,wallet_address&order=token_id.asc&limit=111",
      ).catch(() => []),
    ]);

    const totalMinted = Number(totalMintedRaw);
    const existingById = new Map(
      existingRows.map((row) => [Number(row.token_id), row]),
    );

    const calls = [];
    for (let tokenId = 1; tokenId <= totalMinted; tokenId += 1) {
      calls.push(
        {
          address: KEEPER_OF_TOBY,
          abi: keeperOfTobyAbi,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        } as const,
        {
          address: KEEPER_OF_TOBY,
          abi: keeperOfTobyAbi,
          functionName: "tokenURI",
          args: [BigInt(tokenId)],
        } as const,
      );
    }

    const results = calls.length
      ? await client.multicall({
          contracts: calls,
          allowFailure: true,
        })
      : [];

    const lastScanned = BigInt(
      stateRows[0]?.last_scanned_block ||
        process.env.KEEPER_DEPLOYMENT_BLOCK ||
        latestBlock,
    );

    const namedAtById = new Map<number, string>();

    // Exact mint times are captured from KeeperNamed events once a starting
    // block is known. If the first sync has no KEEPER_DEPLOYMENT_BLOCK, existing
    // historical rows remain without named_at; all future mints are timestamped.
    if (lastScanned <= latestBlock) {
      const logs = await client.getLogs({
        address: KEEPER_OF_TOBY,
        event: keeperOfTobyAbi.find(
          (item) => item.type === "event" && item.name === "KeeperNamed",
        ) as any,
        fromBlock: lastScanned,
        toBlock: latestBlock,
      }).catch(() => []);

      const blockTimes = new Map<bigint, string>();

      for (const log of logs as any[]) {
        const tokenId = Number(log?.args?.tokenId || 0n);
        if (!tokenId || !log.blockNumber) continue;

        let iso = blockTimes.get(log.blockNumber);

        if (!iso) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          iso = new Date(Number(block.timestamp) * 1000).toISOString();
          blockTimes.set(log.blockNumber, iso);
        }

        namedAtById.set(tokenId, iso);
      }
    }

    let heroImageUrl: string | null = null;
    let synced = 0;

    for (let tokenId = 1; tokenId <= totalMinted; tokenId += 1) {
      const ownerResult = results[(tokenId - 1) * 2];
      const uriResult = results[(tokenId - 1) * 2 + 1];

      if (ownerResult?.status !== "success") continue;
      if (uriResult?.status !== "success") continue;

      const walletAddress = getAddress(String(ownerResult.result)).toLowerCase();
      const tokenUri = String(uriResult.result || "");
      const isNew = !existingById.has(tokenId);

      let imageUri: string | null = null;
      let imageUrl: string | null = null;

      if (isNew || tokenId === 1) {
        const metadata = await metadataFor(tokenUri);
        imageUri = metadata.imageUri;
        imageUrl = metadata.imageUrl;
      }

      if (!heroImageUrl && imageUrl) heroImageUrl = imageUrl;

      const payload: Record<string, unknown> = {
        token_id: tokenId,
        wallet_address: walletAddress,
        token_uri: tokenUri || null,
        synced_at: new Date().toISOString(),
      };

      if (imageUri) payload.image_uri = imageUri;
      if (imageUrl) payload.image_url = imageUrl;
      if (namedAtById.has(tokenId)) payload.named_at = namedAtById.get(tokenId);

      await supabaseRest("tobyswap_keeper_of_toby?on_conflict=token_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: JSON.stringify(payload),
      });

      synced += 1;
    }

    if (!heroImageUrl) {
      const heroRows = await supabaseRest<Array<{ image_url: string | null }>>(
        "tobyswap_keeper_of_toby?image_url=not.is.null&select=image_url&order=token_id.asc&limit=1",
      ).catch(() => []);
      heroImageUrl = heroRows[0]?.image_url || null;
    }

    await supabaseRest("tobyswap_keeper_of_toby_state?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({
        id: 1,
        total_minted: totalMinted,
        metadata_frozen: Boolean(metadataFrozen),
        base_uri: String(baseUri || "") || null,
        contract_uri: String(contractUri || "") || null,
        hero_image_url: heroImageUrl,
        artist: String(artist || "nova100x"),
        commissioned_by: String(commissionedBy || "ToadGod"),
        last_scanned_block: latestBlock.toString(),
        synced_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({
      ok: true,
      totalMinted,
      synced,
      latestBlock: latestBlock.toString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Keeper sync failed." },
      { status: 500 },
    );
  }
}
