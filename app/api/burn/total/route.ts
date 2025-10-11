// app/api/burn/total/route.ts
import { NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  type Address,
  parseAbi,
} from "viem";
import { base } from "viem/chains";

// === CONFIG ===
// Required: your burn-tracker contract address and ABI JSON.
// Example assumes you add your ABI as "@/abi/BurnTracker.json"
// and that it has a view like: totalBurned() returns (uint256)
import BurnTrackerAbi from "@/abi/BurnTracker.json";

// Optional: read ERC20 decimals from the TOBY token for scaling
const ERC20_DECIMALS_ABI = parseAbi([
  "function decimals() view returns (uint8)"
]);

export const revalidate = 0;

export async function GET() {
  try {
    const rpc = process.env.BASE_RPC_URL || "https://mainnet.base.org";
    const client = createPublicClient({ chain: base, transport: http(rpc) });

    // REQUIRED: set these in your env
    const tracker = process.env.BURN_TRACKER_ADDRESS as Address; // your contract
    if (!tracker) {
      return NextResponse.json(
        { ok: false, error: "Missing BURN_TRACKER_ADDRESS env var" },
        { status: 500 }
      );
    }

    // If your function name is different, set BURN_TRACKER_FN (default: "totalBurned")
    const fn = (process.env.BURN_TRACKER_FN || "totalBurned") as any;

    // If your function takes arguments, you can JSON it in BURN_TRACKER_ARGS (e.g., '["0x..."]')
    const argsEnv = process.env.BURN_TRACKER_ARGS;
    const args = argsEnv ? (JSON.parse(argsEnv) as any[]) : undefined;

    // 1) Read raw burned (assumed uint256 in token base units)
    const totalRaw = (await client.readContract({
      address: tracker,
      abi: BurnTrackerAbi as any,
      functionName: fn,
      args,
    })) as bigint;

    // 2) Scale to human using token decimals:
    // Prefer reading from NEXT_PUBLIC_TOBY (ERC20), else use BURN_DECIMALS, else default 18
    let decimals = 18;
    const tokenAddr = process.env.NEXT_PUBLIC_TOBY as Address | undefined;

    if (tokenAddr) {
      try {
        const d = (await client.readContract({
          address: tokenAddr,
          abi: ERC20_DECIMALS_ABI,
          functionName: "decimals",
        })) as number;
        if (Number.isFinite(d)) decimals = d;
      } catch {
        // ignore, keep fallback
      }
    } else if (process.env.BURN_DECIMALS) {
      const parsed = Number(process.env.BURN_DECIMALS);
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 36) decimals = parsed;
    }

    const denom = BigInt(10) ** BigInt(decimals);
    const whole = totalRaw / denom;
    const frac = totalRaw % denom;
    const human = (Number(whole) + Number(frac) / Number(denom)).toString();

    return NextResponse.json(
      {
        ok: true,
        source: "tracker",
        tracker,
        fn,
        args: args ?? [],
        decimals,
        totalRaw: totalRaw.toString(),
        totalHuman: human,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
