"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Address,
  formatUnits,
  parseUnits,
  isAddress,
  createPublicClient,
  http,
  encodePacked,
  encodeAbiParameters,
} from "viem";
import { base } from "viem/chains";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useSwitchChain,
} from "wagmi";
import TokenSelect from "./TokenSelect";
import {
  TOKENS,
  USDC,
  WETH,
  SWAPPER,
  TOBY,
  QUOTER_V3, // v3 quoter for estimates
} from "@/lib/addresses";
import { useUsdPriceSingle } from "@/lib/prices";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import TobySwapperAbi from "@/abi/TobySwapper.json";
import { useStickyAllowance, useApprove } from "@/hooks/useAllowance";

/* ---------- Config ---------- */
const SAFE_MODE_MINOUT_ZERO = false;
const FEE_DENOM = 10_000n;
const GAS_BUFFER_ETH = 0.0005;

/* ---------- Minimal ABIs ---------- */
const QuoterV2Abi = [
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

/* ---------- helpers ---------- */
function byAddress(addr?: Address | "ETH") {
  if (!addr || addr === "ETH") return { symbol: "ETH", decimals: 18 as const, address: undefined };
  const t = TOKENS.find((t) => t.address.toLowerCase() === String(addr).toLowerCase());
  return t
    ? { symbol: t.symbol, decimals: (t.decimals ?? 18) as 18 | 6, address: t.address as Address }
    : { symbol: "TOKEN", decimals: 18 as const, address: addr as Address };
}
const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const lc = (a: Address) => a.toLowerCase() as Address;
const fmtEth = (wei: bigint, dec = 18) => Number(formatUnits(wei, dec)).toFixed(6);

/* ---------- network guard (auto-switch to Base) ---------- */
function useNetworkGuard() {
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const isOnBase = chainId === base.id;
  const ensureBase = useCallback(async () => {
    if (!isOnBase && !isPending) {
      try { await switchChainAsync({ chainId: base.id }); } catch {}
    }
  }, [isOnBase, isPending, switchChainAsync]);
  return { isOnBase, ensureBase };
}

function useSafePublicClient() {
  const wagmiClient = usePublicClient();
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_BASE ||
    (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : "https://mainnet.base.org");
  return wagmiClient ?? createPublicClient({ chain: base, transport: http(rpcUrl) });
}

/* ---------- v3 path helpers ---------- */
function encodeV3Path(tokens: Address[], fees: number[]): `0x${string}` {
  if (fees.length !== tokens.length - 1) throw new Error("fees length must be tokens.length - 1");
  let packed = encodePacked(["address"], [tokens[0]]);
  for (let i = 0; i < fees.length; i++) {
    // uint24 expects a number, not bigint
    packed = encodePacked(["bytes", "uint24", "address"], [packed, fees[i], tokens[i + 1]]) as `0x${string}`;
  }
  return packed;
}
function buildV3Candidates(tokenIn: Address | "ETH", tokenOut: Address) {
  const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
  const outAddr = tokenOut as Address;
  const basePaths: Address[][] = [
    [inAddr, outAddr],
    [inAddr, WETH as Address, outAddr],
    [inAddr, USDC as Address, outAddr],
    [inAddr, WETH as Address, USDC as Address, outAddr],
    [inAddr, USDC as Address, WETH as Address, outAddr],
  ];
  const FEES = [500, 3000, 10000];
  const out: { tokens: Address[]; fees: number[] }[] = [];
  for (const tokens of basePaths) {
    const hops = tokens.length - 1;
    if (hops < 1) continue;
    const backtrack = (i: number, cur: number[]) => {
      if (i === hops) { out.push({ tokens, fees: cur }); return; }
      for (const f of FEES) backtrack(i + 1, [...cur, f]);
    };
    backtrack(0, []);
  }
  const seen = new Set<string>();
  return out.filter(c => { const k = `${c.tokens.join("->")}__${c.fees.join(",")}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/* ---------- fee path (V2-style) ---------- */
function buildFeePathV2Like(inA: Address): Address[] {
  const inL = lc(inA);
  if (eq(inL, TOBY)) return [inL as Address, TOBY as Address];
  if (eq(inL, WETH)) return [WETH as Address, TOBY as Address];
  return [inL as Address, WETH as Address, TOBY as Address];
}

export default function SwapForm() {
  const { address, chainId, isConnected } = useAccount();
  const { isOnBase, ensureBase } = useNetworkGuard();
  const client = useSafePublicClient();
  const { writeContractAsync } = useWriteContract();

  // UI state
  const [tokenIn, setTokenIn] = useState<Address | "ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<Address>(TOBY as Address);
  const [amt, setAmt] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(0.5);
  const [slippageOpen, setSlippageOpen] = useState(false);

  // Reset ETH->TOBY on account/chain change
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
  useEffect(() => { const id = setTimeout(() => setDebouncedAmt(amt.trim()), 280); return () => clearTimeout(id); }, [amt]);

  const amountInBig = useMemo(() => { try { return parseUnits(debouncedAmt || "0", inMeta.decimals); } catch { return 0n; }}, [debouncedAmt, inMeta.decimals]);
  const amtNum = Number(debouncedAmt || "0");
  const amtInUsd = Number.isFinite(amtNum) ? amtNum * inUsd : 0;

  /* ---------- feeBps from swapper ---------- */
  const [feeBps, setFeeBps] = useState<bigint>(100n);
  useEffect(() => { (async () => {
    try {
      const bps = (await client.readContract({
        address: lc(SWAPPER as Address),
        abi: [{ type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const,
        functionName: "feeBps",
      })) as bigint;
      if (bps >= 0n && bps <= 500n) setFeeBps(bps);
    } catch {}
  })(); }, [client]);

  /* ---------- v3 quoting (post-fee amount) ---------- */
  const mainAmountIn = useMemo(() => (amountInBig === 0n ? 0n : (amountInBig * (FEE_DENOM - feeBps)) / FEE_DENOM), [amountInBig, feeBps]);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "noroute" | "ok">("idle");
  const [quoteErr, setQuoteErr] = useState<string | undefined>();
  const [quoteOutMain, setQuoteOutMain] = useState<bigint | undefined>();
  const [bestV3, setBestV3] = useState<{ tokens: Address[]; fees: number[] } | undefined>();
  const [debugPath, setDebugPath] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    (async () => {
      setQuoteErr(undefined); setQuoteOutMain(undefined); setBestV3(undefined); setDebugPath(undefined);
      if (!client || !isOnBase || mainAmountIn === 0n || !isAddress(tokenOut)) { setQuoteState("idle"); return; }
      if (!QUOTER_V3) { setQuoteState("noroute"); setQuoteErr("Missing QUOTER_V3"); return; }
      setQuoteState("loading");

      let bestOut: bigint | undefined;
      let best: { tokens: Address[]; fees: number[] } | undefined;
      for (const cand of buildV3Candidates(tokenIn, tokenOut)) {
        try {
          const path = encodeV3Path(cand.tokens, cand.fees);
          const res = (await client.readContract({
            address: QUOTER_V3 as Address,
            abi: QuoterV2Abi as any,
            functionName: "quoteExactInput",
            args: [path, mainAmountIn],
          })) as [bigint];
          const amountOut = res[0];
          if (amountOut > 0n && (!bestOut || amountOut > bestOut)) { bestOut = amountOut; best = cand; }
        } catch (e: any) {
          if (!quoteErr) setQuoteErr(String(e?.shortMessage || e?.message || e));
        }
      }
      if (!alive) return;

      if (bestOut && best) {
        setQuoteOutMain(bestOut);
        setBestV3(best);
        const syms = best.tokens.map((t) => TOKENS.find((x) => eq(x.address, t))?.symbol ?? t.slice(0, 6));
        const parts: string[] = [];
        for (let i = 0; i < best.fees.length; i++) parts.push(`${syms[i]}(${best.fees[i]})→${syms[i+1]}`);
        setDebugPath(parts.join(" → "));
        setQuoteState("ok");
      } else {
        setQuoteState("noroute");
      }
    })();
    return () => { alive = false; };
  }, [client, isOnBase, tokenIn, tokenOut, mainAmountIn]); // eslint-disable-line

  const expectedOutMainHuman = useMemo(() => {
    try { return quoteOutMain ? Number(formatUnits(quoteOutMain, outMeta.decimals)) : undefined; } catch { return undefined; }
  }, [quoteOutMain, outMeta.decimals]);

  const minOutMainHuman = useMemo(() => {
    if (!quoteOutMain || SAFE_MODE_MINOUT_ZERO) return "0";
    const raw = (quoteOutMain * BigInt(Math.round((100 - slippage) * 100))) / 10000n;
    return formatUnits(raw, outMeta.decimals);
  }, [quoteOutMain, slippage, outMeta.decimals]);

  /* ---------- allowance / approval ---------- */
  const tokenInAddr = inMeta.address as Address | undefined;
  const needsApproval = !!tokenInAddr;
  const { value: allowanceValue = 0n, isLoading: isAllowanceLoading, refetch: refetchAllowance } =
    useStickyAllowance(tokenInAddr, address as Address | undefined, SWAPPER as Address);
  const { approveMaxFlow, isPending: isApproving } = useApprove(tokenInAddr, SWAPPER as Address);

  const onApprove = useCallback(async () => {
    if (!needsApproval || !isConnected || !tokenInAddr) return;
    try { await approveMaxFlow(allowanceValue); setTimeout(() => refetchAllowance(), 1000); } catch {}
  }, [needsApproval, isConnected, tokenInAddr, approveMaxFlow, allowanceValue, refetchAllowance]);

  /* ---------- simulate + send ---------- */
  const [preflightMsg, setPreflightMsg] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  async function doSwap() {
    if (!isConnected || !isOnBase) { setPreflightMsg("Connect your wallet on Base to swap."); return; }
    if (amountInBig === 0n) return;

    setPreflightMsg(undefined);
    setSending(true);

    const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
    const decIn = inMeta.decimals;
    const decOut = outMeta.decimals;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);
    const feePath = buildFeePathV2Like(inAddr);

    try {
      if (tokenIn === "ETH") {
        // ETH -> token: still uses V2 path (contract’s v3 method is ERC20->ERC20)
        const sim = await client.simulateContract({
          address: lc(SWAPPER as Address),
          abi: TobySwapperAbi as any,
          functionName: "swapETHForTokensSupportingFeeOnTransferTokens",
          args: [
            lc(tokenOut),
            parseUnits(minOutMainHuman, decOut),
            [WETH as Address, tokenOut],
            feePath,
            0n,
            deadline,
          ],
          value: parseUnits(amt || "0", 18),
          account: address as Address,
          chain: base,
        });
        const gas = sim.request.gas ?? 0n;
        const feePerGas = (sim.request as any).maxFeePerGas ?? (await client.getGasPrice());
        const totalNeeded = (sim.request.value ?? 0n) + gas * feePerGas;
        const bal = await client.getBalance({ address: address as Address });
        if (bal < totalNeeded) { setPreflightMsg(`Not enough ETH. You have ${fmtEth(bal)}; need ~${fmtEth(totalNeeded)} incl. gas.`); setSending(false); return; }
        await writeContractAsync(sim.request);
        setSending(false);
        return;
      }

      // ERC20 -> token: prefer v3 execution if we found a v3 quote
      if (bestV3) {
        if (allowanceValue < amountInBig) { setPreflightMsg(`Approve ${inMeta.symbol} first.`); setSending(false); return; }

        // v3 ExactInput params (bytes-encoded struct)
        const v3Path = encodeV3Path(bestV3.tokens, bestV3.fees);
        const paramsBytes = encodeAbiParameters(
          [
            {
              type: "tuple",
              components: [
                { name: "path", type: "bytes" },
                { name: "recipient", type: "address" },
                { name: "deadline", type: "uint256" },
                { name: "amountIn", type: "uint256" },
                { name: "amountOutMinimum", type: "uint256" },
              ],
            },
          ],
          [
            {
              path: v3Path,
              recipient: address as Address,
              deadline,
              amountIn: parseUnits(amt || "0", decIn),
              amountOutMinimum: parseUnits(minOutMainHuman, decOut),
            },
          ]
        );

        const sim = await client.simulateContract({
          address: lc(SWAPPER as Address),
          abi: TobySwapperAbi as any,
          functionName: "swapTokensForTokensV3ExactInput",
          args: [
            lc(inAddr),
            lc(tokenOut),
            address as Address,
            parseUnits(amt || "0", decIn),
            paramsBytes,
            feePath,
            0n,
          ],
          account: address as Address,
          chain: base,
        });

        const gas = sim.request.gas ?? 0n;
        const feePerGas = (sim.request as any).maxFeePerGas ?? (await client.getGasPrice());
        const totalNeeded = gas * feePerGas;
        const bal = await client.getBalance({ address: address as Address });
        if (bal < totalNeeded) { setPreflightMsg(`You need ~${fmtEth(totalNeeded)} ETH for gas, but only have ${fmtEth(bal)}.`); setSending(false); return; }
        await writeContractAsync(sim.request);
        setSending(false);
        return;
      }

      // Fallback: no v3 path found -> V2
      const sim = await client.simulateContract({
        address: lc(SWAPPER as Address),
        abi: TobySwapperAbi as any,
        functionName: "swapTokensForTokensSupportingFeeOnTransferTokens",
        args: [
          lc(inAddr),
          lc(tokenOut),
          parseUnits(amt || "0", decIn),
          parseUnits(minOutMainHuman, decOut),
          [inAddr, tokenOut],
          feePath,
          0n,
          deadline,
        ],
        account: address as Address,
        chain: base,
      });
      const gas = sim.request.gas ?? 0n;
      const feePerGas = (sim.request as any).maxFeePerGas ?? (await client.getGasPrice());
      const totalNeeded = gas * feePerGas;
      const bal = await client.getBalance({ address: address as Address });
      if (bal < totalNeeded) { setPreflightMsg(`You need ~${fmtEth(totalNeeded)} ETH for gas, but only have ${fmtEth(bal)}.`); setSending(false); return; }
      await writeContractAsync(sim.request);
    } catch (e: any) {
      setPreflightMsg(e?.shortMessage || e?.message || String(e));
    } finally {
      setSending(false);
    }
  }

  /* ---------- UI ---------- */
  const approveText = needsApproval
    ? isAllowanceLoading ? "Checking allowance…" : allowanceValue > 0n ? `Re-approve ${inMeta.symbol}` : `Approve ${inMeta.symbol}`
    : `No approval needed`;

  const disableSwap =
    !isConnected ||
    !isOnBase ||
    amountInBig === 0n ||
    (balInRaw.value ?? 0n) < amountInBig ||
    (needsApproval && allowanceValue < amountInBig) ||
    sending;

  return (
    <div className="glass rounded-3xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>

        {/* Network badge */}
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
          onChange={(a) => { setTokenIn(a); setAmt(""); }}
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
            setTokenOut(prevIn === "ETH" ? (USDC as Address) : (prevIn as Address));
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
          autoCorrect="off"
          spellCheck={false}
          name="swap-amount"
        />

        <div className="mt-2 text-xs text-inkSub">≈ ${amtInUsd ? amtInUsd.toFixed(2) : "0.00"} USD</div>

        {isConnected && balInRaw.value !== undefined && balInRaw.value < amountInBig && (
          <div className="mt-1 text-xs text-warn">Insufficient {inMeta.symbol === "ETH" ? "ETH (Base)" : inMeta.symbol} balance.</div>
        )}

        {/* Approve (only for ERC-20 inputs) */}
        {needsApproval && (
          <div className="mt-3">
            <button
              onClick={onApprove}
              className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
              disabled={isApproving || !isConnected || !isOnBase}
              title={`Approve ${inMeta.symbol} for ${SWAPPER}`}
            >
              {isApproving ? "Approving…" : approveText}
            </button>
            <div className="mt-1 text-[11px] text-inkSub">
              Spender: <code className="break-all">{SWAPPER as Address}</code>
              {allowanceValue !== undefined && <> · Allowance: <span className="font-mono">{allowanceValue.toString()}</span></>}
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
          exclude={tokenIn as Address}
          balance={balOutRaw.value !== undefined ? Number(formatUnits(balOutRaw.value, outMeta.decimals)).toFixed(6) : undefined}
        />
        <div className="text-xs text-inkSub">
          {quoteState === "loading" && <>Querying Uniswap v3 for routes…</>}
          {quoteState === "noroute" && <>No v3 route found for this pair/size.{quoteErr && <> <span className="text-warn">({quoteErr})</span></>}</>}
          {quoteState === "ok" && expectedOutMainHuman !== undefined && (
            <>Est (after fee): <span className="font-mono">{expectedOutMainHuman.toFixed(6)}</span> {outMeta.symbol} · 1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}</>
          )}
          {quoteState === "idle" && <>Enter an amount to get an estimate.</>}
        </div>
        {debugPath && <div className="text-[11px] text-inkSub">v3 path: <code className="break-all">{debugPath}</code></div>}
      </div>

      {/* Swap */}
      <button
        onClick={doSwap}
        className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60 mt-4"
        disabled={disableSwap}
        title="Swap"
      >
        {sending ? "Submitting…" : `Swap & Burn ${Number(feeBps) / 100}% 🔥`}
      </button>

      {preflightMsg && <div className="text-[11px] text-warn mt-2">{preflightMsg}</div>}

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
