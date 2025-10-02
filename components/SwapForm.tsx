// components/SwapForm.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Address, formatUnits, isAddress, parseUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { base } from "viem/chains";
import TokenSelect from "./TokenSelect";
import { TOKENS, USDC, ROUTER } from "@/lib/addresses";
import { useDoSwap, buildPaths } from "@/hooks/useTobySwapper";
import { useUsdPriceSingle } from "@/lib/prices";
import { useTokenBalance } from "@/hooks/useTokenBalance";

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
    ? { symbol: t.symbol, decimals: (t.decimals ?? 18) as 18 | 6, address: t.address as Address }
    : { symbol: "TOKEN", decimals: 18 as const, address: addr as Address };
}

// keep last non-empty balance string so UI never flickers to "—"
function useStickyBalance(val?: { value?: bigint; decimals?: number }) {
  const [sticky, setSticky] = useState<string | undefined>(undefined);
  const last = useRef<string | undefined>(undefined);
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
  const { address, chain } = useAccount();
  const { swapETHForTokens, swapTokensForTokens } = useDoSwap();

  const [modeTokenToToken, setModeTokenToToken] = useState(false);
  const [tokenIn, setTokenIn] = useState<Address | "ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<Address>(
    TOKENS.find((t) => t.address !== USDC)!.address
  );
  const [amt, setAmt] = useState("0.01");

  // slippage (%)
  const [slippageOpen, setSlippageOpen] = useState(false);
  const [slippage, setSlippage] = useState<number>(0.5);

  // debounce amount to reduce quote churn
  const [debouncedAmt, setDebouncedAmt] = useState(amt);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedAmt(amt), 300);
    return () => clearTimeout(id);
  }, [amt]);

  // update mode when user toggles
  useEffect(() => {
    if (modeTokenToToken && tokenIn === "ETH") setTokenIn(USDC as Address);
    if (!modeTokenToToken && tokenIn !== "ETH") setTokenIn("ETH");
  }, [modeTokenToToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const inMeta = byAddress(tokenIn);
  const outMeta = byAddress(tokenOut);

  // ---------- Balances (robust: wagmi + ERC20 fallback) ----------
  const balInRaw = useTokenBalance(address, inMeta.address);
  const balOutRaw = useTokenBalance(address, outMeta.address);

  const balInSticky  = useStickyBalance(balInRaw);
  const balOutSticky = useStickyBalance(balOutRaw);

  // ---------- Prices (sticky cached in hook) ----------
  const inUsd  = useUsdPriceSingle(inMeta.symbol === "ETH" ? "ETH" : inMeta.address!);
  const outUsd = useUsdPriceSingle(outMeta.symbol === "ETH" ? "ETH" : outMeta.address!);

  const amtNum = Number(debouncedAmt || "0");
  const amtInUsd = useMemo(
    () => (isFinite(amtNum) ? amtNum * inUsd : 0),
    [amtNum, inUsd]
  );

  // ---------- On-chain quote (debounced input, sticky display) ----------
  const mainPath = useMemo(
    () => buildPaths(tokenIn, tokenOut).pathForMainSwap,
    [tokenIn, tokenOut]
  );

  const amountInBig = useMemo(() => {
    try { return parseUnits(debouncedAmt || "0", inMeta.decimals); } catch { return 0n; }
  }, [debouncedAmt, inMeta.decimals]);

  const quoteEnabled =
    amountInBig > 0n && mainPath.length >= 1 && isAddress(mainPath[mainPath.length - 1]!);

  const { data: amountsOut, isFetching: isQuoteLoading } = useReadContract({
    address: quoteEnabled ? (ROUTER as Address) : undefined,
    abi: UniV2RouterAbi as any,
    functionName: "getAmountsOut",
    args: [amountInBig, mainPath],
    query: {
      enabled: quoteEnabled,
      refetchInterval: 15_000,
      retry: 2,
      placeholderData: (prev: any) => prev,
    },
  } as any);

  const expectedOutBig: bigint | undefined =
    Array.isArray(amountsOut) ? (amountsOut as bigint[]).at(-1) : undefined;

  // sticky last good quote
  const lastQuoteRef = useRef<number | undefined>(undefined);
  const expectedOutHuman = useMemo(() => {
    try { return expectedOutBig ? Number(formatUnits(expectedOutBig, outMeta.decimals)) : undefined; }
    catch { return undefined; }
  }, [expectedOutBig, outMeta.decimals]);
  if (expectedOutHuman != null && isFinite(expectedOutHuman) && expectedOutHuman > 0) {
    lastQuoteRef.current = expectedOutHuman;
  }
  const displayQuote = expectedOutHuman ?? lastQuoteRef.current ?? undefined;

  // minOut = expected * (1 - slippage)
  const minOutMainStr = useMemo(() => {
    if (!expectedOutBig) return "0";
    const bps = Math.round((100 - slippage) * 100);
    const minOut = (expectedOutBig * BigInt(bps)) / 10000n;
    return minOut.toString();
  }, [expectedOutBig, slippage]);

  const setMax = () => {
    if (!balInSticky) return;
    const raw = parseFloat(balInSticky);
    const safe = inMeta.address ? raw : Math.max(0, raw - 0.0005); // gas dust if native
    setAmt((safe > 0 ? safe : 0).toString());
  };

  const swapSides = () => {
    const prevIn = tokenIn;
    const prevOut = tokenOut;
    if (prevIn === "ETH") setModeTokenToToken(true), setTokenIn(prevOut as Address);
    else setTokenIn(prevOut ? (prevOut as Address) : "ETH");
    setTokenOut(prevIn === "ETH" ? (USDC as Address) : (prevIn as Address));
  };

  const doSwap = async () => {
    if (tokenIn === "ETH") {
      await swapETHForTokens(tokenOut, amt, expectedOutBig ? minOutMainStr : "0", "0");
    } else {
      if (!isAddress(tokenIn) || !isAddress(tokenOut) || tokenIn.toLowerCase() === tokenOut.toLowerCase()) return;
      await swapTokensForTokens(tokenIn as Address, tokenOut, amt, expectedOutBig ? minOutMainStr : "0", "0");
    }
  };

  return (
    <div className="glass rounded-3xl p-6 shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <button
          className="pill pill-opaque px-3 py-1 text-xs"
          onClick={() => setSlippageOpen(true)}
          aria-label="Set slippage"
          title="Set slippage"
        >
          Slippage: {slippage}%
        </button>
      </div>

      {chain && chain.id !== base.id && (
        <div className="mb-3 text-xs text-warn">
          Connected to {chain.name}. Please switch to Base for balances & swaps.
        </div>
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
              Bal: <span className="font-mono">{balInSticky ? Number(balInSticky).toFixed(6) : "—"}</span>
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
        </div>

        {/* Center swap-sides */}
        <div className="flex justify-center">
          <button
            className="pill pill-opaque px-3 py-1 text-sm"
            type="button"
            onClick={swapSides}
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
          <TokenSelect
            value={tokenOut}
            onChange={setTokenOut}
            exclude={tokenIn as Address}
            balance={balOutSticky}
          />
          <div className="text-xs text-inkSub">
            {isQuoteLoading && displayQuote === undefined ? (
              <>Fetching…</>
            ) : displayQuote !== undefined ? (
              <>
                Est: <span className="font-mono">{displayQuote.toFixed(6)}</span> {outMeta.symbol}
                {" · "}1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}
              </>
            ) : (
              <>1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)}</>
            )}
          </div>
        </div>

        {/* CTA */}
        <button onClick={doSwap} className="pill w-full justify-center font-semibold hover:opacity-90">
          <span className="pip pip-a" /> <span className="pip pip-b" /> <span className="pip pip-c" /> Swap &amp; Burn 1% to TOBY 🔥
        </button>
      </div>

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
