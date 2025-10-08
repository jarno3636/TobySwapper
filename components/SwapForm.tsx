// components/SwapForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Address,
  formatUnits,
  parseUnits,
  isAddress,
  maxUint256,
  createPublicClient,
  http,
} from "viem";
import { base } from "viem/chains";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import TokenSelect from "./TokenSelect";
import {
  TOKENS,
  USDC,
  QUOTE_ROUTER_V2,
  WETH,
  SWAPPER,
  TOBY,
} from "@/lib/addresses";
import { useUsdPriceSingle } from "@/lib/prices";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import TobySwapperAbi from "@/abi/TobySwapper.json";

/* ---------- Config ---------- */
const SAFE_MODE_MINOUT_ZERO = false;
const FEE_DENOM = 10_000n;

/* ---------- Minimal ABIs ---------- */
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

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const SWAPPER_VIEW_ABI = [
  { type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

/* ---------- helpers ---------- */
function byAddress(addr?: Address | "ETH") {
  if (!addr || addr === "ETH")
    return { symbol: "ETH", decimals: 18 as const, address: undefined };
  const t = TOKENS.find((t) => t.address.toLowerCase() === addr.toLowerCase());
  return t
    ? { symbol: t.symbol, decimals: (t.decimals ?? 18) as 18 | 6, address: t.address as Address }
    : { symbol: "TOKEN", decimals: 18 as const, address: addr as Address };
}
const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const lc = (a: Address) => a.toLowerCase() as Address;
const lcPath = (p: Address[]) => p.map((x) => x.toLowerCase() as Address);
const fmtEth = (wei: bigint) => Number(formatUnits(wei, 18)).toFixed(6);

function useSafePublicClient() {
  const wagmiClient = usePublicClient();
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_BASE ||
    (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : "https://mainnet.base.org");
  return wagmiClient ?? createPublicClient({ chain: base, transport: http(rpcUrl) });
}

export default function SwapForm() {
  const { address, chain, isConnected } = useAccount();
  const client = useSafePublicClient();
  const { writeContractAsync } = useWriteContract();

  // UI state (start fresh — no sticky values)
  const [tokenIn, setTokenIn]   = useState<Address | "ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<Address>(TOBY as Address); // default to TOBY
  const [amt, setAmt]           = useState<string>(""); // empty by default
  const [slippage, setSlippage] = useState<number>(0.5);
  const [slippageOpen, setSlippageOpen] = useState(false);

  // Force ETH -> TOBY once on mount; clear amount
  useEffect(() => {
    setTokenIn("ETH");
    setTokenOut(TOBY as Address);
    setAmt("");
  }, []);

  // Clear amount on wallet/chain change
  useEffect(() => { setAmt(""); }, [address, chain?.id]);

  // balances & price
  const inMeta  = byAddress(tokenIn);
  const outMeta = byAddress(tokenOut);
  const balInRaw  = useTokenBalance(address, inMeta.address);
  const balOutRaw = useTokenBalance(address, outMeta.address);
  const inUsd  = useUsdPriceSingle(inMeta.symbol === "ETH" ? "ETH" : (inMeta.address as Address));
  const outUsd = useUsdPriceSingle(outMeta.symbol === "ETH" ? "ETH" : (outMeta.address as Address));

  // debounced amount
  const [debouncedAmt, setDebouncedAmt] = useState(amt);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedAmt(amt.trim()), 250);
    return () => clearTimeout(id);
  }, [amt]);

  const amountInBig = useMemo(() => {
    try { return parseUnits(debouncedAmt || "0", inMeta.decimals); } catch { return 0n; }
  }, [debouncedAmt, inMeta.decimals]);

  const amtNum   = Number(debouncedAmt || "0");
  const amtInUsd = Number.isFinite(amtNum) ? amtNum * inUsd : 0;

  /* ---------- feeBps ---------- */
  const [feeBps, setFeeBps] = useState<bigint>(100n); // default 1%
  useEffect(() => {
    (async () => {
      try {
        const bps = (await client.readContract({
          address: lc(SWAPPER as Address),
          abi: SWAPPER_VIEW_ABI,
          functionName: "feeBps",
        })) as bigint;
        if (bps >= 0n && bps <= 500n) setFeeBps(bps);
      } catch {/* keep default */}
    })();
  }, [client]);

  /* ---------- quote (use POST-FEE amount) ---------- */
  const mainAmountIn = useMemo(
    () => amountInBig === 0n ? 0n : (amountInBig * (FEE_DENOM - feeBps)) / FEE_DENOM,
    [amountInBig, feeBps]
  );
  const [quotePath, setQuotePath] = useState<Address[] | undefined>();
  const [quoteOutMain, setQuoteOutMain] = useState<bigint | undefined>();
  const [quoteErr, setQuoteErr] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    (async () => {
      setQuoteOutMain(undefined); setQuotePath(undefined); setQuoteErr(undefined);
      const inAddr = tokenIn === "ETH" ? WETH : (tokenIn as Address);
      if (!client || mainAmountIn === 0n || !isAddress(tokenOut)) return;

      const candidates: Address[][] = [
        [inAddr as Address, tokenOut as Address],
        [inAddr as Address, WETH as Address, tokenOut as Address],
        [inAddr as Address, tokenOut as Address, WETH as Address],
      ].map(lcPath).filter((p, i, arr) => arr.findIndex((q) => q.join() === p.join()) === i);

      for (const p of candidates) {
        try {
          const amounts = (await client.readContract({
            address: lc(QUOTE_ROUTER_V2 as Address),
            abi: UniV2RouterAbi as any,
            functionName: "getAmountsOut",
            args: [mainAmountIn, p],
          })) as bigint[];
          const out = amounts.at(-1);
          if (out && out > 0n) { if (!alive) return; setQuotePath(p); setQuoteOutMain(out); return; }
        } catch (e: any) { if (!alive) return; setQuoteErr(String(e?.shortMessage || e?.message || e)); }
      }
    })();
    return () => { alive = false; };
  }, [client, tokenIn, tokenOut, mainAmountIn]);

  const expectedOutMainHuman = useMemo(() => {
    try { return quoteOutMain ? Number(formatUnits(quoteOutMain, outMeta.decimals)) : undefined; }
    catch { return undefined; }
  }, [quoteOutMain, outMeta.decimals]);

  const minOutMainHuman = useMemo(() => {
    if (!quoteOutMain || SAFE_MODE_MINOUT_ZERO) return "0";
    const bps = Math.round((100 - slippage) * 100);
    const raw = (quoteOutMain * BigInt(bps)) / 10000n;
    return formatUnits(raw, outMeta.decimals);
  }, [quoteOutMain, slippage, outMeta.decimals]);

  /* ---------- allowance / approval to SWAPPER ---------- */
  const needsApproval = !!inMeta.address && isAddress(inMeta.address);
  const tokenInAddr   = inMeta.address as Address | undefined;
  const [allowance, setAllowance] = useState<bigint | undefined>();
  const allowanceValue = allowance ?? 0n;

  const readAllowance = async () => {
    if (!client || !needsApproval || !address || !tokenInAddr) { setAllowance(undefined); return; }
    try {
      const a = (await client.readContract({
        address: tokenInAddr, abi: ERC20_ABI, functionName: "allowance",
        args: [address as Address, SWAPPER as Address],
      })) as bigint;
      setAllowance(a);
    } catch { setAllowance(undefined); }
  };
  useEffect(() => { setAllowance(undefined); if (needsApproval && address) readAllowance(); }, [client, address, tokenInAddr, needsApproval, chain?.id]);

  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | undefined>();
  async function doApprove() {
    if (!needsApproval || !isConnected || !tokenInAddr) return;
    try {
      setApproveError(undefined); setIsApproving(true);
      if (allowanceValue > 0n) {
        const tx0 = await writeContractAsync({ address: tokenInAddr, abi: ERC20_ABI, functionName: "approve", args: [SWAPPER as Address, 0n] });
        await client.waitForTransactionReceipt({ hash: tx0 });
      }
      const tx1 = await writeContractAsync({ address: tokenInAddr, abi: ERC20_ABI, functionName: "approve", args: [SWAPPER as Address, maxUint256] });
      await client.waitForTransactionReceipt({ hash: tx1 });
      await readAllowance();
    } catch (e: any) { setApproveError(e?.shortMessage || e?.message || String(e)); }
    finally { setIsApproving(false); }
  }

  /* ---------- fee path ---------- */
  const buildFeePath = (inA: Address): Address[] => {
    const inL = lc(inA);
    if (eq(inL, TOBY)) return lcPath([inL as Address, TOBY as Address]);
    if (eq(inL, WETH)) return lcPath([WETH as Address, TOBY as Address]);
    return lcPath([inL as Address, WETH as Address, TOBY as Address]);
  };

  /* ---------- simulate then send (with ETH-balance check) ---------- */
  const [preflightError, setPreflightError] = useState<string | undefined>();
  async function doSwap() {
    setPreflightError(undefined);
    if (!isConnected || !quotePath || amountInBig === 0n) return;

    if (needsApproval && tokenInAddr) {
      const fresh = (await client.readContract({
        address: tokenInAddr, abi: ERC20_ABI, functionName: "allowance",
        args: [address as Address, SWAPPER as Address],
      })) as bigint;
      if (fresh < amountInBig) { setPreflightError(`Approve ${inMeta.symbol} for ${SWAPPER} first.`); return; }
    }

    const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
    const decIn  = inMeta.decimals;
    const decOut = outMeta.decimals;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

    const mainPath = lcPath(quotePath);
    const feePath  = buildFeePath(inAddr);

    try {
      if (!needsApproval) {
        const sim = await client.simulateContract({
          address: lc(SWAPPER as Address),
          abi: TobySwapperAbi as any,
          functionName: "swapETHForTokensSupportingFeeOnTransferTokens",
          args: [
            lc(tokenOut),
            parseUnits(minOutMainHuman, decOut),
            mainPath,
            feePath,
            parseUnits("0", 18),
            deadline,
          ],
          value: parseUnits(amt || "0", 18),
          account: address as Address,
          chain: base,
        });

        // Preflight ETH balance check (value + gas)
        const gas = sim.request.gas ?? 0n;
        const feePerGas = (sim.request as any).maxFeePerGas ?? (await client.getGasPrice());
        const totalNeeded = (sim.request.value ?? 0n) + gas * feePerGas;
        const bal = await client.getBalance({ address: address as Address });
        if (bal < totalNeeded) {
          setPreflightError(
            `You have ${fmtEth(bal)} ETH, but need ~${fmtEth(totalNeeded)} ETH (value + gas).`
          );
          return;
        }

        await writeContractAsync(sim.request);
      } else {
        const sim = await client.simulateContract({
          address: lc(SWAPPER as Address),
          abi: TobySwapperAbi as any,
          functionName: "swapTokensForTokensSupportingFeeOnTransferTokens",
          args: [
            lc(tokenIn as Address),
            lc(tokenOut),
            parseUnits(amt || "0", decIn),
            parseUnits(minOutMainHuman, decOut),
            mainPath,
            feePath,
            parseUnits("0", 18),
            deadline,
          ],
          account: address as Address,
          chain: base,
        });

        // Preflight ETH balance check (gas only)
        const gas = sim.request.gas ?? 0n;
        const feePerGas = (sim.request as any).maxFeePerGas ?? (await client.getGasPrice());
        const totalNeeded = gas * feePerGas;
        const bal = await client.getBalance({ address: address as Address });
        if (bal < totalNeeded) {
          setPreflightError(
            `You have ${fmtEth(bal)} ETH for gas, but need ~${fmtEth(totalNeeded)} ETH for gas.`
          );
          return;
        }

        await writeContractAsync(sim.request);
      }
    } catch (e: any) {
      setPreflightError(e?.shortMessage || e?.message || String(e));
    }
  }

  /* ---------- UI ---------- */
  const hasEnoughBalance = (balInRaw.value ?? 0n) >= amountInBig;
  const approveText = needsApproval
    ? allowanceValue > 0n ? `Re-approve ${inMeta.symbol}` : `Approve ${inMeta.symbol}`
    : `No approval needed`;

  return (
    <div className="glass rounded-3xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <button
          className="pill pill-opaque px-3 py-1 text-xs"
          onClick={() => setSlippageOpen(true)}
        >
          Slippage: {slippage}%
        </button>
      </div>

      {/* Token In */}
      <div className="space-y-2">
        <label className="text-sm text-inkSub">Token In</label>
        <TokenSelect
          value={tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address)}
          onChange={(a) => { setTokenIn(a); setAmt(""); }} // clear on token change
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
            setAmt(""); // clear on side switch
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
            Amount {inMeta.symbol === "ETH" ? "(ETH)" : `(${inMeta.symbol})`}
          </label>
          <div className="text-xs text-inkSub">
            Bal: <span className="font-mono">
              {balInRaw.value !== undefined
                ? Number(formatUnits(balInRaw.value, inMeta.decimals)).toFixed(6)
                : "—"}
            </span>
            <button
              className="ml-2 underline"
              onClick={() => {
                if (!balInRaw.value) return;
                const raw = Number(formatUnits(balInRaw.value, inMeta.decimals));
                const safe = inMeta.address ? raw : Math.max(0, raw - 0.0005);
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

        <div className="mt-2 text-xs text-inkSub">
          ≈ ${amtInUsd ? amtInUsd.toFixed(2) : "0.00"} USD
        </div>

        {isConnected && balInRaw.value !== undefined && balInRaw.value < amountInBig && (
          <div className="mt-1 text-xs text-warn">
            Insufficient {inMeta.symbol} balance.
          </div>
        )}

        {/* Approve (only for ERC-20 inputs) */}
        {needsApproval && (
          <div className="mt-3">
            <button
              onClick={doApprove}
              className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
              disabled={isApproving || !isConnected}
              title={`Approve ${inMeta.symbol} for ${SWAPPER}`}
            >
              {isApproving ? "Approving…" : approveText}
            </button>
            <div className="mt-1 text-[11px] text-inkSub">
              Spender: <code className="break-all">{SWAPPER as Address}</code>
              {allowance !== undefined && <> · Allowance: <span className="font-mono">{allowanceValue.toString()}</span></>}
            </div>
            {approveError && <div className="text-[11px] text-warn mt-1">Approve error: {approveError}</div>}
          </div>
        )}
      </div>

      {/* Token Out & estimate */}
      <div className="space-y-2 mt-4">
        <label className="text-sm text-inkSub">Token Out</label>
        <TokenSelect
          value={tokenOut}
          onChange={(v) => { setTokenOut(v); setAmt(""); }} // clear on token change
          exclude={tokenIn as Address}
          balance={balOutRaw.value !== undefined ? Number(formatUnits(balOutRaw.value, outMeta.decimals)).toFixed(6) : undefined}
        />
        <div className="text-xs text-inkSub">
          {expectedOutMainHuman !== undefined
            ? <>Est (after fee): <span className="font-mono">{expectedOutMainHuman.toFixed(6)}</span> {outMeta.symbol} · 1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}</>
            : quoteErr
            ? <>No route found on router.</>
            : <>1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}</>}
        </div>
      </div>

      {/* Swap */}
      <button
        onClick={doSwap}
        className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60 mt-4"
        disabled={
          !isConnected ||
          amountInBig === 0n ||
          !quotePath ||
          (balInRaw.value ?? 0n) < amountInBig ||
          (needsApproval && allowanceValue < amountInBig)
        }
        title="Swap"
      >
        Swap &amp; Burn {Number(feeBps) / 100}% 🔥
      </button>

      {preflightError && <div className="text-[11px] text-warn mt-2">{preflightError}</div>}

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
      )}
    </div>
  );
}
