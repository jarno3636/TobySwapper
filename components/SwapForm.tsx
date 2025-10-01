"use client";
import { useState } from "react";
import { Address, isAddress } from "viem";
import TokenSelect from "./TokenSelect";
import { TOKENS, USDC } from "@/lib/addresses";
import { useDoSwap } from "@/hooks/useTobySwapper";
import { WalletPill } from "./Wallet";

export default function SwapForm() {
  const { swapETHForTokens, swapTokensForTokens } = useDoSwap();
  const [tokenIn, setTokenIn] = useState<Address|"ETH">("ETH");
  const [tokenOut, setTokenOut] = useState<Address>(TOKENS.find(t=>t.address!==USDC)!.address);
  const [amt, setAmt] = useState("0.01");

  const doSwap = async () => {
    if (tokenIn === "ETH") {
      await swapETHForTokens(tokenOut, amt, "0", "0");
    } else {
      if (!isAddress(tokenIn) || !isAddress(tokenOut) || tokenIn.toLowerCase()===tokenOut.toLowerCase()) return;
      await swapTokensForTokens(tokenIn as Address, tokenOut, amt, "0", "0");
    }
  };

  return (
    <div className="glass rounded-3xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <WalletPill/>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button className={`pill justify-center ${tokenIn==="ETH"?"outline outline-1 outline-white/20":""}`} onClick={()=>setTokenIn("ETH")}>Base ETH</button>
          <button className={`pill justify-center ${tokenIn!=="ETH"?"outline outline-1 outline-white/20":""}`} onClick={()=>setTokenIn(USDC as Address)}>Token → Token</button>
        </div>

        {tokenIn!=="ETH" && (
          <div>
            <label className="text-sm text-inkSub">Token In</label>
            <TokenSelect value={tokenIn as Address} onChange={(a)=>setTokenIn(a)} exclude={tokenOut}/>
          </div>
        )}

        <div>
          <label className="text-sm text-inkSub">Token Out</label>
          <TokenSelect value={tokenOut} onChange={setTokenOut} exclude={tokenIn as Address}/>
        </div>

        <div>
          <label className="text-sm text-inkSub">Amount {tokenIn==="ETH"?"(ETH)":"(tokens)"}</label>
          <input value={amt} onChange={e=>setAmt(e.target.value)} className="w-full glass rounded-pill px-4 py-3" placeholder="0.0"/>
        </div>

        <button onClick={doSwap} className="pill w-full justify-center font-semibold hover:opacity-90">
          <span className="pip pip-a"/> <span className="pip pip-b"/> <span className="pip pip-c"/> Swap & Burn 1% to TOBY 🔥
        </button>

        <p className="text-xs text-inkSub">Contract collects 1% in-path and converts it to $TOBY, sending to burn wallet. Slippage/minOut are set to 0 here for demo — wire your own quotes/limits before production.</p>
      </div>
    </div>
  );
}
