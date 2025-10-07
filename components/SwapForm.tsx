// components/SwapForm.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Address,
  formatUnits,
  isAddress,
  parseUnits,
  maxUint256,
  erc20Abi,
} from "viem";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { base } from "viem/chains";
import TokenSelect from "./TokenSelect";
import {
  TOKENS,
  USDC,
  ROUTER,
  WETH,
  SWAPPER,
  TOBY,
} from "@/lib/addresses";
import { useUsdPriceSingle } from "@/lib/prices";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useStickyAllowance, useApprove } from "@/hooks/useAllowance";
import TobySwapperAbi from "@/abi/TobySwapper.json";

const UniV2RouterAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

function byAddress(addr?: Address | "ETH") {
  if (!addr || addr === "ETH")
    return { symbol: "ETH", decimals: 18 as const, address: undefined };
  const t = TOKENS.find((t) => t.address.toLowerCase() === addr.toLowerCase());
  return t
    ? {
        symbol: t.symbol,
        decimals: (t.decimals ?? 18) as 18 | 6,
        address: t.address as Address,
      }
    : { symbol: "TOKEN", decimals: 18 as const, address: addr as Address };
}
const eq = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

// checksum-safe helpers
const lc = (a: Address) => a.toLowerCase() as Address;
const lcPath = (p: Address[]) => p.map((x) => x.toLowerCase() as Address);

/* ---------------- Debug Panel ---------------- */
function DebugPanel({
  address,
  chain,
  inMeta,
  outMeta,
  balInRaw,
  balOutRaw,
  amountInHuman,
  amountInBig,
  pathTried,
  pathChosen,
  quoteError,
  expectedOutBig,
  slippage,
  minOutMainHuman,
  allowanceValue,
  needAllowance,
}: {
  address?: Address;
  chain?: { id: number; name?: string };
  inMeta: { symbol: string; decimals: number; address?: Address };
  outMeta: { symbol: string; decimals: number; address?: Address };
  balInRaw: { value?: bigint; decimals?: number; isLoading?: boolean; error?: unknown; refetch?: () => void };
  balOutRaw: { value?: bigint; decimals?: number; isLoading?: boolean; error?: unknown; refetch?: () => void };
  amountInHuman: string;
  amountInBig: bigint;
  pathTried: Address[][];
  pathChosen?: Address[];
  quoteError?: string;
  expectedOutBig?: bigint;
  slippage: number;
  minOutMainHuman: string;
  allowanceValue?: bigint;
  needAllowance: boolean;
}) {
  const fmt = (v?: bigint, d = 18) => {
    try { return v !== undefined ? Number(formatUnits(v, d)).toFixed(6) : "—"; }
    catch { return "—"; }
  };
  return (
    <div className="glass rounded-2xl p-4 border border-white/10 text-xs">
      <div className="mb-3 font-semibold">Debug</div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <div>Chain: <code>{chain?.id}</code> {chain?.name ? `· ${chain?.name}` : ""}</div>
          <div>Account: <code className="break-all">{address ?? "—"}</code></div>
          <div>Token In: <b>{inMeta.symbol}</b> <small>({inMeta.address ?? "ETH"})</small></div>
          <div>Token Out: <b>{outMeta.symbol}</b> <small>({outMeta.address})</small></div>
          <div>Allowance (raw): <code>{allowanceValue?.toString() ?? "—"}</code></div>
          <div>Needs allowance?: <code>{String(needAllowance)}</code></div>
        </div>

        <div className="space-y-1">
          <div>Amount In (human): <code>{amountInHuman}</code></div>
          <div>Amount In (raw): <code>{amountInBig.toString()}</code></div>
          <div>Expected Out (raw): <code>{expectedOutBig?.toString() ?? "—"}</code></div>
          <div>Expected Out (human): <code>{fmt(expectedOutBig, outMeta.decimals)}</code></div>
          <div>MinOut (human): <code>{minOutMainHuman || "0"}</code> · Slippage: <code>{slippage}%</code></div>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-1">Paths tried (first success wins):</div>
        <div className="flex flex-col gap-1">
          {pathTried.length ? pathTried.map((p, i) => (
            <div key={i} className="flex flex-wrap gap-1">
              <code className="inline-block text-[10px] px-1 py-0.5 bg-white/5 rounded">
                {p.join(" → ")}
              </code>
            </div>
          )) : <span>—</span>}
        </div>
        <div className="mt-2">
          Chosen path:{" "}
          {pathChosen ? (
            <code className="inline-block text-[10px] px-1 py-0.5 bg-white/5 rounded">
              {pathChosen.join(" → ")}
            </code>
          ) : "—"}
        </div>
        {quoteError && (
          <div className="mt-2 text-[11px] text-warn">
            Quote error: <code>{quoteError}</code>
          </div>
        )}
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
    </div>
  );
}
/* --------------- end Debug Panel --------------- */

