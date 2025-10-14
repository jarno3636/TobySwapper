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

import TokenSelect from "./TokenSelect";
import {
  TOKENS, USDC, WETH, SWAPPER, TOBY, QUOTER_V3,
} from "@/lib/addresses";

import { useUsdPriceSingle } from "@/lib/prices";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useStickyAllowance, useApprove } from "@/hooks/useAllowance";
import { useInvalidateBurnTotal } from "@/lib/burn";

/* ---------------------------------- Config --------------------------------- */
const SAFE_MODE_MINOUT_ZERO = false; // keep for V3; V2 uses 0 minOut below
const FEE_DENOM = 10_000n;
const GAS_BUFFER_ETH = 0.0005;
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
  const hubs = [inAddr, WETH as Address, USDC as Address, tokenOut] as Address[];

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
  const tryPaths: Address[][] = [
    [inAddr, tokenOut],
    [inAddr, WETH as Address, tokenOut],
  ];
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
  return [t as Address, WETH as Address, TOBY as Address];
}

/* ---------------------------- UI small helper ------------------------------ */
function GearIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        d="M10.325 4.317a1 1 0 0 1 1.35-.436l.7.35a1 1 0 0 0 .894 0l.7-.35a1 1 0 0 1 1.35.436l.35.7a1 1 0 0 0 .5.5l.7.35a1 1 0 0 1 .436 1.35l-.35.7a1 1 0 0 0 0 .894l.35.7a1 1 0 0 1-.436 1.35l-.7.35a1 1 0 0 0-.5.5l-.35.7a1 1 0 0 1-1.35.436l-.7-.35a1 1 0 0 0-.894 0l-.7.35a1 1 0 0 1-1.35-.436l-.35-.7a1 1 0 0 0-.5-.5l-.7-.35a1 1 0 0 1-.436-1.35l.35-.7a1 1 0 0 0 0-.894l-.35-.7a1 1 0 0 1 .436-1.35l.7-.35a1 1 0 0 0 .5-.5l.35-.7Z" />
      <circle cx="12" cy="12" r="3" strokeWidth="2" />
    </svg>
  );
}

