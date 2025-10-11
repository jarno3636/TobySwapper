// app/api/burn/total/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http, type Address, parseAbi } from "viem";
import { base } from "viem/chains";

// 👉 Your ABI (drop the JSON file at abi/TobySwapper.json)
import TobySwapperAbi from "@/abi/TobySwapper.json";

// If you already export SWAPPER / TOBY in "@/lib/addresses", we’ll use those.
// Otherwise, set env vars SWAPPER_ADDRESS and NEXT_PUBLIC_TOBY.
let SWAPPER_FROM_LIB: Address | undefined;
let TOBY_FROM_LIB: Address | undefined;
try {
  // Optional import; ignore if you don't have it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ADDR = require("@/lib/addresses");
  SWAPPER_FROM_LIB = (ADDR.SWAPPER ?? ADDR.TOBY_SWAPPER) as Address | undefined;
  TOBY_FROM_LIB = (ADDR.TOBY as Address) ?? undefined;
} catch {
  // no-op
}

// Minimal ERC20 ABI to read decimals()
const ERC20_DECIMALS_ABI = parseAbi([
  "function decimals() view returns (uint8)"
]);

export const revalidate = 0;

export async function GET() {
  try {
    const rpc = process.env.BASE_RPC_URL || "https://mainnet.base.org";
    const client = createPublicClient({ chain: base, transport: http(rpc) });

    // Resolve contract addresses
    const swapper =
      (SWAPPER_FROM_LIB as Address) ||
      (process.env.SWAPPER_ADDRESS as Address) ||
      (process.env.NEXT_PUBLIC_SWAPPER as Address);

    if (!swapper) {
      return NextResponse.json(
        { ok: false, error: "Missing SWAPPER address (set SWAPPER_ADDRESS or NEXT_PUBLIC_SWAPPER, or export SWAPPER in lib/addresses)." },
        { status: 500 }
      );
    }

    const toby =
      (TOBY_FROM_LIB as Address) ||
      (process.env.NEXT_PUBLIC_TOBY as Address);

    if (!toby) {
      return NextResponse.json(
        { ok: false, error: "Missing TOBY token address (set NEXT_PUBLIC_TOBY or export TOBY in lib/addresses)." },
        { status: 500 }
      );
    }

    // 1) Read raw burned total from your TobySwapper
    const totalRaw = (await client.readContract({
      address: swapper,
      abi: TobySwapperAbi as any,
      functionName: "totalTobyBurned",
    })) as bigint;

    // 2) Read decimals from the TOBY ERC-20 for scaling (fallback 18)
    let decimals = 18;
    try {
      const d = (await client.readContract({
        address: toby,
        abi: ERC20_DECIMALS_ABI,
        functionName: "decimals",
      })) as number;
      if (Number.isFinite(d)) decimals = d;
    } catch {
      // keep fallback 18
    }

    const denom = BigInt(10) ** BigInt(decimals);
    const whole = totalRaw / denom;
    const frac = totalRaw % denom;
    const totalHuman = (Number(whole) + Number(frac) / Number(denom)).toString();

    return NextResponse.json(
      {
        ok: true,
        source: "tobySwapper.totalTobyBurned",
        swapper,
        toby,
        decimals,
        totalRaw: totalRaw.toString(),
        totalHuman,
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
