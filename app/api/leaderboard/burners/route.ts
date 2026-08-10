import { NextResponse } from "next/server";
import {
  decodeAbiParameters,
  formatUnits,
  getAddress,
  hexToBigInt,
  isAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { SWAPPER } from "@/lib/addresses";
import { burnerTitleForRank } from "@/lib/burnerRanks";
import { hasSupabaseServerEnv, supabaseRest, supabaseRpc } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEPLOYMENT_SCAN_BLOCK = BigInt(process.env.TOBYSWAP_DEPLOYMENT_BLOCK || "36000000");
const SWAP_SUMMARY_TOPIC = keccak256(
  stringToHex("SwapSummary(address,address,address,address,uint256,uint256,uint256,uint256)"),
);

const SWAP_SUMMARY_DATA = [
  { type: "address" },
  { type: "uint256" },
  { type: "uint256" },
  { type: "uint256" },
  { type: "uint256" },
] as const;

type RpcLog = {
  address: Address;
  topics: Hex[];
  data: Hex;
  blockNumber: Hex;
  transactionHash: Hex;
  logIndex: Hex;
};

type SwapLog = {
  args?: { user?: Address; tobyBurned?: bigint };
  blockNumber: bigint | null;
  transactionHash: `0x${string}` | null;
  logIndex: number | null;
};

type Burner = {
  address: Address;
  burned: bigint;
  swaps: number;
  lastBlock: bigint;
};

type StoredLeaderboardRow = {
  wallet_address: string;
  burned_raw: string | number;
  swaps: number | string;
  current_rank: number | string;
  current_title: string;
  best_rank: number | string | null;
  best_title: string | null;
  last_block: number | string | null;
  fid: number | string | null;
  username: string | null;
  display_name: string | null;
  pfp_url: string | null;
};

type SummaryRow = {
  unique_burners: number | string | null;
  swap_events: number | string | null;
  total_burned_raw: string | number | null;
};

type JsonRpcEnvelope<T> = {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: { code?: number; message?: string; data?: unknown };
};

function normalizeRpcCandidate(value?: string) {
  const clean = value?.trim();
  if (!clean) return undefined;
  if (/^https?:\/\//i.test(clean)) return clean;
  return undefined;
}

function rpcEndpoints() {
  const alchemyRaw = process.env.ALCHEMY_API_KEY?.trim();
  const alchemy = alchemyRaw
    ? /^https?:\/\//i.test(alchemyRaw)
      ? alchemyRaw
      : `https://base-mainnet.g.alchemy.com/v2/${alchemyRaw}`
    : undefined;

  return Array.from(
    new Set(
      [
        alchemy,
        normalizeRpcCandidate(process.env.BASE_RPC_URL),
        "https://mainnet.base.org",
        "https://base-rpc.publicnode.com",
        "https://1rpc.io/base",
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

function hexBlock(value: bigint) {
  return `0x${value.toString(16)}` as Hex;
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const errors: string[] = [];

  for (const endpoint of rpcEndpoints()) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });

      const text = await response.text();
      let payload: JsonRpcEnvelope<T>;
      try {
        payload = JSON.parse(text) as JsonRpcEnvelope<T>;
      } catch {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 160) || "non-JSON RPC response"}`);
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload.error?.message || response.statusText}`);
      if (payload.error) throw new Error(payload.error.message || `RPC ${payload.error.code || "error"}`);
      if (!("result" in payload)) throw new Error("RPC response did not include a result");
      return payload.result as T;
    } catch (error: any) {
      const host = (() => { try { return new URL(endpoint).host; } catch { return "rpc"; } })();
      errors.push(`${host}: ${error?.message || String(error)}`);
    }
  }

  throw new Error(`All Base RPC endpoints failed. ${errors.join(" | ").slice(0, 900)}`);
}

async function getLatestBlockNumber() {
  const result = await rpcCall<Hex>("eth_blockNumber", []);
  return hexToBigInt(result);
}

function parseSwapLog(log: RpcLog): SwapLog | null {
  if (!log.topics?.[1] || !log.data) return null;
  try {
    const user = getAddress(`0x${log.topics[1].slice(-40)}`);
    const decoded = decodeAbiParameters(SWAP_SUMMARY_DATA, log.data);
    const tobyBurned = decoded[4] as bigint;
    return {
      args: { user, tobyBurned },
      blockNumber: log.blockNumber ? hexToBigInt(log.blockNumber) : null,
      transactionHash: log.transactionHash as `0x${string}`,
      logIndex: log.logIndex ? Number(hexToBigInt(log.logIndex)) : null,
    };
  } catch {
    return null;
  }
}

