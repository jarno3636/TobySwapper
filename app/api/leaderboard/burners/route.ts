import { NextResponse } from "next/server";
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbiItem,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { SWAPPER } from "@/lib/addresses";
import { burnerTitleForRank } from "@/lib/burnerRanks";
import { hasSupabaseServerEnv, supabaseRest, supabaseRpc } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEPLOYMENT_SCAN_BLOCK = BigInt(process.env.TOBYSWAP_DEPLOYMENT_BLOCK || "36000000");
const SWAP_SUMMARY = parseAbiItem(
  "event SwapSummary(address indexed user, address indexed recipient, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 mainOutMin, uint256 feeBpsApplied, uint256 tobyBurned)",
);

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

function rpcUrl() {
  if (process.env.ALCHEMY_API_KEY) {
    return `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  }
  return process.env.BASE_RPC_URL || "https://mainnet.base.org";
}

const client = createPublicClient({
  chain: base,
  transport: http(rpcUrl(), { timeout: 14_000, retryCount: 2 }),
});

async function getLogsRange(fromBlock: bigint, toBlock: bigint): Promise<SwapLog[]> {
  const logs = await client.getLogs({
    address: SWAPPER,
    event: SWAP_SUMMARY,
    fromBlock,
    toBlock,
    strict: true,
  });
  return logs as unknown as SwapLog[];
}

async function getAllSwapSummaryLogs(fromBlock: bigint, toBlock: bigint): Promise<SwapLog[]> {
  if (fromBlock > toBlock) return [];

  try {
    return await getLogsRange(fromBlock, toBlock);
  } catch {
    const out: SwapLog[] = [];
    const queue: Array<[bigint, bigint]> = [];
    const initialSpan = 1_000_000n;

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
        if (span <= 10_000n) throw error;
        const mid = start + span / 2n - 1n;
        queue.unshift([mid + 1n, end], [start, mid]);
      }
    }

    return out;
  }
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

  if (rows.length > 0 || !state[0]) {
    await supabaseRpc("refresh_tobyswap_burner_stats");
  }

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
    const latestBlock = await client.getBlockNumber();

    if (hasSupabaseServerEnv()) {
      try {
        const newEvents = await syncIntoSupabase(latestBlock);
        const stored = await readStoredLeaderboard(viewerAddress);
        return NextResponse.json(
          {
            ok: true,
            source: "Base + persistent Supabase index",
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
        source: "Base logs (live fallback)",
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
    return NextResponse.json(
      { ok: false, error: error?.shortMessage || error?.message || "Unable to read burn events" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
