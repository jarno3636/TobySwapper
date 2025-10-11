// app/api/burn/total/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http, type Address, parseAbi } from "viem";
import { base } from "viem/chains";

// ✅ Your contract ABI & addresses
import TobySwapperAbi from "@/abi/TobySwapper.json";
import { SWAPPER, TOBY } from "@/lib/addresses";

// Make ABI literal so viem infers signatures nicely
const TobySwapper = TobySwapperAbi as const;

// Minimal ERC20 to read decimals()
const ERC20_DECIMALS_ABI = parseAbi([
  "function decimals() view returns (uint8)"
]);

export const revalidate = 0;

export async function GET() {
  try {
    const rpc = process.env.BASE_RPC_URL || "https://mainnet.base.org";
    const client = createPublicClient({ chain: base, transport: http(rpc) });

    const swapper = SWAPPER as Address;
    const toby = TOBY as Address;

    // 1) Read raw burned total directly from your TobySwapper
    const totalRaw = (await client.readContract({
      address: swapper,
      abi: TobySwapper,
      functionName: "totalTobyBurned",
      args: [], // 👈 required by your viem type setup
    })) as bigint;

    // 2) Scale using TOBY decimals (fallback 18 if anything fails)
    let decimals = 18;
    try {
      const d = (await client.readContract({
        address: toby,
        abi: ERC20_DECIMALS_ABI,
        functionName: "decimals",
        args: [], // 👈 some setups also want this present
      })) as number;
      if (Number.isFinite(d)) decimals = d;
    } catch {
      // keep fallback
    }

    const denom = BigInt(10) ** BigInt(decimals);
    const whole = totalRaw / denom;
    const frac = totalRaw % denom;
    const totalHuman = (Number(whole) + Number(frac) / Number(denom)).toString();

    return NextResponse.json(
      {
        ok: true,
        source: "TobySwapper.totalTobyBurned",
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
