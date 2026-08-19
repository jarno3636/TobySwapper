// components/SwapForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Address } from "viem";
import {
  formatUnits, parseUnits, isAddress,
  encodePacked, encodeAbiParameters, getAddress,
} from "viem";
import { base } from "viem/chains";
import {
  useAccount, usePublicClient, useWriteContract, useSwitchChain,
} from "wagmi";

import TokenSelect, { type TokenChoice } from "./TokenSelect";
import {
  TOKENS, USDC, WETH, SWAPPER, TOBY, PATIENCE, TABOSHI, QUOTER_V3,
} from "@/lib/addresses";

import { useUsdPriceSingle } from "@/lib/prices";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useStickyAllowance, useApprove } from "@/hooks/useAllowance";
import { useInvalidateBurnTotal } from "@/lib/burn";
import { recordConfirmedSwap } from "@/lib/pond-record";

/* ---------------------------------- Config --------------------------------- */
const SAFE_MODE_MINOUT_ZERO = false; // keep for V3; V2 uses 0 minOut below
const FEE_DENOM = 10_000n;
const QUOTE_TIMEOUT_MS = 12_000;

/* ------------------------------- Minimal ABIs ------------------------------- */
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

const V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD" as Address;
const V3FactoryAbi = [
  { type: "function", name: "getPool", stateMutability: "view",
    inputs: [{type:"address"},{type:"address"},{type:"uint24"}],
    outputs: [{type:"address"}] },
] as const;

const V2_ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24" as Address;
const UniV2RouterAbi = [
  { type: "function", name: "getAmountsOut", stateMutability: "view",
    inputs: [{type:"uint256"}, {type:"address[]"}],
    outputs: [{type:"uint256[]"}] },
] as const;

