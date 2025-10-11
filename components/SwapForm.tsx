// components/SwapForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import {
  formatUnits, parseUnits, isAddress,
  encodePacked, encodeAbiParameters, getAddress,
} from "viem";
import { base } from "viem/chains";
import {
  useAccount, usePublicClient, useWriteContract, useSwitchChain,
} from "wagmi";

import TokenSelect from "./TokenSelect";
import {
  TOKENS, USDC, WETH, SWAPPER, TOBY, QUOTER_V3,
} from "@/lib/addresses";

import { useUsdPriceSingle } from "@/lib/prices";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useStickyAllowance, useApprove } from "@/hooks/useAllowance";

import TobySwapperAbi from "@/abi/TobySwapper.json";
import SwapDebug from "./SwapDebug";
import type { DebugInfo } from "./debugTypes";

/* ---------------------------------- Config --------------------------------- */
const SAFE_MODE_MINOUT_ZERO = false;
const FEE_DENOM = 10_000n;
const GAS_BUFFER_ETH = 0.0005;
const QUOTE_TIMEOUT_MS = 12_000; // we parallelize + prune, so 12s is safe

/* ------------------------------- Minimal ABIs ------------------------------- */
// Uniswap V3 Quoter (a.k.a. QuoterV2 in Uniswap docs)
const QuoterV3Abi = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [{ name: "path", type: "bytes" }, { name: "amountIn", type: "uint256" }],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96AfterList", type: "uint160[]" },
      { name: "initializedTicksCrossedList", type: "uint32[]" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

// Uniswap V3 Factory (pool existence)
const V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD" as Address;
const V3FactoryAbi = [
  { type: "function", name: "getPool", stateMutability: "view",
    inputs: [{type:"address"},{type:"address"},{type:"uint24"}],
    outputs: [{type:"address"}] },
] as const;

// Uniswap V2 Router (Base official)
const V2_ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24" as Address;
const UniV2RouterAbi = [
  { type: "function", name: "getAmountsOut", stateMutability: "view",
    inputs: [{type:"uint256"}, {type:"address[]"}],
    outputs: [{type:"uint256[]"}] },
  { type: "function", name: "swapExactETHForTokens", stateMutability: "payable",
    inputs: [
      {name:"amountOutMin", type:"uint256"},
      {name:"path", type:"address[]"},
      {name:"to", type:"address"},
      {name:"deadline", type:"uint256"},
    ],
    outputs: [{type:"uint256[]"}] },
  { type: "function", name: "swapExactTokensForETH", stateMutability: "nonpayable",
    inputs: [
      {name:"amountIn", type:"uint256"},
      {name:"amountOutMin", type:"uint256"},
      {name:"path", type:"address[]"},
      {name:"to", type:"address"},
      {name:"deadline", type:"uint256"},
    ],
    outputs: [{type:"uint256[]"}] },
  { type: "function", name: "swapExactTokensForTokens", stateMutability: "nonpayable",
    inputs: [
      {name:"amountIn", type:"uint256"},
      {name:"amountOutMin", type:"uint256"},
      {name:"path", type:"address[]"},
      {name:"to", type:"address"},
      {name:"deadline", type:"uint256"},
    ],
    outputs: [{type:"uint256[]"}] },
] as const;

// WETH deposit
const WethAbi = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] },
] as const;

/* --------------------------------- helpers --------------------------------- */
const V3_FEES = [500, 3000, 10000] as const;

function eq(a?: string, b?: string) { return !!a && !!b && a.toLowerCase() === b.toLowerCase(); }
const lc = (a: Address) => a.toLowerCase() as Address;

function byAddress(addr?: Address | "ETH") {
  if (!addr || addr === "ETH") return { symbol: "ETH", decimals: 18 as const, address: undefined };
  const t = TOKENS.find((t) => t.address.toLowerCase() === String(addr).toLowerCase());
  return t
    ? { symbol: t.symbol, decimals: (t.decimals ?? 18) as 18 | 6, address: t.address as Address }
    : { symbol: "TOKEN", decimals: 18 as const, address: addr as Address };
}

