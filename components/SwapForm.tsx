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
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { base } from "viem/chains";
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
  { type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
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

/** Public client with fallback so reads never stall */
function useSafePublicClient() {
  const wagmiClient = usePublicClient();
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_BASE ||
    (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : "https://mainnet.base.org");

  return (
    wagmiClient ??
    createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    })
  );
}

/** Spender MUST be the TobySwapper contract (your contract pulls with transferFrom). */
const APPROVAL_SPENDER: Address = SWAPPER as Address;

export default function SwapForm() {
  const { address, chain, isConnected } = useAccount();
  const chainId = chain?.id ?? base.id;
  const client = useSafePublicClient();
  const { writeContractAsync } = useWriteContract();

  // UI state
  const [tokenIn, setTokenIn] = useState<Address | "ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<Address>(
    TOKENS.find((t) => t.address !== USDC)!.address
  );
  const [amt, setAmt] = useState("5");
  const [slippageOpen, setSlippageOpen] = useState(false);
  const [slippage, setSlippage] = useState<number>(0.5);

  // balances
  const inMeta = byAddress(tokenIn);
  const outMeta = byAddress(tokenOut);
  const balInRaw = useTokenBalance(address, inMeta.address);
  const balOutRaw = useTokenBalance(address, outMeta.address);

  // prices
  const inUsd  = useUsdPriceSingle(inMeta.symbol === "ETH" ? "ETH" : (inMeta.address as Address));
  const outUsd = useUsdPriceSingle(outMeta.symbol === "ETH" ? "ETH" : (outMeta.address as Address));

  // amount (debounced)
  const [debouncedAmt, setDebouncedAmt] = useState(amt);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedAmt(amt), 250);
    return () => clearTimeout(id);
  }, [amt]);

  const amtNum = Number(debouncedAmt || "0");
  const amtInUsd = useMemo(() => (Number.isFinite(amtNum) ? amtNum * inUsd : 0), [amtNum, inUsd]);

  const amountInBig = useMemo(() => {
    try { return parseUnits(debouncedAmt || "0", inMeta.decimals); } catch { return 0n; }
  }, [debouncedAmt, inMeta.decimals]);

  /* ---------- Quote (V2) ---------- */
  const [quotePath, setQuotePath] = useState<Address[] | undefined>(undefined);
  const [quoteOut, setQuoteOut] = useState<bigint | undefined>(undefined);
  const [quoteErr, setQuoteErr] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      setQuoteOut(undefined);
      setQuotePath(undefined);
      setQuoteErr(undefined);

      const inAddr = tokenIn === "ETH" ? WETH : (tokenIn as Address);

      if (eq(inAddr, tokenOut) && amountInBig > 0n) {
        if (!alive) return;
        const idPath = lcPath([inAddr as Address, tokenOut as Address]);
        setQuotePath(idPath);
        setQuoteOut(amountInBig);
        return;
      }

      if (!client || amountInBig === 0n || !isAddress(tokenOut)) return;

      const candidates: Address[][] = [
        [inAddr as Address, tokenOut as Address],
        [inAddr as Address, WETH as Address, tokenOut as Address],
        [inAddr as Address, tokenOut as Address, WETH as Address],
      ]
        .map(lcPath)
        .filter((p, i, arr) => arr.findIndex((q) => q.join() === p.join()) === i);

      for (const p of candidates) {
        try {
          const amounts = (await client.readContract({
            address: lc(QUOTE_ROUTER_V2 as Address),
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

  // expected & minOut
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

  /* ---------- Allowance (approve SWAPPER) ---------- */
  const isEthIn = tokenIn === "ETH";
  const needAllowance = !isEthIn && isAddress(tokenIn as string);

  const [allowance, setAllowance] = useState<bigint | undefined>(undefined);
  const [isReadingAllowance, setIsReadingAllowance] = useState(false);
  const [approveError, setApproveError] = useState<string | undefined>(undefined);
  const [preflightError, setPreflightError] = useState<string | undefined>(undefined);
  const allowanceValue = allowance ?? 0n;

  const readAllowance = async () => {
    if (!client || !needAllowance || !address) {
      setAllowance(undefined);
      return;
    }
    try {
      setIsReadingAllowance(true);
      const a = (await client.readContract({
        address: tokenIn as Address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address as Address, APPROVAL_SPENDER],
      })) as bigint;
      setAllowance(a);
    } catch {
      setAllowance(undefined);
    } finally {
      setIsReadingAllowance(false);
    }
  };

  useEffect(() => {
    setAllowance(undefined);
    setPreflightError(undefined);
    if (needAllowance && address) readAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, address, tokenIn, needAllowance, chainId]);

  useEffect(() => {
    if (!needAllowance || !address) return;
    const t = setTimeout(() => readAllowance(), 600); // small retry after mount
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, address, tokenIn, needAllowance]);

  const hasEnoughAllowance = !needAllowance || allowanceValue >= amountInBig;

  /* ---------- Balance & CTA readiness ---------- */
  const hasEnoughBalance = (balInRaw.value ?? 0n) >= amountInBig;

  const canSwap =
    isConnected &&
    amountInBig > 0n &&
    !!quotePath &&
    hasEnoughBalance &&
    hasEnoughAllowance;

  const setMax = () => {
    if (!balInRaw.value) return;
    const raw = Number(formatUnits(balInRaw.value, inMeta.decimals));
    const safe = inMeta.address ? raw : Math.max(0, raw - 0.0005); // native dust
    setAmt((safe > 0 ? safe : 0).toString());
  };

  /* ---------- Approve (USDC-safe: zero→max) ---------- */
  const [isApproving, setIsApproving] = useState(false);
  const doApprove = async () => {
    if (!needAllowance || !isConnected || !isAddress(tokenIn as string)) return;
    try {
      setApproveError(undefined);
      setPreflightError(undefined);
      setIsApproving(true);

      // Zero first if there is an existing allowance (USDC/USDT pattern)
      if (allowanceValue > 0n) {
        const tx0 = await writeContractAsync({
          address: tokenIn as Address,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [APPROVAL_SPENDER, 0n],
        });
        await client?.waitForTransactionReceipt({ hash: tx0 });
      }

      const tx1 = await writeContractAsync({
        address: tokenIn as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [APPROVAL_SPENDER, maxUint256],
      });
      await client?.waitForTransactionReceipt({ hash: tx1 });

      await readAllowance();
    } catch (e: any) {
      setApproveError(e?.shortMessage || e?.message || String(e));
    } finally {
      setIsApproving(false);
    }
  };

  /* ---------- Burn fee path ---------- */
  const buildFeePath = (inA: Address): Address[] => {
    const inL = lc(inA);
    if (eq(inL, TOBY)) return lcPath([inL as Address, TOBY as Address]);
    if (eq(inL, WETH)) return lcPath([WETH as Address, TOBY as Address]);
    return lcPath([inL as Address, WETH as Address, TOBY as Address]);
  };

  /* ---------- Swap (preflight allowance check) ---------- */
  const doSwap = async () => {
    setPreflightError(undefined);
    if (!quotePath || amountInBig === 0n) return;

    if (needAllowance) {
      // re-read at the moment of clicking swap to avoid wallet sim error
      const fresh = (await client.readContract({
        address: tokenIn as Address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address as Address, APPROVAL_SPENDER],
      })) as bigint;

      if (fresh < amountInBig) {
        setPreflightError(`Allowance too low for spender ${APPROVAL_SPENDER}. Tap Approve, then try again.`);
        return;
      }
    }

    const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
    const decIn = inMeta.decimals;
    const decOut = outMeta.decimals;
    const now = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

    const mainPath = lcPath(quotePath);
    const feePath = buildFeePath(inAddr);

    if (tokenIn === "ETH") {
      await writeContractAsync({
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
    } else {
      await writeContractAsync({
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
    }
  };

  /* ---------- Labels ---------- */
  const approveCtaText = needAllowance
    ? allowanceValue > 0n
      ? `Re-approve ${byAddress(tokenIn).symbol}`
      : `Approve ${byAddress(tokenIn).symbol}`
    : `No approval needed`;

  const swapDisabled =
    !isConnected ||
    amountInBig === 0n ||
    !quotePath ||
    !hasEnoughBalance ||
    (needAllowance && allowanceValue < amountInBig);

  return (
    <div className="glass rounded-3xl p-6 shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <button
          className="pill pill-opaque px-3 py-1 text-xs"
          onClick={() => setSlippageOpen(true)}
          title="Set slippage"
        >
          Slippage: {slippage}%
        </button>
      </div>

      {chain && chain.id !== base.id && (
        <div className="mb-3 text-xs text-warn">
          Connected to {chain?.name}. Please switch to Base.
        </div>
      )}
      {!isConnected && (
        <div className="mb-3 text-xs text-inkSub">Connect your wallet to load balances.</div>
      )}

      <div className="space-y-4">
        {/* Token In */}
        <div className="space-y-2">
          <label className="text-sm text-inkSub">Token In</label>
          <TokenSelect
            value={tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address)}
            onChange={(a) => setTokenIn(a)}
            exclude={tokenOut}
            balance={
              balInRaw.value !== undefined
                ? Number(formatUnits(balInRaw.value, inMeta.decimals)).toFixed(6)
                : undefined
            }
          />
        </div>

        {/* Switch sides */}
        <div className="flex justify-center">
          <button
            className="pill pill-opaque px-3 py-1 text-sm"
            type="button"
            onClick={() => {
              const prevIn = tokenIn;
              const prevOut = tokenOut;
              setTokenIn(prevOut as Address);
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

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-inkSub">
              Amount {tokenIn === "ETH" ? "(ETH)" : `(${inMeta.symbol})`}
            </label>
            <div className="text-xs text-inkSub">
              Bal:{" "}
              <span className="font-mono">
                {balInRaw.value !== undefined
                  ? Number(formatUnits(balInRaw.value, inMeta.decimals)).toFixed(6)
                  : isConnected
                  ? "—"
                  : "Connect wallet"}
              </span>
              <button className="ml-2 underline opacity-90 hover:opacity-100" onClick={setMax}>
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
          />
          <div className="mt-2 text-xs text-inkSub">≈ ${amtInUsd ? amtInUsd.toFixed(2) : "0.00"} USD</div>
          {isConnected && balInRaw.value !== undefined && balInRaw.value < amountInBig && (
            <div className="mt-1 text-xs text-warn">Insufficient {inMeta.symbol} balance.</div>
          )}

          {/* APPROVE lives here and is ALWAYS visible when ERC-20 is input */}
          {!isEthIn && (
            <div className="mt-3">
              <button
                onClick={doApprove}
                className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
                disabled={isApproving || !isConnected}
                title={`Approve ${byAddress(tokenIn).symbol} for ${APPROVAL_SPENDER}`}
              >
                {isApproving ? "Approving…" : approveCtaText}
              </button>
              <div className="mt-1 text-[11px] text-inkSub">
                Spender: <code className="break-all">{APPROVAL_SPENDER}</code>
                {isReadingAllowance
                  ? " · checking allowance…"
                  : allowance !== undefined
                  ? <> · Allowance: <span className="font-mono">{allowanceValue.toString()}</span></>
                  : null}
              </div>
              {approveError && <div className="text-[11px] text-warn mt-1">Approve error: {approveError}</div>}
            </div>
          )}
        </div>

        {/* Token Out */}
        <div className="space-y-2">
          <label className="text-sm text-inkSub">Token Out</label>
          <TokenSelect
            value={tokenOut}
            onChange={setTokenOut}
            exclude={tokenIn as Address}
            balance={
              balOutRaw.value !== undefined
                ? Number(formatUnits(balOutRaw.value, outMeta.decimals)).toFixed(6)
                : undefined
            }
          />
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

        {/* Swap */}
        <button
          onClick={doSwap}
          className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
          disabled={swapDisabled}
          title={!isConnected ? "Connect wallet" : undefined}
        >
          Swap &amp; Burn 1% 🔥
        </button>

        {preflightError && <div className="text-[11px] text-warn">{preflightError}</div>}
      </div>

      {/* Slippage modal (simple) */}
      {slippageOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSlippageOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-strong rounded-2xl p-5 w-[90%] max-w-sm border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Slippage</h4>
              <button className="pill pill-opaque px-3 py-1 text-xs" onClick={() => setSlippageOpen(false)}>
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
      )}
    </div>
  );
}