// Official Uniswap SwapRouter02 deployment on Base. TABOSHI uses this direct
// lane when the TobySwapper burn contract cannot execute its V3 fee leg.
const SWAP_ROUTER_02 = "0x2626664c2603336E57B271c5C0b26F421741e481" as Address;
const SwapRouter02Abi = [
  {
    type: "function",
    name: "exactInput",
    stateMutability: "payable",
    inputs: [{
      name: "params",
      type: "tuple",
      components: [
        { name: "path", type: "bytes" },
        { name: "recipient", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMinimum", type: "uint256" },
      ],
    }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

/* ------------------------------ SWAPPER ABI ------------------------------ */
const TobySwapperAbi = [
  { type:"function", name:"feeBps", stateMutability:"view", inputs:[], outputs:[{type:"uint256"}] },

  { type:"function", name:"swapETHForTokensSupportingFeeOnTransferTokensTo", stateMutability:"payable",
    inputs:[
      {name:"tokenOut", type:"address"},
      {name:"recipient", type:"address"},
      {name:"minOutMain", type:"uint256"},
      {name:"pathForMainSwap", type:"address[]"},
      {name:"pathForFeeSwap", type:"address[]"},
      {name:"minOutFee", type:"uint256"},
      {name:"deadline", type:"uint256"},
    ],
    outputs:[] },

  { type:"function", name:"swapTokensForETHSupportingFeeOnTransferTokensTo", stateMutability:"nonpayable",
    inputs:[
      {name:"tokenIn", type:"address"},
      {name:"recipient", type:"address"},
      {name:"amountIn", type:"uint256"},
      {name:"minOutMain", type:"uint256"},
      {name:"pathForMainSwap", type:"address[]"},
      {name:"pathForFeeSwap", type:"address[]"},
      {name:"minOutFee", type:"uint256"},
      {name:"deadline", type:"uint256"},
    ],
    outputs:[] },

  { type:"function", name:"swapTokensForTokensSupportingFeeOnTransferTokensTo", stateMutability:"nonpayable",
    inputs:[
      {name:"tokenIn", type:"address"},
      {name:"tokenOut", type:"address"},
      {name:"recipient", type:"address"},
      {name:"amountIn", type:"uint256"},
      {name:"minOutMain", type:"uint256"},
      {name:"pathForMainSwap", type:"address[]"},
      {name:"pathForFeeSwap", type:"address[]"},
      {name:"minOutFee", type:"uint256"},
      {name:"deadline", type:"uint256"},
    ],
    outputs:[] },

  { type:"function", name:"swapTokensForTokensV3ExactInput", stateMutability:"nonpayable",
    inputs:[
      {name:"tokenIn", type:"address"},
      {name:"tokenOut", type:"address"},
      {name:"recipient", type:"address"},
      {name:"amountIn", type:"uint256"},
      {name:"v3Params", type:"bytes"},
      {name:"pathForFeeSwap", type:"address[]"},
      {name:"minOutFee", type:"uint256"},
    ],
    outputs:[] },
] as const;

/* --------------------------------- helpers --------------------------------- */
const V3_FEES = [500, 3000, 10000] as const;
const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const lc = (a: Address) => a.toLowerCase() as Address;

function byAddress(addr?: Address | "ETH") {
  if (!addr || addr === "ETH") return { symbol: "ETH", decimals: 18 as const, address: undefined };
  const t = TOKENS.find((t) => t.address.toLowerCase() === String(addr).toLowerCase());
  return t
    ? { symbol: t.symbol, decimals: (t.decimals ?? 18) as 18 | 6, address: t.address as Address }
    : { symbol: "TOKEN", decimals: 18 as const, address: addr as Address };
}

function toCaip19(token: TokenChoice): string {
  if (token === "ETH") return "eip155:8453/native";
  return `eip155:8453/erc20:${getAddress(token as Address)}`;
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
  const hubs = [inAddr, WETH as Address, USDC as Address, TOBY as Address, tokenOut] as Address[];

  const key = (a: Address,b: Address) => `${a.toLowerCase()}->${b.toLowerCase()}`;
  const edgeFees = new Map<string, number[]>();

  const uniqPairs: [Address,Address][] = [];
  for (let i=0;i<hubs.length;i++) for (let j=i+1;j<hubs.length;j++) uniqPairs.push([hubs[i], hubs[j]]);

  await Promise.all(uniqPairs.map(async ([a,b])=>{
    const fees = await v3ExistingFees(client, a, b);
    if (fees.length) { edgeFees.set(key(a,b), fees); edgeFees.set(key(b,a), fees); }
  }));

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
      if (path.some((used) => eq(used, nxt)) && !eq(nxt, tokenOut)) continue;
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
async function v2Quote(client: any, amountIn: bigint, tokenIn: Address|"ETH", tokenOut: Address) {
  const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
  const rawPaths: Address[][] = [
    [inAddr, tokenOut],
    [inAddr, WETH as Address, tokenOut],
    [inAddr, USDC as Address, tokenOut],
    [inAddr, TOBY as Address, tokenOut],
    [inAddr, WETH as Address, USDC as Address, tokenOut],
    [inAddr, USDC as Address, WETH as Address, tokenOut],
  ];
  // Remove repeated adjacent tokens and duplicate route shapes before asking Router02.
  const seen = new Set<string>();
  const tryPaths = rawPaths
    .map((path) => path.filter((a, i) => i === 0 || !eq(a, path[i - 1])))
    .filter((path) => path.length >= 2 && !eq(path[0], path[path.length - 1]))
    .filter((path) => {
      const key = path.map((a) => a.toLowerCase()).join(">");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  let best: { out: bigint; path: Address[] } | undefined;
  for (const path of tryPaths) {
    try {
      const amounts: bigint[] = await client.readContract({
        address: V2_ROUTER,
        abi: UniV2RouterAbi,
        functionName: "getAmountsOut",
        args: [amountIn, path],
      }) as any;
      if (amounts?.length === path.length && amounts[amounts.length-1] > 0n) {
        const out = amounts[amounts.length-1] as bigint;
        if (!best || out > best.out) best = { out, path };
      }
    } catch {/* continue */}
  }
  return best;
}

/* -------------------------- Fee/burn helper path --------------------------- */
function buildFeePathFor(tokenInAddr: Address): Address[] {
  const t = lc(tokenInAddr);
  if (eq(t, TOBY)) return [t as Address, TOBY as Address];
  if (eq(t, WETH)) return [WETH as Address, TOBY as Address];
  // TABOSHI has a direct Sushi V2 TABOSHI/TOBY pool. The fee is only a small
  // fraction of each trade, so using that direct pool is more reliable than
  // assuming a TABOSHI/WETH V2 pool exists.
  if (eq(t, TABOSHI)) return [t as Address, TOBY as Address];
  return [t as Address, WETH as Address, TOBY as Address];
}

/* ---------------------------- UI small helper ------------------------------ */
function GearIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        d="M10.325 4.317a1 1 0 0 1 1.35-.436l.7.35a1 1 0 0 0 .894 0l.7-.35a1 1 0 0 1 1.35.436l.35.7a1 1 0 0 0 .5.5l.7.35a1 1 0 0 1 .436 1.35l-.35.7a1 1 0 0 0 0 .894l.35.7a1 1 0 0 1-1.35  .436l-.7.35a1 1 0 0 0-.5.5l-.35.7a1 1 0 0 1-1.35.436l-.7-.35a1 1 0 0 0-.894 0l-.7.35a1 1 0 0 1-1.35-.436l-.35-.7a1 1 0 0 0-.5-.5l-.7-.35a1 1 0 0 1-.436-1.35l.35-.7a1 1 0 0 0 0-.894l-.35-.7a1 1 0 0 1 .436-1.35l.7-.35a1 1 0 0 0 .5-.5l.35-.7Z" />
      <circle cx="12" cy="12" r="3" strokeWidth="2" />
    </svg>
  );
}

/* ------------------------------- Portals ----------------------------------- */
function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/* ---- Success Toast ---- */
function SuccessToast({
  onClose,
  hash,
  bought,
  boughtSymbol,
  burnedInput,
  burnedSymbol,
  burnedToby,
}: {
  onClose: () => void;
  hash: `0x${string}`;
  bought?: string;
  boughtSymbol?: string;
  burnedInput?: string;
  burnedSymbol?: string;
  burnedToby?: string;
}) {
  useEffect(() => {
    const id = setTimeout(onClose, 6500);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[10999]" onClick={onClose} />
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[11000] w-[calc(100%-1.5rem)] max-w-md isolate" aria-live="polite">
        <div className="swap-success-card pointer-events-auto">
          <span className="swap-success-shine" aria-hidden="true" />
          <button onClick={onClose} className="swap-success-close" aria-label="Close">×</button>
          <div className="swap-success-head">
            <span className="swap-success-orb">✓</span>
            <div><small>BASE CONFIRMED</small><strong>Swap landed in the pond</strong></div>
          </div>
          <div className="swap-success-grid">
            {bought && boughtSymbol && <div><small>Estimated receive</small><strong>~{bought} {boughtSymbol}</strong></div>}
            {burnedToby ? <div className="swap-success-burn"><small>Estimated burn</small><strong>🔥 ~{burnedToby} TOBY</strong></div> : burnedInput && burnedSymbol ? <div><small>Fee input</small><strong>~{burnedInput} {burnedSymbol}</strong></div> : null}
          </div>
          <a className="swap-success-basescan" href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noopener noreferrer">
            <span>View confirmed transaction</span><strong>BaseScan ↗</strong>
          </a>
          <p>Burn and receive values are estimates; BaseScan is the final onchain record.</p>
        </div>
      </div>
    </Portal>
  );
}

/* ---------------------------------- View ----------------------------------- */
export default function SwapForm() {
  const { address, chainId, isConnected } = useAccount();
  const connected = !!address; // robust across WC reconnects
  const { isOnBase, ensureBase } = useNetworkGuard();
  const client = usePublicClient({ chainId: base.id }); // pin to Base
  const { writeContractAsync } = useWriteContract();
  const invalidateBurnTotal = useInvalidateBurnTotal();

  const [success, setSuccess] = useState<{
    hash: `0x${string}`;
    bought?: string;
    boughtSymbol?: string;
    burnedInput?: string;
    burnedSymbol?: string;
    burnedToby?: string;
  } | null>(null);

  function showSuccessToast(args: {
    hash: `0x${string}`;
    bought?: bigint;
    boughtDec?: number;
    boughtSymbol?: string;
    burnedInRaw?: bigint;
    burnedInDec?: number;
    burnedSymbol?: string;
    burnedTobyRaw?: bigint;
  }) {
    const prettyBought =
      args.bought !== undefined && args.boughtDec !== undefined
        ? Number(formatUnits(args.bought, args.boughtDec)).toFixed(6)
        : undefined;

    const prettyBurnedIn =
      args.burnedInRaw !== undefined && args.burnedInDec !== undefined
        ? Number(formatUnits(args.burnedInRaw, args.burnedInDec)).toFixed(6)
        : undefined;

    const prettyBurnedToby =
      args.burnedTobyRaw !== undefined
        ? Number(formatUnits(args.burnedTobyRaw, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
        : undefined;

    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setSuccess({
      hash: args.hash,
      bought: prettyBought,
      boughtSymbol: args.boughtSymbol,
      burnedInput: prettyBurnedIn,
      burnedSymbol: args.burnedSymbol,
      burnedToby: prettyBurnedToby,
    });
  }

  // UI state
  const [tokenIn, setTokenIn] = useState<Address | "ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<TokenChoice>(TOBY as Address);
  const [amt, setAmt] = useState<string>("");
  const isTaboshiPair = eq(String(tokenIn), TABOSHI) || eq(String(tokenOut), TABOSHI);
  // Keep the direct V3 fallback scoped only to TABOSHI. USDC uses the normal
  // TobySwapper route again so there is no separate "Direct on Base" lane.
  const isDirectPair = isTaboshiPair;
  const [slippage, setSlippage] = useState<number>(0.5);
  const [slippageOpen, setSlippageOpen] = useState(false);

  useEffect(() => {
    if (!slippageOpen) return;
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSlippageOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [slippageOpen]);

  useEffect(() => { setTokenIn("ETH"); setTokenOut(TOBY as Address); setAmt(""); }, [address, chainId]);
  useEffect(() => { if (connected) void ensureBase(); }, [connected, ensureBase]);

  const inMeta = byAddress(tokenIn);
  const outMeta = byAddress(tokenOut);
  const balInRaw = useTokenBalance(address, inMeta.address);
  const balOutRaw = useTokenBalance(address, outMeta.address);
  const inUsd = useUsdPriceSingle(inMeta.symbol === "ETH" ? "ETH" : (inMeta.address as Address));
  const outUsd = useUsdPriceSingle(outMeta.symbol === "ETH" ? "ETH" : (outMeta.address as Address));

  const [debouncedAmt, setDebouncedAmt] = useState(amt);
  useEffect(() => { const id = setTimeout(() => setDebouncedAmt(amt.trim()), 220); return () => clearTimeout(id); }, [amt]);

  const amountInBig = useMemo(() => { try { return parseUnits(debouncedAmt || "0", inMeta.decimals); } catch { return 0n; }}, [debouncedAmt, inMeta.decimals]);
  const amtNum = Number(debouncedAmt || "0");
  const amtInUsd = Number.isFinite(amtNum) ? amtNum * inUsd : 0;

  const [feeBps, setFeeBps] = useState<bigint>(100n);
  useEffect(() => {
    (async () => {
      if (!client) return;
      try {
        const bps = (await client.readContract({
          address: lc(SWAPPER as Address),
          abi: TobySwapperAbi as any,
          functionName: "feeBps",
          args: [],
        })) as bigint;
        if (bps >= 0n && bps <= 500n) setFeeBps(bps);
      } catch {}
    })();
  }, [client]);

  const mainAmountIn = useMemo(() => (amountInBig === 0n ? 0n : (amountInBig * (FEE_DENOM - feeBps)) / FEE_DENOM), [amountInBig, feeBps]);
  // Direct TABOSHI lane bypasses TobySwapper, so there is no burn fee to subtract.
  const routeAmountIn = isDirectPair ? amountInBig : mainAmountIn;
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "noroute" | "ok">("idle");
  const [quoteErr, setQuoteErr] = useState<string | undefined>();
  const [quoteOutMain, setQuoteOutMain] = useState<bigint | undefined>();
  const [bestV3, setBestV3] = useState<{ tokens: Address[]; fees: number[] } | undefined>();
  const [bestV2Path, setBestV2Path] = useState<Address[] | undefined>();
  const [bestFeePath, setBestFeePath] = useState<Address[] | undefined>();
  const [quoteBurnToby, setQuoteBurnToby] = useState<bigint | undefined>();
  const quoteLatch = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setQuoteErr(undefined); setQuoteOutMain(undefined); setBestV3(undefined); setBestV2Path(undefined); setBestFeePath(undefined); setQuoteBurnToby(undefined);

      if (!client || !isOnBase || routeAmountIn === 0n) { setQuoteState("idle"); return; }
      setQuoteState("loading");
      const myLatch = ++quoteLatch.current;

      let bestOut: bigint | undefined;
      let best: { tokens: Address[]; fees: number[] } | undefined;
      let v2Path: Address[] | undefined;
      let v2Out: bigint | undefined;
      let feePath: Address[] | undefined;
      let burnTobyEstimate: bigint | undefined;

      try {
        const quoteTokenOut = tokenOut === "ETH" ? (WETH as Address) : (tokenOut as Address);
        const cands = tokenOut === "ETH" ? [] : await buildV3CandidatesPruned(client, tokenIn, quoteTokenOut);
        if (cands.length) {
          const results = await withTimeout(
            Promise.allSettled(cands.map(async (cand) => {
              const path = encodeV3Path(cand.tokens, cand.fees);
              const [amountOut] = (await client.readContract({
                address: QUOTER_V3 as Address,
                abi: QuoterV3Abi as any,
                functionName: "quoteExactInput",
                args: [path, routeAmountIn],
              })) as [bigint];
              return { cand, amountOut };
            })), QUOTE_TIMEOUT_MS
          );
          for (const r of results) if (r.status === "fulfilled") {
            const { cand, amountOut } = (r as any).value;
            if (amountOut > 0n && (!bestOut || amountOut > bestOut)) { bestOut = amountOut; best = cand; }
          }
        }

        const v2 = isDirectPair ? undefined : await v2Quote(client, mainAmountIn, tokenIn, quoteTokenOut);
        if (v2 && v2.out > 0n) { v2Out = v2.out; v2Path = v2.path; }

        // The contract converts the fee to TOBY through Router02. Quote that
        // path too so the UI never offers a main route whose burn leg will fail.
        const feeAmount = amountInBig > mainAmountIn ? amountInBig - mainAmountIn : 0n;
        const actualIn = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
        if (isDirectPair) {
          // Direct V3 lanes bypass TobySwapper entirely.
          feePath = undefined;
          burnTobyEstimate = undefined;
        } else if (eq(actualIn, TOBY)) {
          feePath = [TOBY as Address, TOBY as Address];
          burnTobyEstimate = feeAmount;
        } else if (feeAmount > 0n) {
          const feeQuote = await v2Quote(client, feeAmount, actualIn, TOBY as Address);
          if (!feeQuote?.path) throw new Error("No V2 route is available for the TOBY burn fee.");
          feePath = feeQuote.path;
          burnTobyEstimate = feeQuote.out;
        } else {
          feePath = buildFeePathFor(actualIn);
        }

        // Native ETH input/output use the contract's dedicated V2 paths. WETH remains a distinct ERC-20.
        if ((tokenIn === "ETH" || tokenOut === "ETH") && v2Path && v2Out) {
          best = undefined; bestOut = v2Out;
        } else if (v2Out && (!bestOut || v2Out > bestOut)) {
          best = undefined; bestOut = v2Out;
        }
      } catch (e:any) {
        setQuoteErr(e?.shortMessage || e?.message || String(e));
      }

      if (!alive || myLatch !== quoteLatch.current) return;

      if (bestOut) {
        setQuoteOutMain(bestOut);
        setBestV3(best);
        setBestV2Path(best ? undefined : v2Path);
        setBestFeePath(feePath);
        setQuoteBurnToby(burnTobyEstimate);
        setQuoteState("ok");
      } else {
        setQuoteBurnToby(undefined);
        setQuoteState("noroute");
        setQuoteErr("No V3/V2 route found.");
      }
    })();
    return () => { alive = false; };
  }, [client, isOnBase, tokenIn, tokenOut, mainAmountIn, routeAmountIn, isDirectPair]); // eslint-disable-line

  const expectedOutMainHuman = useMemo(() => {
    try { return quoteOutMain ? Number(formatUnits(quoteOutMain, outMeta.decimals)) : undefined; } catch { return undefined; }
  }, [quoteOutMain, outMeta.decimals]);

  const minOutMain = useMemo(() => {
    if (!quoteOutMain || SAFE_MODE_MINOUT_ZERO) return 0n;
    return (quoteOutMain * BigInt(Math.round((100 - slippage) * 100))) / 10000n;
  }, [quoteOutMain, slippage]);
  const minOutMainHuman = useMemo(() => formatUnits(minOutMain, outMeta.decimals), [minOutMain, outMeta.decimals]);

  const tokenInAddr = inMeta.address as Address | undefined;

  const needsApproval = !!tokenInAddr && tokenIn !== "ETH";
  const approvalSpender = (isDirectPair ? SWAP_ROUTER_02 : SWAPPER) as Address;
  const { value: allowanceToSpender, isLoading: isAllowLoad, refetch: refetchAllowance } =
    useStickyAllowance(tokenInAddr, address as Address | undefined, approvalSpender);
  const { approveAmountFlow: approveToSpender, isPending: isApproving } =
    useApprove(tokenInAddr, approvalSpender);

  const [approveCooldown, setApproveCooldown] = useState(false);
  const onApprove = useCallback(async () => {
    if (!needsApproval || !connected || !tokenInAddr) return;
    setApproveCooldown(true);
    try {
      await approveToSpender(amountInBig, allowanceToSpender);
      await refetchAllowance();
      setApproveCooldown(false);
    } catch { setApproveCooldown(false); }
  }, [needsApproval, connected, tokenInAddr, approveToSpender, amountInBig, allowanceToSpender, refetchAllowance]);

  const showApproveButton =
    needsApproval && amountInBig > 0n && quoteState === "ok" && (allowanceToSpender ?? 0n) < amountInBig;

  const approveText =
    isApproving ? "Approving…" :
    isAllowLoad && !approveCooldown ? "Checking allowance…" :
    inMeta.symbol === "USDC" && amountInBig > 0n
      ? `Approve ${Number(formatUnits(amountInBig, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
      : (allowanceToSpender ?? 0n) > 0n ? `Update ${inMeta.symbol} approval` : `Approve ${inMeta.symbol}`;

  const [preflightMsg, setPreflightMsg] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [nativeSwapBusy, setNativeSwapBusy] = useState(false);
  function feePathForExecution(actualIn: Address) {
    return buildFeePathFor(actualIn);
  }

  async function afterTxConfirmed(txHash: `0x${string}`) {
    const pc = client;
    if (pc) { try { await pc.waitForTransactionReceipt({ hash: txHash }); } catch {} }
    if (address) {
      try {
        recordConfirmedSwap(address as Address, {
          hash: txHash,
          at: Date.now(),
          tokenIn: inMeta.symbol,
          tokenOut: outMeta.symbol,
          amountIn: formatUnits(amountInBig, inMeta.decimals),
          amountOut: quoteOutMain ? formatUnits(quoteOutMain, outMeta.decimals) : undefined,
          burnToby: quoteBurnToby ? formatUnits(quoteBurnToby, 18) : undefined,
          route: "pond",
        });
      } catch {}
    }
    invalidateBurnTotal();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("tobyswap:burn-updated", { detail: { hash: txHash } }));
    try { await balInRaw.refetch?.(); } catch {}
    try { await balOutRaw.refetch?.(); } catch {}
  }

  async function doDirectV3Swap() {
    if (!connected || !address) { setPreflightMsg("Connect your wallet first."); return; }
    if (!isOnBase) { await ensureBase(); return; }
    if (!client) { setPreflightMsg("No Base RPC client available."); return; }
    if (amountInBig === 0n) { setPreflightMsg("Enter an amount first."); return; }

    // Router02 can wrap native ETH when the V3 path starts with WETH. For the
    // reverse direction we intentionally return WETH rather than silently
    // pretending it is native ETH; switching to WETH keeps the flow explicit.
    if (tokenOut === "ETH") {
      setTokenOut(WETH as Address);
      setPreflightMsg("Direct V3 → ETH settles as WETH. I switched the receive token to WETH; swap again when the quote refreshes.");
      return;
    }

    if (!bestV3 || quoteState !== "ok" || !quoteOutMain) {
      setPreflightMsg("No live Uniswap V3 route is available for this pair right now.");
      return;
    }

    if (tokenIn !== "ETH" && (allowanceToSpender ?? 0n) < amountInBig) {
      setPreflightMsg(`Approve ${inMeta.symbol} for the direct Uniswap route first.`);
      return;
    }

    setPreflightMsg(undefined);
    setNativeSwapBusy(true);
    try {
      const path = encodeV3Path(bestV3.tokens, bestV3.fees);
      const params = {
        path,
        recipient: address as Address,
        amountIn: amountInBig,
        amountOutMinimum: minOutMain,
      };

      const sim = await withTimeout<any>((client.simulateContract as any)({
        address: SWAP_ROUTER_02,
        abi: SwapRouter02Abi,
        functionName: "exactInput",
        args: [params],
        account: address as Address,
        chain: base,
        value: tokenIn === "ETH" ? amountInBig : 0n,
      }), 10_000);

      const tx = await writeContractAsync(sim.request);
      try { await client.waitForTransactionReceipt({ hash: tx as `0x${string}` }); } catch {}
      try {
        recordConfirmedSwap(address as Address, {
          hash: tx as `0x${string}`,
          at: Date.now(),
          tokenIn: inMeta.symbol,
          tokenOut: outMeta.symbol,
          amountIn: formatUnits(amountInBig, inMeta.decimals),
          amountOut: quoteOutMain ? formatUnits(quoteOutMain, outMeta.decimals) : undefined,
          route: "direct",
        });
      } catch {}
      try { await balInRaw.refetch?.(); } catch {}
      try { await balOutRaw.refetch?.(); } catch {}

      showSuccessToast({
        hash: tx as `0x${string}`,
        bought: quoteOutMain,
        boughtDec: outMeta.decimals,
        boughtSymbol: outMeta.symbol,
      });
      setAmt("");
      setPreflightMsg("Swap confirmed through Uniswap V3. Direct TABOSHI lanes bypass the TobySwap burn.");
    } catch (error: any) {
      const message = error?.shortMessage || error?.message || String(error || "");
      if (/allowance|transfer amount exceeds allowance|STF/i.test(message)) {
        setPreflightMsg(`Approve ${inMeta.symbol} for Uniswap and try again.`);
      } else if (/Too little received|price|slippage/i.test(message)) {
        setPreflightMsg("The price moved before confirmation. Refresh the quote or raise slippage slightly and try again.");
      } else {
        setPreflightMsg(message && message !== "[object Object]" ? message : "The direct V3 route could not be submitted. Refresh the quote and try again.");
      }
    } finally {
      setNativeSwapBusy(false);
    }
  }

  async function handleDirectRouteAction() {
    if (!connected || !address) { setPreflightMsg("Connect your wallet first."); return; }
    if (!isOnBase) { await ensureBase(); return; }
    if (amountInBig === 0n) { setPreflightMsg("Enter an amount first."); return; }

    // The small route CTA and the large primary CTA share one real action.
    // If ERC-20 approval is still needed, request that first. Once confirmed,
    // the user can tap again to execute the direct V3 swap.
    if (needsApproval && (allowanceToSpender ?? 0n) < amountInBig) {
      await onApprove();
      return;
    }

    await doDirectV3Swap();
  }

  async function doSwap() {
    if (!connected || !isOnBase) { setPreflightMsg("Connect your wallet on Base to swap."); return; }
    if (amountInBig === 0n) return;
    if (!client) { setPreflightMsg("No RPC client available."); return; }

    setPreflightMsg(undefined);
    setSending(true);

    const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
    const decIn = inMeta.decimals;
    const decOut = outMeta.decimals;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);
    const pathForFeeSwap = bestFeePath ?? feePathForExecution(inAddr);
    const minOutFee = 0n;

    try {
      if (quoteState !== "ok" || !quoteOutMain) { setPreflightMsg("No valid quote."); setSending(false); return; }

      const isEthIn = tokenIn === "ETH";
      const isEthOut = tokenOut === "ETH";

      if (!isEthIn && (allowanceToSpender ?? 0n) < amountInBig) {
        setPreflightMsg(`Approve ${inMeta.symbol} first.`);
        setSending(false);
        return;
      }

      // PATIENCE is fee-on-transfer. Router02's supporting-fee functions compare
      // the recipient balance delta with amountOutMin, while getAmountsOut does not
      // include PATIENCE transfer tax. Using the raw quote as amountOutMin can therefore
      // revert with INSUFFICIENT_OUTPUT_AMOUNT even when the route itself is healthy.
      // Keep the quote visible in the UI, but let Router02 execute PATIENCE V2 routes
      // without a pre-tax minimum. Other V2 pairs keep the user's slippage minimum.
      const patienceV2Route = eq(String(tokenIn), PATIENCE) || eq(String(tokenOut), PATIENCE);
      const minOutMainV2 = patienceV2Route ? 0n : minOutMain;

      // ---- ETH-IN handling ----
      if (isEthIn) {
        if (bestV2Path) {
          // ETH-in with a valid V2 route
          const mainPath = bestV2Path;
          const sim = await (client as any).simulateContract({
            address: SWAPPER as Address,
            abi: TobySwapperAbi,
            functionName: "swapETHForTokensSupportingFeeOnTransferTokensTo",
            args: [
              (tokenOut === "ETH" ? WETH : tokenOut) as Address,
              address as Address,
              minOutMainV2,
              mainPath,
              pathForFeeSwap,
              minOutFee,
              deadline,
            ],
            account: address as Address,
            chain: base,
            value: parseUnits(amt || "0", 18),
          });
          const tx = await writeContractAsync(sim.request);

          await afterTxConfirmed(tx as `0x${string}`);
          showSuccessToast({
            hash: tx as `0x${string}`,
            bought: quoteOutMain,
            boughtDec: decOut,
            boughtSymbol: outMeta.symbol,
            burnedInRaw: (amountInBig * feeBps) / FEE_DENOM,
            burnedInDec: decIn,
            burnedSymbol: inMeta.symbol,
            burnedTobyRaw: quoteBurnToby,
          });
          setAmt("");
          setSending(false);
          return;
        }

        // ETH-in but NO V2 route: nudge to WETH for V3 routing
        if (!bestV2Path && bestV3) {
          setTokenIn(WETH as Address);
          setPreflightMsg("No V2 route for ETH → this token. Switched input to WETH to route via V3 — approve WETH (if needed) and swap.");
          setSending(false);
          return;
        }

        setPreflightMsg("No available route for this pair/size.");
        setSending(false);
        return;
      }
      // ---- end ETH-IN handling ----

      if (bestV3) {
        const v3Path = encodeV3Path(bestV3.tokens, bestV3.fees);
        const paramsBytes = encodeAbiParameters(
          [{
            type: "tuple",
            components: [
              { name: "path", type: "bytes" },
              { name: "recipient", type: "address" },
              { name: "amountIn", type: "uint256" },
              { name: "amountOutMinimum", type: "uint256" },
            ],
          }],
          [{
            path: v3Path,
            recipient: address as Address,
            // Base uses Uniswap SwapRouter02 / IV3SwapRouter ExactInputParams.
            // That struct has NO deadline field. Encoding the legacy five-field
            // V3 struct makes the router calldata invalid and the contract preflight revert.
            // TobySwapper still receives the full outer amount and splits its fee; only
            // the post-fee main amount is sent through the V3 route.
            amountIn: mainAmountIn,
            amountOutMinimum: minOutMain,
          }]
        );

        const sim = await withTimeout<any>((client.simulateContract as any)({
          address: SWAPPER as Address,
          abi: TobySwapperAbi,
          functionName: "swapTokensForTokensV3ExactInput",
          args: [
            inAddr,
            tokenOut as Address,
            address as Address,
            parseUnits(amt || "0", decIn),
            paramsBytes,
            pathForFeeSwap,
            minOutFee,
          ],
          account: address as Address,
          chain: base,
        }), 10_000);

        const tx = await writeContractAsync(sim.request);

        await afterTxConfirmed(tx as `0x${string}`);
        showSuccessToast({
          hash: tx as `0x${string}`,
          bought: quoteOutMain,
          boughtDec: decOut,
          boughtSymbol: outMeta.symbol,
          burnedInRaw: 0n,
          burnedInDec: decIn,
          burnedSymbol: inMeta.symbol,
          burnedTobyRaw: quoteBurnToby,
        });
        setAmt("");
        setSending(false);
        return;
      }

      if (isEthOut) {
        const mainPath = bestV2Path ?? [inAddr, WETH as Address];
        const sim = await (client as any).simulateContract({
          address: SWAPPER as Address,
          abi: TobySwapperAbi,
          functionName: "swapTokensForETHSupportingFeeOnTransferTokensTo",
          args: [
            inAddr,
            address as Address,
            parseUnits(amt || "0", decIn),
            minOutMainV2,
            mainPath,
            pathForFeeSwap,
            minOutFee,
            deadline,
          ],
          account: address as Address,
          chain: base,
        });
        const tx = await writeContractAsync(sim.request);

        await afterTxConfirmed(tx as `0x${string}`);
        showSuccessToast({
          hash: tx as `0x${string}`,
          bought: quoteOutMain,
          boughtDec: decOut,
          boughtSymbol: outMeta.symbol,
          burnedInRaw: 0n,
          burnedInDec: decIn,
          burnedSymbol: inMeta.symbol,
          burnedTobyRaw: quoteBurnToby,
        });
        setAmt("");
      } else {
        const mainPath = bestV2Path ?? [inAddr, tokenOut as Address];
        const sim = await (client as any).simulateContract({
          address: SWAPPER as Address,
          abi: TobySwapperAbi,
          functionName: "swapTokensForTokensSupportingFeeOnTransferTokensTo",
          args: [
            inAddr,
            tokenOut as Address,
            address as Address,
            parseUnits(amt || "0", decIn),
            minOutMainV2,
            mainPath,
            pathForFeeSwap,
            minOutFee,
            deadline,
          ],
          account: address as Address,
          chain: base,
        });
        const tx = await writeContractAsync(sim.request);

        await afterTxConfirmed(tx as `0x${string}`);
        showSuccessToast({
          hash: tx as `0x${string}`,
          bought: quoteOutMain,
          boughtDec: decOut,
          boughtSymbol: outMeta.symbol,
          burnedInRaw: 0n,
          burnedInDec: decIn,
          burnedSymbol: inMeta.symbol,
          burnedTobyRaw: quoteBurnToby,
        });
        setAmt("");
      }
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      if (/timeout/i.test(msg)) setPreflightMsg("RPC timed out. Please try again.");
      else if (/HTTP/i.test(msg)) setPreflightMsg("Network RPC error. Try again.");
      else if (/swapTokensForTokensV3ExactInput/i.test(msg) && /revert/i.test(msg))
        setPreflightMsg("That V3 route failed its onchain preflight. Refresh the quote and try again. TobySwap now uses Base SwapRouter02's four-field ExactInputParams and sends only the post-fee amount through V3.");
      else setPreflightMsg(msg);
    } finally {
      setSending(false);
    }
  }

  const disableReason = useMemo(() => {
    if (!connected) return "Connect wallet";
    if (!isOnBase) return "Switch to Base";
    if (amountInBig === 0n) return "Enter amount";
    if ((balInRaw.value ?? 0n) < amountInBig) return "Insufficient balance";
    if (quoteState !== "ok") return quoteState === "loading" ? "Finding route…" : "No route";
    if (sending) return "Submitting…";
    return null;
  }, [connected, isOnBase, amountInBig, balInRaw.value, quoteState, sending]);

  const disableSwap = !!disableReason;
  const nativeDisableReason = useMemo(() => {
    if (!connected) return "Connect wallet";
    if (!isOnBase) return "Switch to Base";
    if (amountInBig === 0n) return "Enter amount";
    if ((balInRaw.value ?? 0n) < amountInBig) return "Insufficient balance";
    if (quoteState !== "ok" || !bestV3) return quoteState === "loading" ? "Finding V3 route…" : "No V3 route";
    if (nativeSwapBusy) return "Submitting…";
    return null;
  }, [connected, isOnBase, amountInBig, balInRaw.value, quoteState, bestV3, needsApproval, allowanceToSpender, inMeta.symbol, nativeSwapBusy]);

  const routeLabel = isDirectPair ? "Direct Uniswap V3" : bestV3 ? "Uniswap V3" : bestV2Path ? "Uniswap V2" : "Routing";
  const feePct = Number(feeBps) / 100;
  const receiveHuman = quoteState === "ok" && expectedOutMainHuman !== undefined
    ? expectedOutMainHuman.toLocaleString(undefined, { maximumFractionDigits: 6 })
    : quoteState === "loading" ? "…" : "0.00";
  const receiveUsd = quoteState === "ok" && expectedOutMainHuman !== undefined
    ? expectedOutMainHuman * outUsd
    : 0;

  return (
    <div className="swap-shell world-card p-4 sm:p-6">
      <div className="swap-head">
        <div className="flex items-center gap-3 min-w-0">
          <div className="swap-mascot-stack" aria-hidden="true">
            <img src="/tokens/toby.PNG" alt="" className="swap-mascot-toby" />
            <img src="/tokens/sato.jpg" alt="" className="swap-mascot-sato" />
          </div>
          <div className="min-w-0">
            <div className="world-kicker">SWAP GATE</div>
            <h2 className="mt-1 text-xl sm:text-2xl font-black tracking-[-.04em]">Trade the pond</h2>
            <div className="text-[11px] text-inkSub mt-1">TOBY · PATIENCE · TABOSHI · ETH · WETH</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) document.activeElement.blur();
            setSlippageOpen(true);
          }}
          className="metal-button compact-metal swap-settings-button"
          aria-label="Slippage settings"
          title="Slippage settings"
        >
          <GearIcon className="w-4 h-4" />
          <span>{slippage}%</span>
        </button>
      </div>

      <div className="swap-status-row">
        <span className={`route-status ${isOnBase ? "route-status-live" : ""}`}>
          <span className="status-dot !mr-0" /> Base {isOnBase ? "connected" : "required"}
        </span>
        <span className="route-status">{isDirectPair ? "Direct V3 · connected wallet" : quoteState === "ok" ? `Best route · ${routeLabel}` : quoteState === "loading" ? "Searching liquidity…" : "Smart routing"}</span>
        <span className="route-status">{isDirectPair ? "Direct route · no burn" : `${feePct}% → TOBY burn`}</span>
      </div>

      {!isOnBase && (
        <div className="swap-alert mt-3">
          <div><strong>Base network required.</strong><br /><span>Switch networks to quote and swap.</span></div>
          <button onClick={ensureBase} className="metal-button compact-metal px-3">Switch</button>
        </div>
      )}

      <div className="swap-trade-stack mt-4">
        <section className="trade-panel trade-panel-pay">
          <div className="trade-panel-labels">
            <span>You pay</span>
            <span>
              {balInRaw.value !== undefined ? `Balance ${Number(formatUnits(balInRaw.value, inMeta.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })}` : "Balance —"}
            </span>
          </div>

          <div className="trade-main-row">
            <div className="trade-amount-wrap">
              <input
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                className="trade-amount-input"
                placeholder="0"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                name="swap-amount"
                aria-label={`Amount of ${inMeta.symbol} to swap`}
              />
              <div className="trade-usd">≈ ${Number.isFinite(amtInUsd) ? amtInUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</div>
            </div>
            <div className="trade-token-side">
              <TokenSelect
                user={address as Address | undefined}
                value={tokenIn}
                onChange={(a) => {
                  setTokenIn(a);
                  setAmt("");
                }}
                exclude={tokenOut}
                balance={balInRaw.value !== undefined ? Number(formatUnits(balInRaw.value, inMeta.decimals)).toFixed(6) : undefined}
                forceBlur={slippageOpen || !!success}
              />
            </div>
          </div>

          {connected && balInRaw.value !== undefined && balInRaw.value < amountInBig && (
            <div className="trade-warning">Insufficient {inMeta.symbol === "ETH" ? "ETH on Base" : inMeta.symbol} balance.</div>
          )}
        </section>

        <button
          className="metal-button swap-direction-button swap-direction-floating"
          onClick={() => {
            const prevIn = tokenIn, prevOut = tokenOut;
            setTokenIn(prevOut);
            setTokenOut(prevIn);
            setAmt("");
          }}
          aria-label="Reverse swap direction"
          title="Reverse swap direction"
        >
          <span aria-hidden="true">↓↑</span>
        </button>

        <section className="trade-panel trade-panel-receive">
          <div className="trade-panel-labels">
            <span>You receive</span>
            <span>{quoteState === "ok" ? "Estimated" : quoteState === "loading" ? "Quoting…" : "Enter amount"}</span>
          </div>
          <div className="trade-main-row">
            <div className="trade-amount-wrap min-w-0">
              <div className={`trade-output ${quoteState === "loading" ? "quote-shimmer" : ""}`}>{receiveHuman}</div>
              <div className="trade-usd">≈ ${Number.isFinite(receiveUsd) ? receiveUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</div>
            </div>
            <div className="trade-token-side">
              <TokenSelect
                user={address as Address | undefined}
                value={tokenOut}
                onChange={(v) => {
                  setTokenOut(v);
                  setAmt("");
                }}
                exclude={tokenIn}
                balance={balOutRaw.value !== undefined ? Number(formatUnits(balOutRaw.value, outMeta.decimals)).toFixed(6) : undefined}
                forceBlur={slippageOpen || !!success}
              />
            </div>
          </div>
        </section>
      </div>

      {isDirectPair && (
        <div className="weth-route-callout">
          <span className="weth-route-orb"><img src="/tokens/toby.PNG" alt="" /></span>
          <div className="min-w-0 flex-1">
            <strong>TABOSHI · Direct V3</strong>
            <p>Live Uniswap liquidity on Base.</p>
            <small>Direct route · no burn credit.</small>
          </div>
          <button
            type="button"
            onClick={handleDirectRouteAction}
            className="metal-button compact-metal whitespace-nowrap"
            disabled={nativeSwapBusy || isApproving || quoteState !== "ok"}
            title={showApproveButton ? `Approve ${inMeta.symbol} for Uniswap V3` : `Swap ${inMeta.symbol} → ${outMeta.symbol} on Base`}
          >
            {isApproving ? "Approving…" : nativeSwapBusy ? "Submitting…" : showApproveButton ? `Approve ${inMeta.symbol}` : "Swap on Base"}
          </button>
        </div>
      )}

      {quoteState === "loading" && amountInBig > 0n && (
        <div className="pond-route-loader" aria-live="polite">
          <div className="pond-route-line" />
          <img src="/tokens/toby.PNG" alt="" className="route-toby" />
          <img src="/tokens/sato.jpg" alt="" className="route-sato" />
          <span>Finding the best pond route</span>
        </div>
      )}

      {quoteState === "ok" && expectedOutMainHuman !== undefined && (
        <div className="quote-receipt">
          <div className="quote-receipt-row">
            <span>Route</span>
            <strong>{routeLabel}</strong>
          </div>
          <div className="quote-receipt-row">
            <span>Minimum received</span>
            <strong className="font-mono">{Number(minOutMainHuman).toLocaleString(undefined, { maximumFractionDigits: 6 })} {outMeta.symbol}</strong>
          </div>
          <div className="quote-receipt-row">
            <span>Slippage</span>
            <strong>{slippage}%</strong>
          </div>
          <div className="quote-receipt-row quote-burn-row">
            <span>{isDirectPair ? "Burn credit" : "Protocol burn"}</span>
            <strong>{isDirectPair ? "No burn on direct route" : quoteBurnToby ? `~${Number(formatUnits(quoteBurnToby, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} TOBY 🔥` : `${feePct}% of input → TOBY 🔥`}</strong>
          </div>
        </div>
      )}

      {!isDirectPair && quoteState === "noroute" && amountInBig > 0n && (
        <div className="swap-alert mt-3">
          <div><strong>No route found.</strong><br /><span>Try a different amount or pair.{quoteErr ? ` ${quoteErr}` : ""}</span></div>
        </div>
      )}

      {showApproveButton && (
        <button
          onClick={onApprove}
          className="metal-button w-full approve-button mt-4 justify-center font-black disabled:opacity-60"
          disabled={isApproving || !connected || !isOnBase || approveCooldown}
          title={`Approve ${inMeta.symbol} for ${isDirectPair ? "Uniswap V3" : "TobySwapper"}`}
        >
          <span className="button-mini-medallion"><img src="/tokens/toby.PNG" alt="" /></span>
          {approveText}
        </button>
      )}

      {isDirectPair ? (
        <button
          onClick={handleDirectRouteAction}
          className="metal-button metal-button-primary swap-submit swap-submit-premium w-full justify-center font-black disabled:opacity-60 mt-4"
          disabled={!!nativeDisableReason}
          title={nativeDisableReason ?? "Swap directly on Uniswap V3"}
        >
          {!nativeDisableReason && <span className="swap-button-shine" aria-hidden="true" />}
          <span className="button-mini-medallion"><img src="/tokens/toby.PNG" alt="" /></span>
          <span>{nativeDisableReason || (showApproveButton ? `Approve ${inMeta.symbol} for V3` : `Swap ${inMeta.symbol} → ${outMeta.symbol}`)}</span>
          {!nativeDisableReason && <span className="swap-button-route">V3</span>}
        </button>
      ) : (
        <button
          onClick={doSwap}
          className="metal-button metal-button-primary swap-submit swap-submit-premium w-full justify-center font-black disabled:opacity-60 mt-4"
          disabled={disableSwap}
          title={disableReason ?? "Swap"}
        >
          {!disableSwap && <span className="swap-button-shine" aria-hidden="true" />}
          <span className="button-mini-medallion"><img src="/tokens/sato.jpg" alt="" /></span>
          <span>{disableReason ? disableReason : sending ? "Sending through the pond…" : `Swap ${inMeta.symbol} → ${outMeta.symbol}`}</span>
          {!disableSwap && <span className="swap-button-route">{bestV3 ? "V3" : "V2"}</span>}
        </button>
      )}

      {isDirectPair && (
        <p className="taboshi-note">Direct Uniswap V3 · no TOBY burn.</p>
      )}

      {preflightMsg && <div className="swap-alert mt-3 text-[11px]">{preflightMsg}</div>}

      <div className="swap-footnote">
        <span>Quotes are estimates.</span>
        <span>Transactions settle on Base.</span>
      </div>

      {success && (
        <SuccessToast
          hash={success.hash}
          bought={success.bought}
          boughtSymbol={success.boughtSymbol}
          burnedInput={success.burnedInput}
          burnedSymbol={success.burnedSymbol}
          burnedToby={success.burnedToby}
          onClose={() => setSuccess(null)}
        />
      )}

      {slippageOpen && (
        <Portal>
          <div className="fixed inset-0 z-[10000]">
            <div className="absolute inset-0 z-0 bg-[#1c2933]/25 backdrop-blur-[3px]" onClick={() => setSlippageOpen(false)} />
            <div role="dialog" aria-modal="true" className="token-modal-card relative z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-5 w-[90%] max-w-sm pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <div><div className="world-kicker">TRADE SETTINGS</div><h4 className="font-black text-xl mt-1">Slippage tolerance</h4></div>
                <button className="metal-button compact-metal text-xs px-3" onClick={() => setSlippageOpen(false)}>Close</button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[0.1, 0.5, 1, 2].map((v) => (
                  <button key={v} onClick={() => setSlippage(v)} className={`metal-button justify-center px-3 py-2 text-xs font-black ${slippage === v ? "metal-button-selected" : ""}`}>
                    {v}%
                  </button>
                ))}
              </div>
              <div className="slippage-custom">
                <input type="number" min="0" step="0.1" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} className="bg-transparent outline-none w-full text-xl font-black" />
                <span className="text-sm font-black text-inkSub">%</span>
              </div>
              <p className="text-[11px] text-inkSub mt-3 leading-relaxed">Your transaction will revert rather than execute below the minimum received amount implied by this tolerance.</p>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