function encodeV3Path(tokens: Address[], fees: number[]): `0x${string}` {
  if (fees.length !== tokens.length - 1) throw new Error("fees length must be tokens.length - 1");
  const norm = tokens.map((t) => getAddress(t) as Address);
  let packed = encodePacked(["address"], [norm[0]]);
  for (let i = 0; i < fees.length; i++) {
    const fee = Number(fees[i]);
    packed = encodePacked(["bytes", "uint24", "address"], [packed, fee, norm[i + 1]]) as `0x${string}`;
  }
  return packed;
}

// timeout wrapper
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Timeout")), ms);
    p.then((v) => { clearTimeout(id); resolve(v); })
     .catch((e) => { clearTimeout(id); reject(e); });
  });
}

/* ------------------------------- Network guard ------------------------------ */
function useNetworkGuard() {
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const isOnBase = chainId === base.id;
  const ensureBase = useCallback(async () => {
    if (!isOnBase && !isPending) { try { await switchChainAsync({ chainId: base.id }); } catch {} }
  }, [isOnBase, isPending, switchChainAsync]);
  return { isOnBase, ensureBase };
}

/* ------------------------------ V3 pre-checks ------------------------------- */
async function v3ExistingFees(client: any, a: Address, b: Address) {
  const [x,y] = a.toLowerCase() < b.toLowerCase() ? [a,b] : [b,a];
  const calls = V3_FEES.map(f =>
    client.readContract({
      address: V3_FACTORY, abi: V3FactoryAbi, functionName: "getPool",
      args: [x, y, f]
    }).then((pool: Address) => ({ fee: f, ok: pool !== '0x0000000000000000000000000000000000000000' }))
     .catch(() => ({ fee: f, ok: false }))
  );
  const res = await Promise.all(calls);
  return res.filter(r => r.ok).map(r => r.fee);
}

