import { NextResponse } from "next/server";
import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  http,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { SWAPPER } from "@/lib/addresses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The contract was created before block 36m. Starting slightly early is harmless
// and guarantees the first SwapSummary event is included.
const DEPLOYMENT_SCAN_BLOCK = BigInt(process.env.TOBYSWAP_DEPLOYMENT_BLOCK || "36000000");
const SWAP_SUMMARY = parseAbiItem(
  "event SwapSummary(address indexed user, address indexed recipient, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 mainOutMin, uint256 feeBpsApplied, uint256 tobyBurned)",
);

type RawLog = {
  address: Address;
  topics: readonly Hex[];
  data: Hex;
  blockNumber: bigint | null;
  transactionHash: Hex | null;
};

type Burner = {
  address: Address;
  burned: bigint;
  swaps: number;
  lastBlock: bigint;
};

function rpcUrl() {
  if (process.env.ALCHEMY_API_KEY) {
    return `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  }
  return process.env.BASE_RPC_URL || "https://mainnet.base.org";
}

async function getLogsRange(
  client: ReturnType<typeof createPublicClient>,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<RawLog[]> {
  return (await client.getLogs({
    address: SWAPPER,
    event: SWAP_SUMMARY,
    fromBlock,
    toBlock,
    strict: true,
  })) as RawLog[];
}

async function getAllSwapSummaryLogs(
  client: ReturnType<typeof createPublicClient>,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<RawLog[]> {
  // Alchemy and many archive RPCs can satisfy this in one request because the
  // contract emits relatively few events. Try the fast path first.
  try {
    return await getLogsRange(client, fromBlock, toBlock);
  } catch {
    // Provider-safe fallback. Start with broad slices; split a failed slice until
    // it is small enough for RPC providers with stricter eth_getLogs limits.
    const out: RawLog[] = [];
    const queue: Array<[bigint, bigint]> = [];
    const initialSpan = 1_000_000n;
    for (let start = fromBlock; start <= toBlock; start += initialSpan) {
      queue.push([start, start + initialSpan - 1n > toBlock ? toBlock : start + initialSpan - 1n]);
    }

    while (queue.length) {
      const [start, end] = queue.shift()!;
      try {
        out.push(...(await getLogsRange(client, start, end)));
      } catch (error) {
        const span = end - start + 1n;
        if (span <= 10_000n) throw error;
        const mid = start + (span / 2n) - 1n;
        queue.unshift([mid + 1n, end], [start, mid]);
      }
    }
    return out;
  }
}

export async function GET() {
  try {
    const source = process.env.ALCHEMY_API_KEY
      ? "Base logs via Alchemy"
      : process.env.BASE_RPC_URL
        ? "Base logs via configured RPC"
        : "Base logs via public RPC";

    const client = createPublicClient({ chain: base, transport: http(rpcUrl(), { timeout: 14_000, retryCount: 2 }) });
    const latestBlock = await client.getBlockNumber();
    const logs = await getAllSwapSummaryLogs(client, DEPLOYMENT_SCAN_BLOCK, latestBlock);

    const byUser = new Map<string, Burner>();
    let totalFromEvents = 0n;

    for (const log of logs) {
      const decoded = decodeEventLog({
        abi: [SWAP_SUMMARY],
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
        strict: true,
      });
      if (decoded.eventName !== "SwapSummary") continue;

      const args = decoded.args as {
        user: Address;
        tobyBurned: bigint;
      };
      const burned = args.tobyBurned ?? 0n;
      const key = args.user.toLowerCase();
      const block = log.blockNumber ?? 0n;
      const previous = byUser.get(key);

      totalFromEvents += burned;
      byUser.set(key, {
        address: args.user,
        burned: (previous?.burned ?? 0n) + burned,
        swaps: (previous?.swaps ?? 0) + 1,
        lastBlock: block > (previous?.lastBlock ?? 0n) ? block : (previous?.lastBlock ?? 0n),
      });
    }

    const leaders = [...byUser.values()]
      .sort((a, b) => (a.burned === b.burned ? b.swaps - a.swaps : a.burned > b.burned ? -1 : 1))
      .slice(0, 100)
      .map((row, index) => ({
        rank: index + 1,
        address: row.address,
        burnedRaw: row.burned.toString(),
        burned: formatUnits(row.burned, 18),
        swaps: row.swaps,
        lastBlock: row.lastBlock.toString(),
      }));

    return NextResponse.json(
      {
        ok: true,
        source,
        contract: SWAPPER,
        fromBlock: DEPLOYMENT_SCAN_BLOCK.toString(),
        toBlock: latestBlock.toString(),
        uniqueBurners: byUser.size,
        swapEvents: logs.length,
        totalFromEventsRaw: totalFromEvents.toString(),
        totalFromEvents: formatUnits(totalFromEvents, 18),
        leaders,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.shortMessage || error?.message || "Unable to read burn events",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