async function getLogsRange(fromBlock: bigint, toBlock: bigint): Promise<SwapLog[]> {
  const logs = await rpcCall<RpcLog[]>("eth_getLogs", [
    {
      address: SWAPPER,
      topics: [SWAP_SUMMARY_TOPIC],
      fromBlock: hexBlock(fromBlock),
      toBlock: hexBlock(toBlock),
    },
  ]);
  return logs.map(parseSwapLog).filter((log): log is SwapLog => Boolean(log));
}

async function getAllSwapSummaryLogs(fromBlock: bigint, toBlock: bigint): Promise<SwapLog[]> {
  if (fromBlock > toBlock) return [];

  // Small fixed windows are accepted by public Base RPCs and avoid enormous
  // eth_getLogs payloads. If a provider is stricter, bisect until it succeeds.
  const out: SwapLog[] = [];
  const queue: Array<[bigint, bigint]> = [];
  const initialSpan = 50_000n;

  for (let start = fromBlock; start <= toBlock; start += initialSpan) {
    const end = start + initialSpan - 1n > toBlock ? toBlock : start + initialSpan - 1n;
    queue.push([start, end]);
  }

  while (queue.length) {
    const [start, end] = queue.shift()!;
    try {
      out.push(...(await getLogsRange(start, end)));
    } catch (error) {
      const span = end - start + 1n;
      if (span <= 1_000n) throw error;
      const mid = start + span / 2n - 1n;
      queue.unshift([mid + 1n, end], [start, mid]);
    }
  }

  return out;
}

function normalizeStoredRow(row: StoredLeaderboardRow) {
  const rank = Number(row.current_rank || 0);
  const bestRank = row.best_rank == null ? rank : Number(row.best_rank);
  const burnedRaw = String(row.burned_raw || "0");
  const fallbackTitle = burnerTitleForRank(rank || 999999).title;
  const key = burnerTitleForRank(rank || 999999).key;

  return {
    rank,
    address: getAddress(row.wallet_address),
    burnedRaw,
    burned: formatUnits(BigInt(burnedRaw), 18),
    swaps: Number(row.swaps || 0),
    lastBlock: String(row.last_block || "0"),
    title: row.current_title || fallbackTitle,
    titleKey: key,
    bestRank,
    bestTitle: row.best_title || burnerTitleForRank(bestRank || rank || 999999).title,
    profile: row.fid
      ? {
          fid: Number(row.fid),
          username: row.username || undefined,
          displayName: row.display_name || undefined,
          pfpUrl: row.pfp_url || undefined,
        }
      : undefined,
  };
}

async function syncIntoSupabase(latestBlock: bigint) {
  const state = await supabaseRest<Array<{ last_scanned_block: string | number }>>(
    "tobyswap_sync_state?id=eq.base-mainnet&select=last_scanned_block&limit=1",
  );
  const remembered = state[0]?.last_scanned_block != null ? BigInt(state[0].last_scanned_block) : DEPLOYMENT_SCAN_BLOCK - 1n;
  const fromBlock = remembered + 1n > DEPLOYMENT_SCAN_BLOCK ? remembered + 1n : DEPLOYMENT_SCAN_BLOCK;

  const logs = await getAllSwapSummaryLogs(fromBlock, latestBlock);
  const rows = logs
    .filter((log) => log.args?.user && log.transactionHash && log.logIndex != null)
    .map((log) => ({
      event_id: `${log.transactionHash}:${log.logIndex}`,
      user_address: getAddress(log.args!.user!).toLowerCase(),
      burned_raw: String(log.args?.tobyBurned || 0n),
      block_number: String(log.blockNumber || 0n),
      transaction_hash: log.transactionHash,
      log_index: log.logIndex,
    }));

  for (let i = 0; i < rows.length; i += 500) {
    await supabaseRest("tobyswap_burn_events?on_conflict=event_id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
  }

  if (rows.length > 0 || !state[0]) await supabaseRpc("refresh_tobyswap_burner_stats");

  await supabaseRest("tobyswap_sync_state?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({
      id: "base-mainnet",
      last_scanned_block: String(latestBlock),
      updated_at: new Date().toISOString(),
    }),
  });

  return logs.length;
}