async function buildV3CandidatesPruned(client: any, tokenIn: Address|"ETH", tokenOut: Address) {
  const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
  const hubs = [inAddr, WETH as Address, USDC as Address, tokenOut] as Address[];

  // find which edges exist
  const key = (a: Address,b: Address) => `${a.toLowerCase()}->${b.toLowerCase()}`;
  const edgeFees = new Map<string, number[]>();

  const uniqPairs: [Address,Address][] = [];
  for (let i=0;i<hubs.length;i++) for (let j=i+1;j<hubs.length;j++) uniqPairs.push([hubs[i], hubs[j]]);

  await Promise.all(uniqPairs.map(async ([a,b])=>{
    const fees = await v3ExistingFees(client, a, b);
    if (fees.length) { edgeFees.set(key(a,b), fees); edgeFees.set(key(b,a), fees); }
  }));

  // DFS up to 3 hops
  const results: { tokens: Address[]; fees: number[] }[] = [];
  const maxHops = 3;
  const dfs = (path: Address[], feePath: number[]) => {
    const cur = path[path.length-1];
    if (cur.toLowerCase() === tokenOut.toLowerCase() && feePath.length === path.length-1) {
      results.push({ tokens:[...path], fees:[...feePath] }); return;
    }
    if (path.length-1 >= maxHops) return;
    for (const nxt of hubs) {
      if (nxt.toLowerCase() === cur.toLowerCase()) continue;
      const fees = edgeFees.get(key(cur,nxt));
      if (!fees) continue;
      for (const f of [...fees].sort((a,b)=>a-b)) dfs([...path, nxt], [...feePath, f]);
    }
  };
  dfs([inAddr], []);
  const seen = new Set<string>();
  return results.filter(r => { const k=`${r.tokens.join('>')}|${r.fees.join(',')}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
}

/* ------------------------------ V2 helpers --------------------------------- */
// Attempt V2 getAmountsOut for [in,out] or [in,WETH,out]
async function v2Quote(client: any, amountIn: bigint, tokenIn: Address|"ETH", tokenOut: Address) {
  const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
  const tryPaths: Address[][] = [
    [inAddr, tokenOut],
    [inAddr, WETH as Address, tokenOut],
  ];
  for (const path of tryPaths) {
    try {
      const amounts: bigint[] = await client.readContract({
        address: V2_ROUTER,
        abi: UniV2RouterAbi,
        functionName: "getAmountsOut",
        args: [amountIn, path],
      }) as any;
      if (amounts?.length === path.length && amounts[amounts.length-1] > 0n) {
        return { out: amounts[amounts.length-1] as bigint, path };
      }
    } catch {/* keep trying */}
  }
  return undefined;
}

/* -------------------------- Fee/burn helper (V3) --------------------------- */
function buildFeePath(inA: Address): Address[] {
  const inL = lc(inA);
  if (eq(inL, TOBY)) return [inL as Address, TOBY as Address];
  if (eq(inL, WETH)) return [WETH as Address, TOBY as Address];
  return [inL as Address, WETH as Address, TOBY as Address];
}

/* ---------------------------------- View ----------------------------------- */
export default function SwapForm() {
  const { address, chainId, isConnected } = useAccount();
  const { isOnBase, ensureBase } = useNetworkGuard();
  const client = usePublicClient({ chainId: base.id }); // pin to Base
  const { writeContractAsync } = useWriteContract();

  // UI state
  // Keep internal ETH sentinel so we can treat WETH selection as ETH when desired.
  const [tokenIn, setTokenIn] = useState<Address | "ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<Address>(TOBY as Address);
  const [amt, setAmt] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(0.5);
  const [slippageOpen, setSlippageOpen] = useState(false);

  // Debug snapshot
  const [debug, setDebug] = useState<DebugInfo>({
    isOnBase, chainId, account: address as any,
    tokenIn, tokenOut, amountInHuman: amt, slippage, feeBps: 100n,
    state: "idle", attempts: [],
    addresses: { SWAPPER: SWAPPER as any, QUOTER_V3: QUOTER_V3 as any, WETH: WETH as any, USDC: USDC as any, TOBY: TOBY as any },
  });
  useEffect(() => {
    setDebug((d) => ({ ...d, isOnBase, chainId, account: address as any, tokenIn, tokenOut, amountInHuman: amt, slippage }));
  }, [isOnBase, chainId, address, tokenIn, tokenOut, amt, slippage]);

  // Reset defaults on account/chain change
  useEffect(() => { setTokenIn("ETH"); setTokenOut(TOBY as Address); setAmt(""); }, [address, chainId]);

  // Ensure Base when connected
  useEffect(() => { if (isConnected) void ensureBase(); }, [isConnected, ensureBase]);

  // balances & price
  const inMeta = byAddress(tokenIn);
  const outMeta = byAddress(tokenOut);
  const balInRaw = useTokenBalance(address, inMeta.address);
  const balOutRaw = useTokenBalance(address, outMeta.address);
  const inUsd = useUsdPriceSingle(inMeta.symbol === "ETH" ? "ETH" : (inMeta.address as Address));
  const outUsd = useUsdPriceSingle(outMeta.symbol === "ETH" ? "ETH" : (outMeta.address as Address));

  // debounced amount
  const [debouncedAmt, setDebouncedAmt] = useState(amt);
  useEffect(() => { const id = setTimeout(() => setDebouncedAmt(amt.trim()), 220); return () => clearTimeout(id); }, [amt]);

  const amountInBig = useMemo(() => { try { return parseUnits(debouncedAmt || "0", inMeta.decimals); } catch { return 0n; }}, [debouncedAmt, inMeta.decimals]);
  const amtNum = Number(debouncedAmt || "0");
  const amtInUsd = Number.isFinite(amtNum) ? amtNum * inUsd : 0;

  /* ------------------------------ feeBps (V3) ------------------------------ */
  const [feeBps, setFeeBps] = useState<bigint>(100n);
  useEffect(() => {
    (async () => {
      if (!client) return;
      try {
        const bps = (await client.readContract({
          address: lc(SWAPPER as Address),
          abi: [{ type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const,
          functionName: "feeBps",
        })) as bigint;
        if (bps >= 0n && bps <= 500n) { setFeeBps(bps); setDebug((d)=>({ ...d, feeBps: bps })); }
      } catch {}
    })();
  }, [client]);

  /* ----------------------------- Quote (V3+V2) ----------------------------- */
  const mainAmountIn = useMemo(() => (amountInBig === 0n ? 0n : (amountInBig * (FEE_DENOM - feeBps)) / FEE_DENOM), [amountInBig, feeBps]);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "noroute" | "ok">("idle");
  const [quoteErr, setQuoteErr] = useState<string | undefined>();
  const [quoteOutMain, setQuoteOutMain] = useState<bigint | undefined>();
  const [bestV3, setBestV3] = useState<{ tokens: Address[]; fees: number[] } | undefined>();
  const [bestV2Path, setBestV2Path] = useState<Address[] | undefined>();
  const [debugPath, setDebugPath] = useState<string | undefined>();
  const quoteLatch = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setQuoteErr(undefined); setQuoteOutMain(undefined); setBestV3(undefined); setBestV2Path(undefined); setDebugPath(undefined);
      setDebug((d)=>({ ...d, state: "idle", attempts: [], bestOut: undefined, bestKind: undefined, quoteError: undefined }));

      if (!client || !isOnBase || mainAmountIn === 0n || !isAddress(tokenOut)) { setQuoteState("idle"); return; }
      setQuoteState("loading");
      setDebug((d)=>({ ...d, state: "loading" }));
      const myLatch = ++quoteLatch.current;

      let bestOut: bigint | undefined;
      let best: { tokens: Address[]; fees: number[] } | undefined;
      let v2Path: Address[] | undefined;

      try {
        // 1) V3 pruned candidates → parallel quote
        const cands = await buildV3CandidatesPruned(client, tokenIn, tokenOut);
        if (cands.length) {
          const results = await withTimeout(
            Promise.allSettled(cands.map(async (cand) => {
              const path = encodeV3Path(cand.tokens, cand.fees);
              const t0 = performance.now();
              const [amountOut] = (await client.readContract({
                address: QUOTER_V3 as Address,
                abi: QuoterV3Abi as any,
                functionName: "quoteExactInput",
                args: [path, mainAmountIn],
              })) as [bigint];
              const ms = Math.round(performance.now() - t0);
              setDebug((d)=>({ ...d, attempts: [...d.attempts, { kind: "v3", pathTokens: cand.tokens, fees: cand.fees, ok: true, amountOut, ms }] }));
              return { cand, amountOut };
            })), QUOTE_TIMEOUT_MS
          );

          for (const r of results) if (r.status === "fulfilled") {
            const { cand, amountOut } = r.value as any;
            if (amountOut > 0n && (!bestOut || amountOut > bestOut)) { bestOut = amountOut; best = cand; }
          }
        }

        // 2) V2 fallback if no V3 best
        if (!bestOut) {
          const v2 = await v2Quote(client, mainAmountIn, tokenIn, tokenOut as Address);
          if (v2 && v2.out > 0n) {
            bestOut = v2.out; v2Path = v2.path;
            setDebug(d => ({ ...d, attempts: [...d.attempts, { kind: "v2", pathTokens: v2.path, ok: true, amountOut: v2.out, ms: 0 }]}));
            const sym = (addr: Address) => TOKENS.find(x => eq(x.address, addr))?.symbol ?? (eq(addr, WETH) ? "WETH" : addr.slice(0,6));
            setDebugPath(`v2: ${v2.path.map(sym).join(" → ")}`);
          }
        }
      } catch (e:any) {
        setQuoteErr(e?.shortMessage || e?.message || String(e));
      }

      if (!alive || myLatch !== quoteLatch.current) return;

      if (bestOut) {
        setQuoteOutMain(bestOut);
        setBestV3(best);
        setBestV2Path(v2Path);
        const syms = best?.tokens?.map((t) => TOKENS.find((x) => eq(x.address, t))?.symbol ?? t.slice(0, 6));
        if (best && syms) {
          const parts: string[] = [];
          for (let i = 0; i < best.fees.length; i++) parts.push(`${syms[i]}(${best.fees[i]})→${syms[i+1]}`);
          setDebugPath(`v3: ${parts.join(" → ")}`);
        }
        setDebug((d)=>({ ...d, state: "ok", bestOut: bestOut, bestKind: best ? "v3" : "v2" }));
        setQuoteState("ok");
      } else {
        setQuoteState("noroute");
        setQuoteErr("No V3/V2 route found.");
        setDebug((d)=>({ ...d, state: "noroute", quoteError: "No route" }));
      }
    })();
    return () => { alive = false; };
  }, [client, isOnBase, tokenIn, tokenOut, mainAmountIn]); // eslint-disable-line

  const expectedOutMainHuman = useMemo(() => {
    try { return quoteOutMain ? Number(formatUnits(quoteOutMain, outMeta.decimals)) : undefined; } catch { return undefined; }
  }, [quoteOutMain, outMeta.decimals]);

  const minOutMain = useMemo(() => {
    if (!quoteOutMain || SAFE_MODE_MINOUT_ZERO) return 0n;
    return (quoteOutMain * BigInt(Math.round((100 - slippage) * 100))) / 10000n;
  }, [quoteOutMain, slippage]);

  const minOutMainHuman = useMemo(() => formatUnits(minOutMain, outMeta.decimals), [minOutMain, outMeta.decimals]);

  /* -------------------- Allowances (SWAPPER/V3 & V2 router) -------------------- */
  const tokenInAddr = inMeta.address as Address | undefined;

  // For V3 (your SWAPPER)
  const needsApprovalV3 = !!tokenInAddr;
  const { value: allowanceV3, isLoading: isAllowLoadV3, refetch: refetchAllowV3 } =
    useStickyAllowance(tokenInAddr, address as Address | undefined, SWAPPER as Address);
  const { approveMaxFlow: approveMaxV3, isPending: isApprovingV3 } =
    useApprove(tokenInAddr, SWAPPER as Address);

  // For V3 with ETH, we actually spend WETH
  const { value: wethAllowanceV3, refetch: refetchWethV3 } =
    useStickyAllowance(WETH as Address, address as Address | undefined, SWAPPER as Address);
  const { approveMaxFlow: approveWethMaxV3 } =
    useApprove(WETH as Address, SWAPPER as Address);

  // For V2 fallback (spender is V2 router)
  const { value: allowanceV2, refetch: refetchAllowV2 } =
    useStickyAllowance(tokenInAddr, address as Address | undefined, V2_ROUTER);
  const { approveMaxFlow: approveMaxV2, isPending: isApprovingV2 } =
    useApprove(tokenInAddr, V2_ROUTER);

  const [approveCooldown, setApproveCooldown] = useState(false);

  const onApproveV3 = useCallback(async () => {
    if (!needsApprovalV3 || !isConnected || !tokenInAddr) return;
    setApproveCooldown(true);
    try {
      await approveMaxV3(allowanceV3);
      setTimeout(() => { refetchAllowV3(); setApproveCooldown(false); }, 2000);
    } catch { setApproveCooldown(false); }
  }, [needsApprovalV3, isConnected, tokenInAddr, approveMaxV3, allowanceV3, refetchAllowV3]);

  const onApproveV2 = useCallback(async () => {
    if (!isConnected || !tokenInAddr) return;
    setApproveCooldown(true);
    try {
      await approveMaxV2(allowanceV2);
      setTimeout(() => { refetchAllowV2(); setApproveCooldown(false); }, 2000);
    } catch { setApproveCooldown(false); }
  }, [isConnected, tokenInAddr, approveMaxV2, allowanceV2, refetchAllowV2]);

  const showApproveV3 =
    !!bestV3 && !!tokenInAddr && amountInBig > 0n && (allowanceV3 ?? 0n) < amountInBig;

  const showApproveV2 =
    !bestV3 && !!tokenInAddr && amountInBig > 0n && (allowanceV2 ?? 0n) < amountInBig;

  const approveTextV3 =
    isApprovingV3 ? "Approving (V3)…" :
    isAllowLoadV3 && !approveCooldown ? "Checking allowance…" :
    (allowanceV3 ?? 0n) > 0n ? `Re-approve ${inMeta.symbol} (V3)` : `Approve ${inMeta.symbol} (V3)`;

  const approveTextV2 =
    isApprovingV2 ? "Approving (V2)…" :
    (allowanceV2 ?? 0n) > 0n ? `Re-approve ${inMeta.symbol} (V2)` : `Approve ${inMeta.symbol} (V2)`;

  /* ----------------------------- Execute the swap ---------------------------- */
  const [preflightMsg, setPreflightMsg] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  async function doSwap() {
    if (!isConnected || !isOnBase) { setPreflightMsg("Connect your wallet on Base to swap."); return; }
    if (amountInBig === 0n) return;
    if (!client) { setPreflightMsg("No RPC client available."); return; }

    setPreflightMsg(undefined);
    setSending(true);

    const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
    const decIn = inMeta.decimals;
    const decOut = outMeta.decimals;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);
    const feePath = buildFeePath(inAddr);

    setDebug((d)=>({ ...d, preflight: {
      allowance: tokenIn === "ETH"
        ? wethAllowanceV3
        : bestV3 ? allowanceV3 : allowanceV2,
      needApproval:
        tokenIn === "ETH"
          ? (bestV3 ? ((wethAllowanceV3 ?? 0n) < amountInBig) : false)
          : (bestV3 ? ((allowanceV3 ?? 0n) < amountInBig) : ((allowanceV2 ?? 0n) < amountInBig)),
      inBalance: balInRaw.value, outBalance: balOutRaw.value,
      minOut: minOutMainHuman, deadline
    }, tx: { stage: "simulating" }}));

    try {
      if (quoteState !== "ok" || !quoteOutMain) { setPreflightMsg("No valid quote."); setSending(false); return; }

      /* ---------- Branch A: V3 route via your SWAPPER ---------- */
      if (bestV3) {
        // If input is ETH → wrap to WETH and ensure allowance to SWAPPER
        if (tokenIn === "ETH") {
          await writeContractAsync({
            address: WETH as Address,
            abi: WethAbi,
            functionName: "deposit",
            value: parseUnits(amt || "0", 18),
            chain: base,
            account: address as Address,
          });
          if ((wethAllowanceV3 ?? 0n) < amountInBig) {
            await approveWethMaxV3(wethAllowanceV3);
            await refetchWethV3();
          }
        } else {
          if ((allowanceV3 ?? 0n) < amountInBig) {
            setPreflightMsg(`Approve ${inMeta.symbol} (V3) first.`);
            setSending(false);
            return;
          }
        }

        const v3Path = encodeV3Path(bestV3.tokens, bestV3.fees);
        const paramsBytes = encodeAbiParameters(
          [{
            type: "tuple",
            components: [
              { name: "path", type: "bytes" },
              { name: "recipient", type: "address" },
              { name: "deadline", type: "uint256" },
              { name: "amountIn", type: "uint256" },
              { name: "amountOutMinimum", type: "uint256" },
            ],
          }],
          [{
            path: v3Path,
            recipient: address as Address,
            deadline,
            amountIn: parseUnits(amt || "0", decIn),
            amountOutMinimum: parseUnits(minOutMainHuman, decOut),
          }]
        );

        const sim = await withTimeout<any>((client.simulateContract as any)({
          address: lc(SWAPPER as Address),
          abi: TobySwapperAbi as any,
          functionName: "swapTokensForTokensV3ExactInput",
          args: [ lc(inAddr), lc(tokenOut), address as Address,
                  parseUnits(amt || "0", decIn), paramsBytes, feePath, 0n ],
          account: address as Address,
          chain: base,
        }), 10_000);

        const tx = await writeContractAsync(sim.request);
        setDebug((d)=>({ ...d, tx: { stage: "sending", hash: tx as any, used: "v3" }}));
        setSending(false);
        return;
      }

      /* ---------- Branch B: V2 fallback ---------- */
      // Compute minOut
      const minOut = SAFE_MODE_MINOUT_ZERO ? 0n : minOutMain;
      const isEthIn = tokenIn === "ETH";
      const isEthOut = outMeta.symbol === "ETH";

      // Determine path
      const path = bestV2Path ?? (isEthIn ? [WETH as Address, tokenOut as Address] :
                                   isEthOut ? [inAddr, WETH as Address] :
                                   [inAddr, tokenOut as Address]);

      if (isEthIn) {
        // ETH -> Token
        const sim = await (client as any).simulateContract({
          address: V2_ROUTER,
          abi: UniV2RouterAbi,
          functionName: "swapExactETHForTokens",
          args: [ minOut, path, address as Address, deadline ],
          account: address as Address,
          chain: base,
          value: parseUnits(amt || "0", 18),
        });
        const tx = await writeContractAsync(sim.request);
        setDebug(d => ({ ...d, tx: { stage: "sending", hash: tx as any, used: "v2:ETH->TOKEN" } }));
      } else if (isEthOut) {
        // Token -> ETH
        if ((allowanceV2 ?? 0n) < amountInBig) {
          setPreflightMsg(`Approve ${inMeta.symbol} (V2) first.`);
          setSending(false);
          return;
        }
        const sim = await (client as any).simulateContract({
          address: V2_ROUTER,
          abi: UniV2RouterAbi,
          functionName: "swapExactTokensForETH",
          args: [ parseUnits(amt || "0", decIn), minOut, path, address as Address, deadline ],
          account: address as Address,
          chain: base,
        });
        const tx = await writeContractAsync(sim.request);
        setDebug(d => ({ ...d, tx: { stage: "sending", hash: tx as any, used: "v2:TOKEN->ETH" } }));
      } else {
        // Token -> Token
        if ((allowanceV2 ?? 0n) < amountInBig) {
          setPreflightMsg(`Approve ${inMeta.symbol} (V2) first.`);
          setSending(false);
          return;
        }
        const sim = await (client as any).simulateContract({
          address: V2_ROUTER,
          abi: UniV2RouterAbi,
          functionName: "swapExactTokensForTokens",
          args: [ parseUnits(amt || "0", decIn), minOut, path, address as Address, deadline ],
          account: address as Address,
          chain: base,
        });
        const tx = await writeContractAsync(sim.request);
        setDebug(d => ({ ...d, tx: { stage: "sending", hash: tx as any, used: "v2:TOKEN->TOKEN" } }));
      }
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      if (/timeout/i.test(msg)) setPreflightMsg("RPC timed out. Please try again.");
      else if (/HTTP/i.test(msg)) setPreflightMsg("Network RPC error. Try again.");
      else setPreflightMsg(msg);
      setDebug((d)=>({ ...d, tx: { stage: "error", msg }}));
    } finally {
      setSending(false);
    }
  }

  /* ----------------------------------- UI ----------------------------------- */
  const disableSwap =
    !isConnected || !isOnBase || amountInBig === 0n ||
    (balInRaw.value ?? 0n) < amountInBig ||
    sending || quoteState !== "ok";

  return (
    <div className="glass rounded-3xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <div className="inline-flex items-center gap-2 text-xs text-inkSub">
          <span>Network</span>
          <img src="/tokens/baseeth.PNG" alt="Base" className="w-4 h-4 rounded-full" />
          <span>Base</span>
        </div>
      </div>

      {!isOnBase && (
        <div className="mb-3 text-xs rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
          You’re not on Base. <button onClick={ensureBase} className="underline">Switch to Base</button> to continue.
        </div>
      )}

      {/* Token In */}
      <div className="space-y-2">
        <label className="text-sm text-inkSub">
          Token In {inMeta.symbol === "ETH" ? "(ETH • Base)" : ""}
        </label>
        <TokenSelect
          value={tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address)}
          onChange={(a) => { 
            // If user selects WETH, we keep ETH sentinel to enable native mode by default.
            setTokenIn(eq(a, WETH) ? "ETH" : (a as Address)); 
            setAmt(""); 
          }}
          exclude={tokenOut}
          balance={balInRaw.value !== undefined ? Number(formatUnits(balInRaw.value, inMeta.decimals)).toFixed(6) : undefined}
        />
      </div>

      {/* Swap sides */}
      <div className="flex justify-center my-2">
        <button
          className="pill pill-opaque px-3 py-1 text-sm"
          onClick={() => {
            const prevIn = tokenIn, prevOut = tokenOut;
            // If input was ETH sentinel, flipping makes output become ETH (so set output to WETH address)
            setTokenIn(prevOut as Address);
            setTokenOut(prevIn === "ETH" ? (WETH as Address) : (prevIn as Address));
            setAmt("");
          }}
          aria-label="Swap sides"
          title="Swap sides"
        >
          ↕
        </button>
      </div>

      {/* Amount */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm text-inkSub">
            Amount {inMeta.symbol === "ETH" ? "(ETH • Base)" : `(${inMeta.symbol})`}
          </label>
          <div className="text-xs text-inkSub">
            Bal: <span className="font-mono">
              {balInRaw.value !== undefined ? Number(formatUnits(balInRaw.value, inMeta.decimals)).toFixed(6) : "—"}
            </span>
            <button
              className="ml-2 underline"
              onClick={() => {
                if (!balInRaw.value) return;
                const raw = Number(formatUnits(balInRaw.value, inMeta.decimals));
                const safe = inMeta.address ? raw : Math.max(0, raw - GAS_BUFFER_ETH);
                setAmt((safe > 0 ? safe : 0).toString());
              }}
            >
              MAX
            </button>
          </div>
        </div>

        <input
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          className="w-full glass rounded-pill px-4 py-3"
          placeholder="0.0"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          name="swap-amount"
        />

        <div className="mt-2 text-xs text-inkSub">≈ ${Number.isFinite(amtInUsd) ? amtInUsd.toFixed(2) : "0.00"} USD</div>

        {isConnected && balInRaw.value !== undefined && balInRaw.value < amountInBig && (
          <div className="mt-1 text-xs text-warn">Insufficient {inMeta.symbol === "ETH" ? "ETH (Base)" : inMeta.symbol} balance.</div>
        )}

        {/* Approve buttons (contextual) */}
        {showApproveV3 && (
          <div className="mt-3">
            <button
              onClick={onApproveV3}
              className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
              disabled={isApprovingV3 || !isConnected || !isOnBase || approveCooldown}
              title={`Approve ${inMeta.symbol} for SWAPPER (V3)`}
            >
              {approveTextV3}
            </button>
            <div className="mt-1 text-[11px] text-inkSub">
              Spender: <code className="break-all">{SWAPPER as Address}</code>
              {(allowanceV3 !== undefined) && <> · Allowance: <span className="font-mono">{(allowanceV3).toString()}</span></>}
            </div>
          </div>
        )}

        {showApproveV2 && (
          <div className="mt-3">
            <button
              onClick={onApproveV2}
              className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
              disabled={isApprovingV2 || !isConnected || !isOnBase || approveCooldown}
              title={`Approve ${inMeta.symbol} for Uniswap V2 Router`}
            >
              {approveTextV2}
            </button>
            <div className="mt-1 text-[11px] text-inkSub">
              Spender: <code className="break-all">{V2_ROUTER}</code>
              {(allowanceV2 !== undefined) && <> · Allowance: <span className="font-mono">{(allowanceV2).toString()}</span></>}
            </div>
          </div>
        )}
      </div>

      {/* Token Out & estimate */}
      <div className="space-y-2 mt-4">
        <label className="text-sm text-inkSub">
          Token Out {outMeta.symbol === "ETH" ? "(ETH • Base)" : ""}
        </label>
        <TokenSelect
          value={tokenOut}
          onChange={(v) => { setTokenOut(v); setAmt(""); }}
          exclude={tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address)}
          balance={balOutRaw.value !== undefined ? Number(formatUnits(balOutRaw.value, outMeta.decimals)).toFixed(6) : undefined}
        />
        <div className="text-xs text-inkSub">
          {quoteState === "loading" && <>Querying routes…</>}
          {quoteState === "noroute" && <>No route found for this pair/size.{quoteErr && <> <span className="text-warn"> ({quoteErr})</span></>}</>}
          {quoteState === "ok" && expectedOutMainHuman !== undefined && (
            <>
              Est (after fee): <span className="font-mono">{expectedOutMainHuman.toFixed(6)}</span> {outMeta.symbol}
              {" · "}1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}
            </>
          )}
          {quoteState === "idle" && <>Enter an amount to get an estimate.</>}
        </div>
        {debugPath && <div className="text-[11px] text-inkSub">path: <code className="break-all">{debugPath}</code></div>}
      </div>

      {/* Swap */}
      <button
        onClick={doSwap}
        className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60 mt-4"
        disabled={disableSwap}
        title="Swap"
      >
        {sending ? "Submitting…" : bestV3 ? `Swap & Burn ${Number(feeBps) / 100}% 🔥 (V3)` : "Swap (V2 fallback)"}
      </button>

      {preflightMsg && <div className="text-[11px] text-warn mt-2">{preflightMsg}</div>}

      {/* Debug panel */}
      <SwapDebug info={debug} />

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
