// components/SwapDebug.tsx
"use client";

import { useState } from "react";
import type { DebugInfo } from "./debugTypes";
import { formatUnits, type Address } from "viem";

function addr(a?: string) {
  if (!a) return "—";
  return a.slice(0, 6) + "…" + a.slice(-4);
}
function fmtBig(v?: bigint, d = 18) {
  if (v === undefined) return "—";
  try { return Number(formatUnits(v, d)).toFixed(6); } catch { return v.toString(); }
}

export default function SwapDebug({ info }: { info: DebugInfo }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        className="pill pill-opaque text-xs px-3 py-1"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
      >
        {open ? "Hide debug" : "Show debug"}
      </button>

      {open && (
        <div className="mt-3 glass rounded-2xl p-4 text-[12px] leading-5">
          {/* ENV */}
          <section className="mb-3">
            <div className="font-semibold text-sm mb-1">Environment</div>
            <div>onBase: <b className={info.isOnBase ? "text-green-400" : "text-red-400"}>{String(info.isOnBase)}</b></div>
            <div>chainId: <b>{info.chainId ?? "—"}</b></div>
            <div>account: <code>{info.account ? (info.account as Address) : "—"}</code></div>
          </section>

          {/* INPUTS */}
          <section className="mb-3">
            <div className="font-semibold text-sm mb-1">Inputs</div>
            <div>tokenIn: <code>{typeof info.tokenIn === "string" ? info.tokenIn : addr(info.tokenIn)}</code></div>
            <div>tokenOut: <code>{addr(info.tokenOut)}</code></div>
            <div>amountIn: <b>{info.amountInHuman ?? "0"}</b></div>
            <div>slippage: <b>{info.slippage ?? 0.5}%</b></div>
            <div>feeBps: <b>{info.feeBps?.toString() ?? "—"}</b></div>
          </section>

          {/* QUOTE */}
          <section className="mb-3">
            <div className="font-semibold text-sm mb-1">Quote</div>
            <div>state: <b>{info.state}</b></div>
            <div>best: <b>{info.bestKind ?? "none"}</b> · bestOut: <b>{info.bestOut?.toString() ?? "—"}</b></div>
            {info.quoteError && <div className="text-yellow-400">error: {info.quoteError}</div>}
            <div className="mt-2">
              <div className="font-medium mb-1">Attempts ({info.attempts.length})</div>
              <ul className="space-y-1">
                {info.attempts.map((a, i) => (
                  <li key={i} className="rounded border border-white/10 p-2">
                    <div><b>{a.kind.toUpperCase()}</b> · {a.ms}ms · {a.ok ? "ok" : "fail"}</div>
                    {"fees" in a && a.kind === "v3" ? (
                      <div>path: {a.pathTokens.map((t, j) => (
                        <span key={j}><code>{addr(t)}</code>{j < a.pathTokens.length - 1 ? ` (${a.fees[j]}) → ` : ""}</span>
                      ))}</div>
                    ) : (
                      <div>path: {a.pathTokens.map((t, j) => (
                        <span key={j}><code>{addr(t)}</code>{j < a.pathTokens.length - 1 ? " → " : ""}</span>
                      ))}</div>
                    )}
                    <div>out: <b>{a.amountOut?.toString() ?? "—"}</b></div>
                    {a.error && <div className="text-yellow-400">err: {a.error}</div>}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* PREFLIGHT / TX */}
          <section className="mb-3">
            <div className="font-semibold text-sm mb-1">Preflight & Tx</div>
            <div>allowance: <b>{info.preflight?.allowance?.toString() ?? "—"}</b></div>
            <div>needApproval: <b>{String(info.preflight?.needApproval ?? false)}</b></div>
            <div>inBalance: <b>{info.preflight?.inBalance?.toString() ?? "—"}</b></div>
            <div>outBalance: <b>{info.preflight?.outBalance?.toString() ?? "—"}</b></div>
            <div>minOut (human): <b>{info.preflight?.minOut ?? "—"}</b></div>
            <div>deadline: <b>{info.preflight?.deadline?.toString() ?? "—"}</b></div>
            <div className="mt-1">tx: <b>{info.tx?.stage ?? "idle"}</b> {info.tx?.hash && <> · hash: <code>{info.tx.hash}</code></>}
            </div>
            {info.tx?.msg && <div className="text-yellow-400">txMsg: {info.tx.msg}</div>}
          </section>

          {/* ADDRS */}
          <section>
            <div className="font-semibold text-sm mb-1">Addresses</div>
            <div>SWAPPER: <code>{info.addresses?.SWAPPER ?? "—"}</code></div>
            <div>QUOTER_V3: <code>{info.addresses?.QUOTER_V3 ?? "—"}</code></div>
            <div>QUOTE_ROUTER_V2: <code>{info.addresses?.QUOTE_ROUTER_V2 ?? "—"}</code></div>
            <div>WETH: <code>{info.addresses?.WETH ?? "—"}</code></div>
            <div>USDC: <code>{info.addresses?.USDC ?? "—"}</code></div>
            <div>TOBY: <code>{info.addresses?.TOBY ?? "—"}</code></div>
          </section>
        </div>
      )}
    </div>
  );
}
