"use client";
import { useEffect, useMemo, useState } from "react";
import { Address, formatUnits, isAddress, parseUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import TokenSelect from "./TokenSelect";
import { TOKENS, USDC } from "@/lib/addresses";
import { useDoSwap } from "@/hooks/useTobySwapper";
import { WalletPill } from "./Wallet";

/** --- tiny util: find token meta by address --- */
function byAddress(addr?: Address | "ETH") {
  if (!addr || addr === "ETH") return { symbol: "ETH", decimals: 18 as const, address: undefined };
  const t = TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase());
  return t ? { symbol: t.symbol, decimals: t.decimals ?? 18, address: t.address as Address } : { symbol: "TOKEN", decimals: 18, address: addr as Address };
}

/** --- simple pricing hook (replace internals later with your real quotes) --- */
function useUsdPrice(symbol?: string) {
  // wire real prices later (coingecko, onchain, etc.)
  // temporary hardcoded map so the UI looks right
  const PRICES: Record<string, number> = {
    ETH: 3300,
    USDC: 1,
    TOBY: 0.000001,     // placeholder
    PATIENCE: 0.00002,  // placeholder
    TABOSHI: 0.02,      // placeholder
  };
  return PRICES[symbol ?? ""] ?? 0;
}

export default function SwapForm() {
  const { address } = useAccount();
  const { swapETHForTokens, swapTokensForTokens } = useDoSwap();

  const [tokenIn, setTokenIn] = useState<Address | "ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<Address>(TOKENS.find(t => t.address !== USDC)!.address);
  const [amt, setAmt] = useState("0.01");

  // slippage state (in %)
  const [slippageOpen, setSlippageOpen] = useState(false);
  const [slippage, setSlippage] = useState<number>(0.5); // default 0.5%

  // balances via wagmi
  const inMeta = byAddress(tokenIn);
  const outMeta = byAddress(tokenOut);

  const { data: balIn } = useBalance({
    address,
    token: inMeta.address, // undefined = native
    query: { enabled: Boolean(address) },
  });

  const { data: balOut } = useBalance({
    address,
    token: outMeta.address,
    query: { enabled: Boolean(address) },
  });

  const inUsd = useUsdPrice(inMeta.symbol);
  const outUsd = useUsdPrice(outMeta.symbol);

  const amtNum = Number(amt || "0");
  const amtInUsd = useMemo(() => (isFinite(amtNum) ? amtNum * inUsd : 0), [amtNum, inUsd]);

  const maxReadable = useMemo(() => {
    if (!balIn) return "0";
    try {
      return formatUnits(balIn.value, balIn.decimals);
    } catch {
      return "0";
    }
  }, [balIn]);

  const setMax = () => {
    if (!balIn) return;
    // leave a little dust for gas if native
    const raw = parseFloat(formatUnits(balIn.value, balIn.decimals));
    const safe = inMeta.address ? raw : Math.max(0, raw - 0.0005); // 0.0005 ETH buffer
    setAmt((safe > 0 ? safe : 0).toString());
  };

  const swapSides = () => {
    const prevIn = tokenIn;
    const prevOut = tokenOut;
    if (prevIn === "ETH") {
      setTokenIn(prevOut as Address);
    } else {
      if (prevOut === undefined) setTokenIn("ETH");
      else setTokenIn(prevOut as Address);
    }
    setTokenOut(prevIn === "ETH" ? USDC as Address : (prevIn as Address));
  };

  const doSwap = async () => {
    // NOTE: slippage used here only as a placeholder — wire into minOut logic when quotes are integrated.
    if (tokenIn === "ETH") {
      await swapETHForTokens(tokenOut, amt, "0", "0");
    } else {
      if (!isAddress(tokenIn) || !isAddress(tokenOut) || tokenIn.toLowerCase() === tokenOut.toLowerCase()) return;
      await swapTokensForTokens(tokenIn as Address, tokenOut, amt, "0", "0");
    }
  };

  return (
    <div className="glass rounded-3xl p-6 shadow-soft">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <div className="flex items-center gap-2">
          <button
            className="pill pill-opaque text-sm"
            onClick={() => setSlippageOpen(true)}
            aria-label="Set slippage"
            title="Set slippage"
          >
            Slippage: {slippage}%
          </button>
          <WalletPill />
        </div>
      </div>

      <div className="space-y-4">
        {/* Toggle: ETH vs Token→Token */}
        <div className="grid grid-cols-2 gap-3">
          <button
            className={`pill justify-center ${tokenIn === "ETH" ? "outline outline-1 outline-white/20" : ""}`}
            onClick={() => setTokenIn("ETH")}
          >
            Base ETH
          </button>
          <button
            className={`pill justify-center ${tokenIn !== "ETH" ? "outline outline-1 outline-white/20" : ""}`}
            onClick={() => setTokenIn(USDC as Address)}
          >
            Token → Token
          </button>
        </div>

        {/* Token In */}
        {tokenIn !== "ETH" && (
          <div className="space-y-2">
            <label className="text-sm text-inkSub">Token In</label>
            <TokenSelect
              value={tokenIn as Address}
              onChange={(a) => setTokenIn(a)}
              exclude={tokenOut}
              balance={balIn ? formatUnits(balIn.value, balIn.decimals) : undefined}
            />
          </div>
        )}

        {/* Amount & Max */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-inkSub">
              Amount {tokenIn === "ETH" ? "(ETH)" : `(${inMeta.symbol})`}
            </label>
            <div className="text-xs text-inkSub">
              Balance:{" "}
              <span className="font-mono">
                {balIn ? Number(formatUnits(balIn.value, balIn.decimals)).toFixed(6) : "—"}
              </span>
              <button className="ml-2 underline opacity-90 hover:opacity-100" onClick={setMax}>
                MAX
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              className="w-full glass rounded-pill px-4 py-3"
              placeholder="0.0"
              inputMode="decimal"
            />
            {/* Swap sides button */}
            <button
              className="pill pill-opaque px-4"
              type="button"
              onClick={swapSides}
              aria-label="Swap sides"
              title="Swap sides"
            >
              ↕
            </button>
          </div>
          {/* USD row under amount */}
          <div className="mt-2 text-xs text-inkSub">
            ≈ ${amtInUsd ? amtInUsd.toFixed(2) : "0.00"} USD
          </div>
        </div>

        {/* Token Out */}
        <div className="space-y-2">
          <label className="text-sm text-inkSub">Token Out</label>
          <TokenSelect
            value={tokenOut}
            onChange={setTokenOut}
            exclude={tokenIn as Address}
            balance={balOut ? formatUnits(balOut.value, balOut.decimals) : undefined}
          />
          {/* USD preview (amount unknown until quote; this is just token price for context) */}
          <div className="text-xs text-inkSub">1 {outMeta.symbol} ≈ ${outUsd.toFixed(4)} USD</div>
        </div>

        {/* Call-to-action */}
        <button onClick={doSwap} className="pill w-full justify-center font-semibold hover:opacity-90">
          <span className="pip pip-a" /> <span className="pip pip-b" /> <span className="pip pip-c" /> Swap & Burn 1% to TOBY 🔥
        </button>

        <p className="text-xs text-inkSub">
          Contract collects 1% in-path and converts it to $TOBY, sending to burn wallet.
          Slippage/minOut is placeholder here—wire your quotes & limits before production.
        </p>
      </div>

      {/* Slippage modal (simple, on-brand) */}
      {slippageOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSlippageOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-strong rounded-2xl p-5 w-[90%] max-w-sm border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Slippage</h4>
              <button className="pill pill-opaque" onClick={() => setSlippageOpen(false)}>Close</button>
            </div>
            <p className="text-xs text-inkSub mb-3">Choose a tolerance. Lower = safer price, higher = easier fills.</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[0.1, 0.5, 1, 2].map(v => (
                <button
                  key={v}
                  onClick={() => setSlippage(v)}
                  className={`pill justify-center ${slippage === v ? "outline outline-1 outline-white/20" : ""}`}
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