async function readStoredLeaderboard(viewerAddress?: string) {
  const leadersRaw = await supabaseRest<StoredLeaderboardRow[]>(
    "tobyswap_burner_leaderboard?select=*&order=current_rank.asc&limit=100",
  );
  const summaryRows = await supabaseRest<SummaryRow[]>("tobyswap_burner_summary?select=*&limit=1");

  let viewer = null;
  if (viewerAddress && isAddress(viewerAddress)) {
    const normalized = getAddress(viewerAddress).toLowerCase();
    const rows = await supabaseRest<StoredLeaderboardRow[]>(
      `tobyswap_burner_leaderboard?wallet_address=eq.${encodeURIComponent(normalized)}&select=*&limit=1`,
    );
    if (rows[0]) viewer = normalizeStoredRow(rows[0]);
  }

  const summary = summaryRows[0] || {};
  const totalRaw = String(summary.total_burned_raw || "0");

  return {
    leaders: leadersRaw.map(normalizeStoredRow),
    viewer,
    uniqueBurners: Number(summary.unique_burners || 0),
    swapEvents: Number(summary.swap_events || 0),
    totalFromEventsRaw: totalRaw,
    totalFromEvents: formatUnits(BigInt(totalRaw), 18),
  };
}

function aggregateLive(logs: SwapLog[], viewerAddress?: string) {
  const byUser = new Map<string, Burner>();
  let totalFromEvents = 0n;

  for (const log of logs) {
    const user = log.args?.user;
    if (!user) continue;
    const burned = log.args?.tobyBurned || 0n;
    const key = user.toLowerCase();
    const block = log.blockNumber || 0n;
    const previous = byUser.get(key);

    totalFromEvents += burned;
    byUser.set(key, {
      address: user,
      burned: (previous?.burned || 0n) + burned,
      swaps: (previous?.swaps || 0) + 1,
      lastBlock: block > (previous?.lastBlock || 0n) ? block : previous?.lastBlock || 0n,
    });
  }

  const all = [...byUser.values()]
    .sort((a, b) => (a.burned === b.burned ? b.swaps - a.swaps : a.burned > b.burned ? -1 : 1))
    .map((row, index) => {
      const rank = index + 1;
      const title = burnerTitleForRank(rank);
      return {
        rank,
        address: row.address,
        burnedRaw: row.burned.toString(),
        burned: formatUnits(row.burned, 18),
        swaps: row.swaps,
        lastBlock: row.lastBlock.toString(),
        title: title.title,
        titleKey: title.key,
        bestRank: rank,
        bestTitle: title.title,
      };
    });

  const viewerKey = viewerAddress && isAddress(viewerAddress) ? getAddress(viewerAddress).toLowerCase() : undefined;

  return {
    leaders: all.slice(0, 100),
    viewer: viewerKey ? all.find((row) => row.address.toLowerCase() === viewerKey) || null : null,
    uniqueBurners: byUser.size,
    swapEvents: logs.length,
    totalFromEventsRaw: totalFromEvents.toString(),
    totalFromEvents: formatUnits(totalFromEvents, 18),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const viewerAddress = url.searchParams.get("address") || undefined;
    const latestBlock = await getLatestBlockNumber();

    if (latestBlock < DEPLOYMENT_SCAN_BLOCK) {
      throw new Error(`Configured deployment block ${DEPLOYMENT_SCAN_BLOCK} is ahead of Base head ${latestBlock}. Check TOBYSWAP_DEPLOYMENT_BLOCK.`);
    }

    if (hasSupabaseServerEnv()) {
      try {
        const newEvents = await syncIntoSupabase(latestBlock);
        const stored = await readStoredLeaderboard(viewerAddress);
        return NextResponse.json(
          {
            ok: true,
            source: "Base RPC + persistent Supabase index",
            contract: SWAPPER,
            fromBlock: DEPLOYMENT_SCAN_BLOCK.toString(),
            toBlock: latestBlock.toString(),
            newEvents,
            ...stored,
            persistent: true,
            updatedAt: new Date().toISOString(),
          },
          { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" } },
        );
      } catch (supabaseError) {
        console.warn("Persistent leaderboard unavailable; falling back to live chain aggregation", supabaseError);
      }
    }

    const logs = await getAllSwapSummaryLogs(DEPLOYMENT_SCAN_BLOCK, latestBlock);
    const live = aggregateLive(logs, viewerAddress);

    return NextResponse.json(
      {
        ok: true,
        source: "Base RPC logs (live fallback)",
        contract: SWAPPER,
        fromBlock: DEPLOYMENT_SCAN_BLOCK.toString(),
        toBlock: latestBlock.toString(),
        ...live,
        persistent: false,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" } },
    );
  } catch (error: any) {
    console.error("Burner leaderboard failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unable to read burn events",
        hint: "TobySwap tried multiple Base RPC providers. Check BASE_RPC_URL/ALCHEMY_API_KEY and TOBYSWAP_DEPLOYMENT_BLOCK if this persists.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