function useStickyBalance(
  val?: { value?: bigint; decimals?: number },
  resetKey?: string
) {
  const [sticky, setSticky] = useState<string | undefined>(undefined);
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    last.current = undefined;
    setSticky(undefined);
  }, [resetKey]);
  useEffect(() => {
    if (!val?.value || val.decimals == null) return;
    try {
      const f = formatUnits(val.value, val.decimals);
      last.current = f;
      setSticky(f);
    } catch {}
  }, [val?.value, val?.decimals]);
  return last.current ?? sticky;
}

export default function SwapForm() {
  const { address, chain, isConnected } = useAccount();
  const chainId = chain?.id ?? base.id;
  const client = usePublicClient({ chainId: base.id });
  const { writeContractAsync } = useWriteContract();
  const [_, setLastTxHash] = useState<`0x${string}` | undefined>(undefined);
  const waitFor = useWaitForTransactionReceipt();

  // UI state
  const [modeTokenToToken, setModeTokenToToken] = useState(false);
  const [tokenIn, setTokenIn] = useState<Address | "ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<Address>(
    TOKENS.find((t) => t.address !== USDC)!.address
  );
  const [amt, setAmt] = useState("0.01");
  const [showDebug, setShowDebug] = useState(true);

  const [slippageOpen, setSlippageOpen] = useState(false);
  const [slippage, setSlippage] = useState<number>(0.5);

  // debounce amount
  const [debouncedAmt, setDebouncedAmt] = useState(amt);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedAmt(amt), 300);
    return () => clearTimeout(id);
  }, [amt]);

  // toggle ETH vs token→token
  useEffect(() => {
    if (modeTokenToToken && tokenIn === "ETH") setTokenIn(USDC as Address);
    if (!modeTokenToToken && tokenIn !== "ETH") setTokenIn("ETH");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeTokenToToken]);

  const inMeta = byAddress(tokenIn);
  const outMeta = byAddress(tokenOut);

  // Balances
  const balInRaw = useTokenBalance(address, inMeta.address);
  const balOutRaw = useTokenBalance(address, outMeta.address);
  const balInSticky  = useStickyBalance(balInRaw,  `${chainId}-${address ?? "0x"}-${inMeta.address ?? "ETH"}`);
  const balOutSticky = useStickyBalance(balOutRaw, `${chainId}-${address ?? "0x"}-${outMeta.address ?? "ETH"}`);

  // Prices
  const inUsd  = useUsdPriceSingle(inMeta.symbol === "ETH" ? "ETH" : inMeta.address!);
  const outUsd = useUsdPriceSingle(outMeta.symbol === "ETH" ? "ETH" : outMeta.address!);
  const amtNum = Number(debouncedAmt || "0");
  const amtInUsd = useMemo(() => (Number.isFinite(amtNum) ? amtNum * inUsd : 0), [amtNum, inUsd]);

  // Amount in (raw)
  const amountInBig = useMemo(() => {
    try { return parseUnits(debouncedAmt || "0", inMeta.decimals); } catch { return 0n; }
  }, [debouncedAmt, inMeta.decimals]);

  // -------- Multi-path quote probe (direct, via WETH, reverse-hop) --------
  const [quotePath, setQuotePath] = useState<Address[] | undefined>(undefined);
  const [quoteOut, setQuoteOut] = useState<bigint | undefined>(undefined);
  const [quoteErr, setQuoteErr] = useState<string | undefined>(undefined);
  const [pathsTried, setPathsTried] = useState<Address[][]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setQuoteOut(undefined);
      setQuotePath(undefined);
      setQuoteErr(undefined);
      setPathsTried([]);

      const inAddr = tokenIn === "ETH" ? WETH : (tokenIn as Address);

      // identity / ETH↔WETH 1:1 short-circuit
      if (eq(inAddr, tokenOut) && amountInBig > 0n) {
        if (!alive) return;
        const idPath = lcPath([inAddr as Address, tokenOut as Address]);
        setQuotePath(idPath);
        setQuoteOut(amountInBig);
        setPathsTried([idPath]);
        return;
      }

      if (!client || amountInBig === 0n || !isAddress(tokenOut)) return;

      const direct: Address[] = [inAddr as Address, tokenOut as Address];
      const viaWeth: Address[] = [inAddr as Address, WETH as Address, tokenOut as Address];
      const backHop: Address[] = [inAddr as Address, tokenOut as Address, WETH as Address];

      const candidates = [direct, viaWeth, backHop]
        .map(lcPath)
        .filter((p) => p.every(Boolean))
        .filter((p, i, arr) => arr.findIndex(q => q.join() === p.join()) === i);

      setPathsTried(candidates);

      for (const p of candidates) {
        try {
          const amounts = (await client.readContract({
            address: lc(ROUTER as Address),
            abi: UniV2RouterAbi as any,
            functionName: "getAmountsOut",
            args: [amountInBig, p],
          })) as bigint[];

          const out = amounts.at(-1);
          if (out && out > 0n) {
            if (!alive) return;
            setQuotePath(p);
            setQuoteOut(out);
            return;
          }
        } catch (e: any) {
          if (!alive) return;
          setQuoteErr(String(e?.shortMessage || e?.message || e));
        }
      }
    })();

    return () => { alive = false; };
  }, [client, tokenIn, tokenOut, amountInBig]);

  // Displayed expectedOut & minOut (human)
  const expectedOutBig = quoteOut;
  const expectedOutHuman = useMemo(() => {
    try { return expectedOutBig ? Number(formatUnits(expectedOutBig, outMeta.decimals)) : undefined; }
    catch { return undefined; }
  }, [expectedOutBig, outMeta.decimals]);

  const minOutMainHuman = useMemo(() => {
    if (!expectedOutBig) return "0";
    const bps = Math.round((100 - slippage) * 100);
    const raw = (expectedOutBig * BigInt(bps)) / 10000n;
    return formatUnits(raw, outMeta.decimals);
  }, [expectedOutBig, slippage, outMeta.decimals]);

  // ---------- Allowance (now based solely on tokenIn !== "ETH") ----------
  const needAllowance = tokenIn !== "ETH" && isAddress(tokenIn as string);
  const allowance = useStickyAllowance(
    needAllowance ? (tokenIn as Address) : undefined,
    needAllowance ? (address as Address) : undefined,
    needAllowance ? (SWAPPER as Address) : undefined
  );

  // If your useApprove exposes approveMaxFlow, prefer that:
  const { approve: approveOnce, isPending: isApprovePending, txHash: approveHash, wait } = useApprove(
    needAllowance ? (tokenIn as Address) : undefined,
    needAllowance ? (SWAPPER as Address) : undefined
  );

  const hasEnoughAllowance =
    !needAllowance || (allowance.value !== undefined && allowance.value >= amountInBig);

  const hasEnoughBalance =
    balInSticky && Number(balInSticky) >= Number(debouncedAmt || "0");

  const canSwap =
    isConnected &&
    amountInBig > 0n &&
    !!quotePath &&
    hasEnoughBalance &&
    hasEnoughAllowance;

  const setMax = () => {
    if (!balInSticky) return;
    const raw = parseFloat(balInSticky);
    const safe = inMeta.address ? raw : Math.max(0, raw - 0.0005); // native gas dust
    setAmt((safe > 0 ? safe : 0).toString());
  };

  const doApprove = async () => {
    if (!needAllowance) return;
    // Try direct max; if token requires reset-to-zero, the wallet will revert on-chain
    // and we’ll fall back to 0->max sequence below.
    try {
      const h = await approveOnce(maxUint256);
      setLastTxHash(h as any);
      await wait;
      await allowance.refetch();
      return;
    } catch {
      // Fallback for USDC-style: approve(0) then approve(max)
      const zero = await writeContractAsync({
        address: tokenIn as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [SWAPPER as Address, 0n],
      });
      setLastTxHash(zero as any);
      await waitFor.refetch({ queryKey: ['tx', zero] } as any);

      const max = await approveOnce(maxUint256);
      setLastTxHash(max as any);
      await wait;
      await allowance.refetch();
    }
  };

  // fee path (TOBY burn), keep len ≥ 2, lowercase everything
  const buildFeePath = (inA: Address): Address[] => {
    const inL = lc(inA);
    if (eq(inL, TOBY)) return lcPath([inL as Address, TOBY as Address]);
    if (eq(inL, WETH)) return lcPath([WETH as Address, TOBY as Address]);
    return lcPath([inL as Address, WETH as Address, TOBY as Address]);
  };

  const doSwap = async () => {
    if (!quotePath || amountInBig === 0n) return;

    // AUTO-APPROVE if short (so users don’t have to notice the button)
    if (needAllowance && (!allowance.value || allowance.value < amountInBig)) {
      await doApprove();
      // Re-check post-approve
      if (!allowance.value || allowance.value < amountInBig) return;
    }

    const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
    const decIn = inMeta.decimals;
    const decOut = outMeta.decimals;
    const now = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

    const mainPath = lcPath(quotePath);
    const feePath = buildFeePath(inAddr);

    if (tokenIn === "ETH") {
      const h = await writeContractAsync({
        address: lc(SWAPPER as Address),
        abi: TobySwapperAbi as any,
        functionName: "swapETHForTokensSupportingFeeOnTransferTokens",
        args: [
          lc(tokenOut),
          parseUnits(expectedOutBig ? minOutMainHuman : "0", decOut),
          mainPath,
          feePath,
          parseUnits("0", 18),
          now,
        ],
        value: parseUnits(amt || "0", 18),
      });
      setLastTxHash(h as any);
    } else {
      const h = await writeContractAsync({
        address: lc(SWAPPER as Address),
        abi: TobySwapperAbi as any,
        functionName: "swapTokensForTokensSupportingFeeOnTransferTokens",
        args: [
          lc(tokenIn as Address),
          lc(tokenOut),
          parseUnits(amt || "0", decIn),
          parseUnits(expectedOutBig ? minOutMainHuman : "0", decOut),
          mainPath,
          feePath,
          parseUnits("0", 18),
          now,
        ],
      });
      setLastTxHash(h as any);
    }
  };

  return (
    <div className="glass rounded-3xl p-6 shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <div className="flex items-center gap-2">
          <button
            className="pill pill-opaque px-3 py-1 text-xs"
            onClick={() => setSlippageOpen(true)}
            title="Set slippage"
          >
            Slippage: {slippage}%
          </button>
          <button
            className="pill pill-opaque px-3 py-1 text-xs"
            onClick={() => setShowDebug((v) => !v)}
            title="Toggle debug"
          >
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>
        </div>
      </div>

      {chain && chain.id !== base.id && (
        <div className="mb-3 text-xs text-warn">
          Connected to {chain?.name}. Please switch to Base for balances & swaps.
        </div>
      )}
      {!isConnected && (
        <div className="mb-3 text-xs text-inkSub">Connect your wallet to load balances.</div>
      )}

      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-3">
          <button
            className={`pill justify-center ${!modeTokenToToken ? "outline outline-1 outline-white/20" : ""}`}
            onClick={() => setModeTokenToToken(false)}
          >
            Base ETH
          </button>
          <button
            className={`pill justify-center ${modeTokenToToken ? "outline outline-1 outline-white/20" : ""}`}
            onClick={() => setModeTokenToToken(true)}
          >
            Token → Token
          </button>
        </div>

        {/* Token In select only when Token→Token */}
        {modeTokenToToken && (
          <div className="space-y-2">
            <label className="text-sm text-inkSub">Token In</label>
            <TokenSelect
              value={tokenIn as Address}
              onChange={(a) => setTokenIn(a)}
              exclude={tokenOut}
              balance={balInSticky}
            />
          </div>
        )}

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-inkSub">
              Amount {tokenIn === "ETH" ? "(ETH)" : `(${inMeta.symbol})`}
            </label>
            <div className="text-xs text-inkSub">
              Bal: <span className="font-mono">
                {balInSticky
                  ? Number(balInSticky).toFixed(6)
                  : isConnected
                  ? "—"
                  : "Connect wallet"}
              </span>
              <button className="ml-2 underline opacity-90 hover:opacity-100" onClick={setMax}>MAX</button>
            </div>
          </div>

          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            className="w-full glass rounded-pill px-4 py-3"
            placeholder="0.0"
            inputMode="decimal"
          />
          <div className="mt-2 text-xs text-inkSub">≈ ${amtInUsd ? amtInUsd.toFixed(2) : "0.00"} USD</div>
          {!hasEnoughBalance && isConnected && (
            <div className="mt-1 text-xs text-warn">Insufficient {inMeta.symbol} balance.</div>
          )}
        </div>

        {/* Center swap-sides */}
        <div className="flex justify-center">
          <button
            className="pill pill-opaque px-3 py-1 text-sm"
            type="button"
            onClick={() => {
              const prevIn = tokenIn;
              const prevOut = tokenOut;
              if (prevIn === "ETH") {
                setModeTokenToToken(true);
                setTokenIn(prevOut as Address);
              } else {
                setTokenIn(prevOut ? (prevOut as Address) : "ETH");
              }
              setTokenOut(prevIn === "ETH" ? (USDC as Address) : (prevIn as Address));
            }}
            aria-label="Swap sides"
            title="Swap sides"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v18M8 7l4-4 4 4M16 17l-4 4-4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        {/* Token Out */}
        <div className="space-y-2">
          <label className="text-sm text-inkSub">Token Out</label>
          <TokenSelect value={tokenOut} onChange={setTokenOut} exclude={tokenIn as Address} balance={balOutSticky} />
          <div className="text-xs text-inkSub">
            {expectedOutHuman !== undefined ? (
              <>Est: <span className="font-mono">{expectedOutHuman.toFixed(6)}</span> {outMeta.symbol} · 1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}</>
            ) : quoteErr ? (
              <>No route found on router.</>
            ) : (
              <>1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}</>
            )}
          </div>
        </div>

        {/* CTA(s): Approve if needed, then Swap */}
        {needAllowance && !hasEnoughAllowance ? (
          <button
            onClick={doApprove}
            className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
            disabled={isApprovePending || !isConnected || amountInBig === 0n}
          >
            {isApprovePending ? "Approving…" : `Approve ${inMeta.symbol}`}
          </button>
        ) : null}

        <button
          onClick={doSwap}
          className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
          disabled={!isConnected || amountInBig === 0n || !quotePath || !hasEnoughBalance}
        >
          <span className="pip pip-a" /> <span className="pip pip-b" /> <span className="pip pip-c" /> Swap &amp; Burn 1% to TOBY 🔥
        </button>
      </div>

      {/* Debug panel */}
      {showDebug && (
        <div className="mt-6">
          <DebugPanel
            address={address}
            chain={chain}
            inMeta={inMeta}
            outMeta={outMeta}
            balInRaw={balInRaw}
            balOutRaw={balOutRaw}
            amountInHuman={debouncedAmt}
            amountInBig={amountInBig}
            pathTried={pathsTried}
            pathChosen={quotePath}
            quoteError={quoteErr}
            expectedOutBig={expectedOutBig}
            slippage={slippage}
            minOutMainHuman={minOutMainHuman}
            allowanceValue={allowance.value}
            needAllowance={needAllowance}
          />
        </div>
      )}

      {/* Slippage modal */}
      {slippageOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSlippageOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-strong rounded-2xl p-5 w-[90%] max-w-sm border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Slippage</h4>
              <button className="pill pill-opaque px-3 py-1 text-xs" onClick={() => setSlippageOpen(false)}>Close</button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[0.1, 0.5, 1, 2].map((v) => (
                <button key={v} onClick={() => setSlippage(v)} className={`pill justify-center px-3 py-1 text-xs ${slippage === v ? "outline outline-1 outline-white/20" : ""}`}>
                  {v}%
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="0.1" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} className="glass rounded-pill px-3 py-2 w-full" />
              <span className="text-sm text-inkSub">%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
