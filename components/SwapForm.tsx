//// components/SwapForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Address,
  formatUnits,
  parseUnits,
  isAddress,
  createPublicClient,
  http,
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
  QUOTE_ROUTER_V2,
  WETH,
  SWAPPER,
  TOBY,
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

/* ---------- helpers ---------- */
function byAddress(addr?: Address | "ETH") {
  if (!addr || addr === "ETH")
    return { symbol: "ETH", decimals: 18 as const, address: undefined };
  const t = TOKENS.find((t) => t.address.toLowerCase() === String(addr).toLowerCase());
  return t
    ? { symbol: t.symbol, decimals: (t.decimals ?? 18) as 18 | 6, address: t.address as Address }
    : { symbol: "TOKEN", decimals: 18 as const, address: addr as Address };
}
const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const lc = (a: Address) => a.toLowerCase() as Address;
const lcPath = (p: Address[]) => p.map((x) => x.toLowerCase() as Address);
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

  return { isOnBase, ensureBase, isPendingSwitch: isPending };
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

/* ---------- path building (broadened with USDC) ---------- */
function buildCandidatePaths(
  tokenIn: Address | "ETH",
  tokenOut: Address
): Address[][] {
  const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
  const outAddr = tokenOut as Address;

  const mids: Address[] = [
    WETH as Address,
    USDC as Address,
    // We can include TOBY as a mid for some pairs
    TOBY as Address,
  ].map(lc);

  const baseSet: Address[][] = [
    [inAddr, outAddr],                  // direct
    [inAddr, WETH as Address, outAddr], // via WETH
    [inAddr, USDC as Address, outAddr], // via USDC
  ];

  // 2-hop chains in both orders: WETH->USDC and USDC->WETH (helps many edge pairs)
  baseSet.push([inAddr, WETH as Address, USDC as Address, outAddr]);
  baseSet.push([inAddr, USDC as Address, WETH as Address, outAddr]);

  // Avoid silly routes like repeating same addr adjacently; lower-case & unique
  const uniq = new Set<string>();
  const cleaned = baseSet
    .map(lcPath)
    .filter((p) => {
      // filter duplicates
      const key = p.join();
      if (uniq.has(key)) return false;
      uniq.add(key);
      // filter adjacent duplicates
      for (let i = 1; i < p.length; i++) if (p[i] === p[i - 1]) return false;
      // sanity: start != end or length>1
      return p.length >= 2;
    });

  return cleaned as Address[][];
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

  // Reset to ETH->TOBY on account/chain change
  useEffect(() => {
    setTokenIn("ETH");
    setTokenOut(TOBY as Address);
    setAmt("");
  }, [address, chainId]);

  // Ensure Base when connected
  useEffect(() => {
    if (isConnected) void ensureBase();
  }, [isConnected, ensureBase]);

  // balances & price
  const inMeta = byAddress(tokenIn);
  const outMeta = byAddress(tokenOut);
  const balInRaw = useTokenBalance(address, inMeta.address);
  const balOutRaw = useTokenBalance(address, outMeta.address);
  const inUsd = useUsdPriceSingle(inMeta.symbol === "ETH" ? "ETH" : (inMeta.address as Address));
  const outUsd = useUsdPriceSingle(outMeta.symbol === "ETH" ? "ETH" : (outMeta.address as Address));

  // debounced amount
  const [debouncedAmt, setDebouncedAmt] = useState(amt);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedAmt(amt.trim()), 280);
    return () => clearTimeout(id);
  }, [amt]);

  const amountInBig = useMemo(() => {
    try { return parseUnits(debouncedAmt || "0", inMeta.decimals); } catch { return 0n; }
  }, [debouncedAmt, inMeta.decimals]);

  const amtNum = Number(debouncedAmt || "0");
  const amtInUsd = Number.isFinite(amtNum) ? amtNum * inUsd : 0;

  /* ---------- feeBps ---------- */
  const [feeBps, setFeeBps] = useState<bigint>(100n);
  useEffect(() => {
    (async () => {
      try {
        const bps = (await client.readContract({
          address: lc(SWAPPER as Address),
          abi: [{ type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const,
          functionName: "feeBps",
        })) as bigint;
        if (bps >= 0n && bps <= 500n) setFeeBps(bps);
      } catch {}
    })();
  }, [client]);

  /* ---------- quote (V2 getAmountsOut; broadened paths) ---------- */
  const mainAmountIn = useMemo(
    () => (amountInBig === 0n ? 0n : (amountInBig * (FEE_DENOM - feeBps)) / FEE_DENOM),
    [amountInBig, feeBps]
  );
  const [quotePath, setQuotePath] = useState<Address[] | undefined>();
  const [quoteOutMain, setQuoteOutMain] = useState<bigint | undefined>();
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "noroute" | "ok">("idle");
  const [quoteErr, setQuoteErr] = useState<string | undefined>();
  const [debugPath, setDebugPath] = useState<string | undefined>(); // tiny helper

  useEffect(() => {
    let alive = true;
    (async () => {
      setQuoteErr(undefined);
      setQuoteOutMain(undefined);
      setQuotePath(undefined);
      setDebugPath(undefined);

      if (!client || !isOnBase || mainAmountIn === 0n || !isAddress(tokenOut)) {
        setQuoteState("idle");
        return;
      }

      setQuoteState("loading");
      const paths = buildCandidatePaths(tokenIn, tokenOut);

      let found = false;
      for (const p of paths) {
        try {
          const amounts = (await client.readContract({
            address: lc(QUOTE_ROUTER_V2 as Address),
            abi: UniV2RouterAbi as any,
            functionName: "getAmountsOut",
            args: [mainAmountIn, p],
          })) as bigint[];
          const out = amounts.at(-1);
          if (out && out > 0n) {
            if (!alive) return;
            setQuotePath(p);
            setQuoteOutMain(out);
            setQuoteState("ok");
            setDebugPath(p.join(" → "));
            found = true;
            break;
          }
        } catch (e: any) {
          if (!alive) return;
          // save one representative error (helps confirm router compatibility)
          setQuoteErr((prev) => prev ?? String(e?.shortMessage || e?.message || e));
        }
      }
      if (!found && alive) setQuoteState("noroute");
    })();
    return () => {
      alive = false;
    };
  }, [client, isOnBase, tokenIn, tokenOut, mainAmountIn]);

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

  /* ---------- allowance / approval (hooks) ---------- */
  const tokenInAddr = inMeta.address as Address | undefined;
  const needsApproval = !!tokenInAddr;
  const { value: allowanceValue = 0n, isLoading: isAllowanceLoading, refetch: refetchAllowance } =
    useStickyAllowance(tokenInAddr, address as Address | undefined, SWAPPER as Address);
  const { approveMaxFlow, isPending: isApproving } = useApprove(tokenInAddr, SWAPPER as Address);

  const onApprove = useCallback(async () => {
    if (!needsApproval || !isConnected || !tokenInAddr) return;
    try {
      await approveMaxFlow(allowanceValue);
      setTimeout(() => refetchAllowance(), 1000);
    } catch {}
  }, [needsApproval, isConnected, tokenInAddr, approveMaxFlow, allowanceValue, refetchAllowance]);

  /* ---------- fee path ---------- */
  const buildFeePath = (inA: Address): Address[] => {
    const inL = lc(inA);
    if (eq(inL, TOBY)) return lcPath([inL as Address, TOBY as Address]);
    if (eq(inL, WETH)) return lcPath([WETH as Address, TOBY as Address]);
    return lcPath([inL as Address, WETH as Address, TOBY as Address]);
  };

  /* ---------- simulate then send ---------- */
  const [preflightMsg, setPreflightMsg] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  async function doSwap() {
    if (!isConnected || !isOnBase) {
      setPreflightMsg("Connect your wallet on Base to swap.");
      return;
    }
    if (!quotePath || amountInBig === 0n) return;

    setPreflightMsg(undefined);
    setSending(true);

    const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
    const decIn = inMeta.decimals;
    const decOut = outMeta.decimals;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

    const mainPath = lcPath(quotePath);
    const feePath = buildFeePath(inAddr);

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
            0n,
            deadline,
          ],
          value: parseUnits(amt || "0", 18),
          account: address as Address,
          chain: base,
        });

        // Preflight ETH (value + gas)
        const gas = sim.request.gas ?? 0n;
        const feePerGas =
          (sim.request as any).maxFeePerGas ?? (await client.getGasPrice());
        const totalNeeded = (sim.request.value ?? 0n) + gas * feePerGas;
        const bal = await client.getBalance({ address: address as Address });

        if (bal < totalNeeded) {
          setPreflightMsg(
            `Not enough ETH to complete. You have ${fmtEth(bal)} ETH; need ~${fmtEth(totalNeeded)} ETH including gas.`
          );
          setSending(false);
          return;
        }

        await writeContractAsync(sim.request);
      } else {
        if (allowanceValue < amountInBig) {
          setPreflightMsg(`Approve ${inMeta.symbol} for the swap first.`);
          setSending(false);
          return;
        }

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
            0n,
            deadline,
          ],
          account: address as Address,
          chain: base,
        });

        // Preflight gas only
        const gas = sim.request.gas ?? 0n;
        const feePerGas =
          (sim.request as any).maxFeePerGas ?? (await client.getGasPrice());
        const totalNeeded = gas * feePerGas;
        const bal = await client.getBalance({ address: address as Address });

        if (bal < totalNeeded) {
          setPreflightMsg(
            `You need ~${fmtEth(totalNeeded)} ETH for gas, but only have ${fmtEth(bal)} ETH.`
          );
          setSending(false);
          return;
        }

        await writeContractAsync(sim.request);
      }
    } catch (e: any) {
      setPreflightMsg(e?.shortMessage || e?.message || String(e));
    } finally {
      setSending(false);
    }
  }

  /* ---------- UI ---------- */
  const approveText = needsApproval
    ? isAllowanceLoading
      ? "Checking allowance…"
      : allowanceValue > 0n
      ? `Re-approve ${inMeta.symbol}`
      : `Approve ${inMeta.symbol}`
    : `No approval needed`;

  const disableSwap =
    !isConnected ||
    !isOnBase ||
    amountInBig === 0n ||
    !quotePath ||
    (balInRaw.value ?? 0n) < amountInBig ||
    (needsApproval && allowanceValue < amountInBig) ||
    sending;

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

      {!isOnBase && (
        <div className="mb-3 text-xs rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
          You’re not on Base. <button onClick={ensureBase} className="underline">Switch to Base</button> to continue.
        </div>
      )}

      {/* Token In */}
      <div className="space-y-2">
        <label className="text-sm text-inkSub">Token In</label>
        <TokenSelect
          value={tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address)}
          onChange={(a) => { setTokenIn(a); setAmt(""); }}
          exclude={tokenOut}
          balance={
            balInRaw.value !== undefined
              ? Number(formatUnits(balInRaw.value, inMeta.decimals)).toFixed(6)
              : undefined
          }
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
            Amount {inMeta.symbol === "ETH" ? "(ETH)" : `(${inMeta.symbol})`}
          </label>
          <div className="text-xs text-inkSub">
            Bal:{" "}
            <span className="font-mono">
              {balInRaw.value !== undefined
                ? Number(formatUnits(balInRaw.value, inMeta.decimals)).toFixed(6)
                : "—"}
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
              onClick={onApprove}
              className="pill w-full justify-center font-semibold hover:opacity-90 disabled:opacity-60"
              disabled={isApproving || !isConnected || !isOnBase}
              title={`Approve ${inMeta.symbol} for ${SWAPPER}`}
            >
              {isApproving ? "Approving…" : approveText}
            </button>
            <div className="mt-1 text-[11px] text-inkSub">
              Spender: <code className="break-all">{SWAPPER as Address}</code>
              {allowanceValue !== undefined && (
                <> · Allowance: <span className="font-mono">{allowanceValue.toString()}</span></>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Token Out & estimate */}
      <div className="space-y-2 mt-4">
        <label className="text-sm text-inkSub">Token Out</label>
        <TokenSelect
          value={tokenOut}
          onChange={(v) => { setTokenOut(v); setAmt(""); }}
          exclude={tokenIn as Address}
          balance={
            balOutRaw.value !== undefined
              ? Number(formatUnits(balOutRaw.value, outMeta.decimals)).toFixed(6)
              : undefined
          }
        />
        <div className="text-xs text-inkSub">
          {quoteState === "loading" && <>Finding the best route…</>}
          {quoteState === "noroute" && (
            <>
              No V2 route found for this pair/size on the configured router.
              {quoteErr && <> <span className="text-warn">({quoteErr})</span></>}
            </>
          )}
          {quoteState === "ok" && expectedOutMainHuman !== undefined && (
            <>
              Est (after fee): <span className="font-mono">{expectedOutMainHuman.toFixed(6)}</span>{" "}
              {outMeta.symbol} · 1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}
            </>
          )}
          {quoteState === "idle" && <>1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}</>}
        </div>
        {/* tiny debug: shows the exact discovered path */}
        {debugPath && (
          <div className="text-[11px] text-inkSub">Path: <code className="break-all">{debugPath}</code></div>
        )}
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

      {preflightMsg && (
        <div className="text-[11px] text-warn mt-2">{preflightMsg}</div>
      )}

      {/* Slippage modal */}
      {slippageOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSlippageOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-strong rounded-2xl p-5 w-[90%] max-w-sm border border-white/10">
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
                  className={`pill justify-center px-3 py-1 text-xs ${
                    slippage === v ? "outline outline-1 outline-white/20" : ""
                  }`}
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
