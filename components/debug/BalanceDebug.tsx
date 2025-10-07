"use client";

import { Address, formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { base } from "viem/chains";
import { TOKENS, WETH } from "@/lib/addresses";

type Bal = { value?: bigint; decimals?: number; isLoading?: boolean; error?: unknown; refetch?: () => void };

export default function BalanceDebug({
  address,
  tokenIn,
  tokenOut,
  inMeta,
  outMeta,
  balInRaw,
  balOutRaw,
  amountInHuman,
  amountInBig,
  path,
  expectedOutBig,
  quoteEnabled,
  refetchQuote,
  slippage,
  minOutMainStr,
  chain,
}: {
  address?: Address;
  tokenIn: Address | "ETH";
  tokenOut: Address;
  inMeta: { symbol: string; decimals: number; address?: Address };
  outMeta: { symbol: string; decimals: number; address?: Address };
  balInRaw: Bal;
  balOutRaw: Bal;
  amountInHuman: string;
  amountInBig: bigint;
  path: Address[];
  expectedOutBig?: bigint;
  quoteEnabled: boolean;
  refetchQuote: () => void;
  slippage: number;
  minOutMainStr: string;
  chain?: { id: number; name?: string };
}) {
  const client = usePublicClient({ chainId: base.id });

  const fmt = (v?: bigint, d = 18) => {
    try { return v !== undefined ? Number(formatUnits(v, d)).toFixed(6) : "—"; }
    catch { return "—"; }
  };

  const showPath = path.length ? path.map((a, i) => (
    <code key={i} className="inline-block text-[10px] px-1 py-0.5 bg-white/5 rounded">{a}</code>
  )) : <span>—</span>;

  const tokenSym = (addr?: Address) => TOKENS.find(t => t.address.toLowerCase() === (addr ?? "").toLowerCase())?.symbol
    ?? (addr && addr.toLowerCase() === WETH.toLowerCase() ? "WETH" : "???");

  return (
    <div className="glass rounded-2xl p-4 border border-white/10 text-xs">
      <div className="mb-3 font-semibold">Debug</div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <div>Chain: <code>{chain?.id}</code> {chain?.name ? `· ${chain?.name}` : ""}</div>
          <div>Account: <code className="break-all">{address ?? "—"}</code></div>
          <div>Token In: <b>{inMeta.symbol}</b> <small>({inMeta.address ?? "ETH"})</small></div>
          <div>Token Out: <b>{outMeta.symbol}</b> <small>({outMeta.address})</small></div>
        </div>

        <div className="space-y-1">
          <div>Amount In (human): <code>{amountInHuman}</code></div>
          <div>Amount In (raw): <code>{amountInBig.toString()}</code></div>
          <div>Quote enabled: <code>{String(quoteEnabled)}</code></div>
          <div>Expected Out (raw): <code>{expectedOutBig?.toString() ?? "—"}</code></div>
          <div>Expected Out (human): <code>{fmt(expectedOutBig, outMeta.decimals)}</code></div>
          <div>MinOut main (string): <code>{minOutMainStr}</code> · Slippage: <code>{slippage}%</code></div>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-1">Main Path:</div>
        <div className="flex flex-wrap gap-1">{showPath}</div>
        <div className="mt-1">
          Symbols: {path.length ? path.map((a, i) => <code key={i} className="mr-1">{tokenSym(a)}</code>) : "—"}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="glass rounded-xl p-3">
          <div className="font-semibold mb-1">Balance In</div>
          <div>decimals: <code>{balInRaw.decimals ?? "—"}</code></div>
          <div>raw: <code>{balInRaw.value?.toString() ?? "—"}</code></div>
          <div>human: <code>{fmt(balInRaw.value, balInRaw.decimals ?? inMeta.decimals)}</code></div>
          <div>loading: <code>{String(balInRaw.isLoading)}</code></div>
          <div>error: <code>{balInRaw.error ? String(balInRaw.error) : "—"}</code></div>
          <button className="mt-2 pill pill-opaque px-2 py-1" onClick={() => balInRaw.refetch?.()}>
            Refetch In
          </button>
        </div>

        <div className="glass rounded-xl p-3">
          <div className="font-semibold mb-1">Balance Out</div>
          <div>decimals: <code>{balOutRaw.decimals ?? "—"}</code></div>
          <div>raw: <code>{balOutRaw.value?.toString() ?? "—"}</code></div>
          <div>human: <code>{fmt(balOutRaw.value, balOutRaw.decimals ?? outMeta.decimals)}</code></div>
          <div>loading: <code>{String(balOutRaw.isLoading)}</code></div>
          <div>error: <code>{balOutRaw.error ? String(balOutRaw.error) : "—"}</code></div>
          <button className="mt-2 pill pill-opaque px-2 py-1" onClick={() => balOutRaw.refetch?.()}>
            Refetch Out
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button className="pill pill-opaque px-2 py-1" onClick={() => refetchQuote()}>
          Refetch Quote
        </button>
        {client && (
          <span className="text-inkSub">RPC OK · chainId {client.chain?.id}</span>
        )}
      </div>
    </div>
  );
}