/* ------------------------------- Portals ----------------------------------- */
function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/* ---- Success Toast (inline component) ---- */
function SuccessToast({
  onClose,
  hash,
  bought,
  boughtSymbol,
  burnedInput,
  burnedSymbol,
}: {
  onClose: () => void;
  hash: `0x${string}`;
  bought?: string;
  boughtSymbol?: string;
  burnedInput?: string;
  burnedSymbol?: string;
}) {
  useEffect(() => {
    const id = setTimeout(onClose, 6500);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <Portal>
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[11000] w-[calc(100%-1.5rem)] max-w-md isolate"
        aria-live="polite"
      >
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500 bg-emerald-600 shadow-2xl p-4 text-white pointer-events-auto">
          <button
            onClick={onClose}
            className="absolute right-2 top-2 rounded-full px-2 py-1 text-xs bg-white/15 hover:bg-white/25"
            aria-label="Close"
          >
            Close
          </button>

          <div className="flex items-start gap-3 pr-14">
            <div className="text-2xl leading-none">✅</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Swap confirmed</div>

              <div className="mt-1 text-sm break-words">
                {bought && boughtSymbol && (
                  <div>
                    Received (est.):&nbsp;
                    <span className="font-mono">~{bought}</span> {boughtSymbol}
                  </div>
                )}
                {burnedInput && burnedSymbol && (
                  <div>
                    Burn fee (input est.):&nbsp;
                    <span className="font-mono">~{burnedInput}</span> {burnedSymbol}
                  </div>
                )}
                <div className="truncate">
                  Tx:&nbsp;
                  <a
                    className="underline"
                    href={`https://basescan.org/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {hash.slice(0, 10)}…{hash.slice(-8)}
                  </a>
                </div>
                <div className="mt-1 text-[11px] text-white/80">
                  Values shown are estimates. Refer to the transaction on Basescan for exact amounts.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ---------------------------------- View ----------------------------------- */
export default function SwapForm() {
  const { address, chainId, isConnected } = useAccount();
  const { isOnBase, ensureBase } = useNetworkGuard();
  const client = usePublicClient({ chainId: base.id }); // pin to Base
  const { writeContractAsync } = useWriteContract();
  const invalidateBurnTotal = useInvalidateBurnTotal();

  // Success toast state
  const [success, setSuccess] = useState<{
    hash: `0x${string}`;
    bought?: string;
    boughtSymbol?: string;
    burnedInput?: string;
    burnedSymbol?: string;
  } | null>(null);

  function showSuccessToast(args: {
    hash: `0x${string}`;
    bought?: bigint;
    boughtDec?: number;
    boughtSymbol?: string;
    burnedInRaw?: bigint;
    burnedInDec?: number;
    burnedSymbol?: string;
  }) {
    const prettyBought =
      args.bought !== undefined && args.boughtDec !== undefined
        ? Number(formatUnits(args.bought, args.boughtDec)).toFixed(6)
        : undefined;

    const prettyBurnedIn =
      args.burnedInRaw !== undefined && args.burnedInDec !== undefined
        ? Number(formatUnits(args.burnedInRaw, args.burnedInDec)).toFixed(6)
        : undefined;

    // Kill any native <select> overlays before showing the toast
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setSuccess({
      hash: args.hash,
      bought: prettyBought,
      boughtSymbol: args.boughtSymbol,
      burnedInput: prettyBurnedIn,
      burnedSymbol: args.burnedSymbol,
    });
  }

  // UI state
  const [tokenIn, setTokenIn] = useState<Address | "ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<Address>(TOBY as Address);
  const [amt, setAmt] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(0.5);
  const [slippageOpen, setSlippageOpen] = useState(false);

  // Body scroll lock & close native pickers when modal opens
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
  useEffect(() => { if (isConnected) void ensureBase(); }, [isConnected, ensureBase]);

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
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "noroute" | "ok">("idle");
  const [quoteErr, setQuoteErr] = useState<string | undefined>();
  const [quoteOutMain, setQuoteOutMain] = useState<bigint | undefined>();
  const [bestV3, setBestV3] = useState<{ tokens: Address[]; fees: number[] } | undefined>();
  const [bestV2Path, setBestV2Path] = useState<Address[] | undefined>();
  const quoteLatch = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setQuoteErr(undefined); setQuoteOutMain(undefined); setBestV3(undefined); setBestV2Path(undefined);

      if (!client || !isOnBase || mainAmountIn === 0n || !isAddress(tokenOut)) { setQuoteState("idle"); return; }
      setQuoteState("loading");
      const myLatch = ++quoteLatch.current;

      let bestOut: bigint | undefined;
      let best: { tokens: Address[]; fees: number[] } | undefined;
      let v2Path: Address[] | undefined;
      let v2Out: bigint | undefined;

      try {
        const cands = await buildV3CandidatesPruned(client, tokenIn, tokenOut);
        if (cands.length) {
          const results = await withTimeout(
            Promise.allSettled(cands.map(async (cand) => {
              const path = encodeV3Path(cand.tokens, cand.fees);
              const [amountOut] = (await client.readContract({
                address: QUOTER_V3 as Address,
                abi: QuoterV3Abi as any,
                functionName: "quoteExactInput",
                args: [path, mainAmountIn],
              })) as [bigint];
              return { cand, amountOut };
            })), QUOTE_TIMEOUT_MS
          );
          for (const r of results) if (r.status === "fulfilled") {
            const { cand, amountOut } = (r as any).value;
            if (amountOut > 0n && (!bestOut || amountOut > bestOut)) { bestOut = amountOut; best = cand; }
          }
        }

        const v2 = await v2Quote(client, mainAmountIn, tokenIn, tokenOut as Address);
        if (v2 && v2.out > 0n) { v2Out = v2.out; v2Path = v2.path; }

        if (tokenIn === "ETH" && v2Path && v2Out) {
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
        setQuoteState("ok");
      } else {
        setQuoteState("noroute");
        setQuoteErr("No V3/V2 route found.");
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

  const tokenInAddr = inMeta.address as Address | undefined;

  const needsApproval = !!tokenInAddr && tokenIn !== "ETH";
  const { value: allowanceToSwapper, isLoading: isAllowLoad, refetch: refetchAllowance } =
    useStickyAllowance(tokenInAddr, address as Address | undefined, SWAPPER as Address);
  const { approveMaxFlow: approveMaxToSwapper, isPending: isApproving } =
    useApprove(tokenInAddr, SWAPPER as Address);

  const [approveCooldown, setApproveCooldown] = useState(false);
  const onApprove = useCallback(async () => {
    if (!needsApproval || !isConnected || !tokenInAddr) return;
    setApproveCooldown(true);
    try {
      await approveMaxToSwapper(allowanceToSwapper);
      setTimeout(() => { refetchAllowance(); setApproveCooldown(false); }, 2000);
    } catch { setApproveCooldown(false); }
  }, [needsApproval, isConnected, tokenInAddr, approveMaxToSwapper, allowanceToSwapper, refetchAllowance]);

  const showApproveButton =
    needsApproval && amountInBig > 0n && (allowanceToSwapper ?? 0n) < amountInBig;

  const approveText =
    isApproving ? "Approving…" :
    isAllowLoad && !approveCooldown ? "Checking allowance…" :
    (allowanceToSwapper ?? 0n) > 0n ? `Re-approve ${inMeta.symbol}` : `Approve ${inMeta.symbol}`;

  const [preflightMsg, setPreflightMsg] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  function feePathForExecution(actualIn: Address) {
    return buildFeePathFor(actualIn);
  }

  async function afterTxConfirmed(txHash: `0x${string}`) {
    const pc = client;
    if (pc) {
      try { await pc.waitForTransactionReceipt({ hash: txHash }); } catch {}
    }
    invalidateBurnTotal();
  }

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
    const pathForFeeSwap = feePathForExecution(inAddr);
    const minOutFee = 0n;

    try {
      if (quoteState !== "ok" || !quoteOutMain) { setPreflightMsg("No valid quote."); setSending(false); return; }

      const isEthIn = tokenIn === "ETH";
      const isEthOut = outMeta.symbol === "ETH";

      if (!isEthIn && (allowanceToSwapper ?? 0n) < amountInBig) {
        setPreflightMsg(`Approve ${inMeta.symbol} first.`);
        setSending(false);
        return;
      }

      // For all V2 routes we set minOutMainV2 = 0n to avoid fee-on-transfer reverts
      const minOutMainV2 = 0n;

      if (isEthIn) {
        const mainPath = bestV2Path ?? [WETH as Address, tokenOut as Address];
        const sim = await (client as any).simulateContract({
          address: SWAPPER as Address,
          abi: TobySwapperAbi,
          functionName: "swapETHForTokensSupportingFeeOnTransferTokensTo",
          args: [
            tokenOut as Address,
            address as Address,
            minOutMainV2, // V2: zero minOut
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
        });
        setSending(false);
        return;
      }

      if (bestV3) {
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
            amountOutMinimum: parseUnits(formatUnits(minOutMain, decOut), decOut),
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
          burnedInRaw: (amountInBig * feeBps) / FEE_DENOM,
          burnedInDec: decIn,
          burnedSymbol: inMeta.symbol,
        });
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
            minOutMainV2, // V2: zero minOut
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
          burnedInRaw: (amountInBig * feeBps) / FEE_DENOM,
          burnedInDec: decIn,
          burnedSymbol: inMeta.symbol,
        });
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
            minOutMainV2, // V2: zero minOut
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
          burnedInRaw: (amountInBig * feeBps) / FEE_DENOM,
          burnedInDec: decIn,
          burnedSymbol: inMeta.symbol,
        });
      }
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      if (/timeout/i.test(msg)) setPreflightMsg("RPC timed out. Please try again.");
      else if (/HTTP/i.test(msg)) setPreflightMsg("Network RPC error. Try again.");
      else setPreflightMsg(msg);
    } finally {
      setSending(false);
    }
  }

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

          {/* Slippage / Settings button */}
          <button
            type="button"
            onClick={() => setSlippageOpen(true)}
            className="ml-3 pill pill-opaque px-2 py-1 inline-flex items-center gap-1"
            aria-label="Slippage settings"
            title="Slippage settings"
          >
            <GearIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{slippage}%</span>
          </button>
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
          user={address as Address | undefined}
          value={tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address)}
          onChange={(a) => { setTokenIn(eq(a, WETH) ? "ETH" : (a as Address)); setAmt(""); }}
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

        {/* Approve (SWAPPER) */}
        {showApproveButton && (
          <div className="mt-3">
            <button
              onClick={onApprove}
              className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
              disabled={isApproving || !isConnected || !isOnBase || approveCooldown}
              title={`Approve ${inMeta.symbol} for ${SWAPPER}`}
            >
              {approveText}
            </button>
            <div className="mt-1 text-[11px] text-inkSub">
              Spender: <code className="break-all">{SWAPPER as Address}</code>
              {(allowanceToSwapper !== undefined) && <> · Allowance: <span className="font-mono">{(allowanceToSwapper).toString()}</span></>}
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
          user={address as Address | undefined}
          value={tokenOut}
          onChange={(v) => {
            const next = isAddress(String(v)) ? (v as Address) : (WETH as Address);
            setTokenOut(next);
            setAmt("");
          }}
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
      </div>

      {/* Swap */}
      <button
        onClick={doSwap}
        className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60 mt-4"
        disabled={disableSwap}
        title="Swap"
      >
        {sending ? "Submitting…" : bestV3 ? `Swap & Burn ${Number(feeBps) / 100}% 🔥 (V3 via SWAPPER)` : "Swap (via SWAPPER V2)"}
      </button>

      {preflightMsg && <div className="text-[11px] text-warn mt-2">{preflightMsg}</div>}

      {/* Success Toast */}
      {success && (
        <SuccessToast
          hash={success.hash}
          bought={success.bought}
          boughtSymbol={success.boughtSymbol}
          burnedInput={success.burnedInput}
          burnedSymbol={success.burnedSymbol}
          onClose={() => setSuccess(null)}
        />
      )}

      {/* Slippage modal (portaled, strong z-index & explicit stacking) */}
      {slippageOpen && (
        <Portal>
          <div className="fixed inset-0 z-[10000]">
            <div
              className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSlippageOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="relative z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-strong rounded-2xl p-5 w-[90%] max-w-sm border border-white/10 pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Slippage</h4>
                <button
                  className="pill pill-opaque px-3 py-1 text-xs"
                  onClick={() => setSlippageOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[0.1, 0.5, 1, 2].map((v) => (
                  <button
                    key={v}
                    onClick={() => setSlippage(v)}
                    className={`pill justify-center px-3 py-1 text-xs ${slippage === v ? "outline outline-1 outline-white/20" : ""}`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                  className="glass rounded-pill px-3 py-2 w-full"
                />
                <span className="text-sm text-inkSub">%</span>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
