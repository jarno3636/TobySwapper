import { unstable_cache } from "next/cache";
import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";
import { SWAPPER } from "@/lib/addresses";

const ABI = parseAbi(["function totalTobyBurned() view returns (uint256)"]);

const readBurnTotal = async () => {
  const rpc = process.env.BASE_RPC_URL || "https://mainnet.base.org";
  const client = createPublicClient({ chain: base, transport: http(rpc, { timeout: 10_000, retryCount: 1 }) });
  const raw = await client.readContract({ address: SWAPPER, abi: ABI, functionName: "totalTobyBurned" });
  const whole = raw / 10n ** 18n;
  const frac = raw % 10n ** 18n;
  const totalHuman = (Number(whole) + Number(frac) / 1e18).toString();
  return { totalRaw: raw.toString(), totalHuman };
};

export const getCachedBurnTotal = unstable_cache(readBurnTotal, ["tobyswap-burn-total"], { revalidate: 900 });
