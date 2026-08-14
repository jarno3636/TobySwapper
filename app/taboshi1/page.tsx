"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { base } from "viem/chains";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import ConnectPill from "@/components/ConnectPill";
import LinkMaybeMini from "@/components/LinkMaybeMini";

import {
  TABOSHI1_ADDRESS as TABOSHI1,
  TABOSHI1_TOKEN_ID as TOKEN_ID,
  TABOSHI1_ABI as ERC1155_ABI,
  TABOSHI1_BASESCAN as BASESCAN_URL,
  TABOSHI1_OPENSEA as MARKET_URL,
  resolveIpfs,
} from "@/lib/taboshi1";

type TxState = "idle" | "sending" | "success" | "error";

function shortAddress(value?: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function TaboshiOnePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: base.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [recipient, setRecipient] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [message, setMessage] = useState("");

  const balanceRead = useReadContract({
    address: TABOSHI1,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: address ? [address, TOKEN_ID] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), refetchInterval: 20_000 },
  });

  const uriRead = useReadContract({
    address: TABOSHI1, abi: ERC1155_ABI, functionName: "uri",
    args: [TOKEN_ID], chainId: base.id,
  });
  const supplyRead = useReadContract({
    address: TABOSHI1, abi: ERC1155_ABI, functionName: "totalSupply",
    args: [TOKEN_ID], chainId: base.id,
  });
  const [metadata, setMetadata] = useState<{ name?: string; description?: string; image?: string } | null>(null);

  useEffect(() => {
    const uri = typeof uriRead.data === "string" ? resolveIpfs(uriRead.data) : null;
    if (!uri) return;
    fetch(uri).then((r) => r.ok ? r.json() : null).then((data) => data && setMetadata(data)).catch(() => {});
  }, [uriRead.data]);

  const balance = typeof balanceRead.data === "bigint" ? balanceRead.data : 0n;
  const totalSupply = typeof supplyRead.data === "bigint" ? supplyRead.data : null;
  const artwork = resolveIpfs(metadata?.image);

  const qty = useMemo(() => {
    try {
      if (!/^\d+$/.test(quantity.trim())) return 0n;
      return BigInt(quantity.trim());
    } catch {
      return 0n;
    }
  }, [quantity]);

  const canSend = Boolean(
    address &&
    isAddress(recipient) &&
    qty > 0n &&
    qty <= balance &&
    txState !== "sending"
  );

  useEffect(() => {
    if (balance === 0n) setQuantity("1");
    else if (qty > balance) setQuantity(balance.toString());
  }, [balance]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendRelic() {
    if (!address || !canSend) return;
    setTxState("sending");
    setMessage("");
    setTxHash(null);
    try {
      if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
      const hash = await writeContractAsync({
        address: TABOSHI1,
        abi: ERC1155_ABI,
        functionName: "safeTransferFrom",
        args: [address, recipient as Address, TOKEN_ID, qty, "0x"],
        chainId: base.id,
      });
      setTxHash(hash);
      if (client) await client.waitForTransactionReceipt({ hash });
      await balanceRead.refetch();
      setTxState("success");
      setMessage(`${quantity} Taboshi 1 sent.`);
      setRecipient("");
      setQuantity("1");
    } catch (error) {
      setTxState("error");
      setMessage(error instanceof Error ? error.message.split("\n")[0] : "Transfer was not completed.");
    }
  }

  return (
    <MiniAppGate>
      <div className="taboshi1-page mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <section className="taboshi1-hero">
          <div className="taboshi1-hero-copy">
            <span className="taboshi1-kicker">EARLY POND RELIC · ERC-1155</span>
            <h1>Taboshi 1</h1>
            <p>Before the leaf became familiar, there was an early artifact in the pond. See yours. Send yours. Keep it simple.</p>
            <div className="taboshi1-hero-actions">
              <a href="#holdings" className="metal-button taboshi1-primary">View my relics</a>
              <LinkMaybeMini href={MARKET_URL} className="metal-button">Trade on Zora ↗</LinkMaybeMini>
            </div>
          </div>
          <div className="taboshi1-hero-art" aria-hidden="true">
            <span className="taboshi1-orbit taboshi1-orbit-a" />
            <span className="taboshi1-orbit taboshi1-orbit-b" />
            <div className="taboshi1-relic-disc"><Image src="/tokens/taboshi.PNG" alt="" fill sizes="180px" className="object-contain p-5" /></div>
            <div className="taboshi1-frog"><Image src="/tokens/toby.PNG" alt="" fill sizes="120px" className="object-contain" /></div>
            <span className="taboshi1-triangle" />
          </div>
        </section>

        <section id="holdings" className="taboshi1-grid scroll-mt-24">
          <article className="taboshi1-card taboshi1-holding-card">
            <div className="taboshi1-card-head">
              <div><span className="taboshi1-kicker">YOUR HOLDING</span><h2>twpot #1</h2></div>
              <span className="taboshi1-chain-chip"><i />BASE</span>
            </div>

            <div className="taboshi1-showcase">
              <div className="taboshi1-token-art">{artwork ? <img src={artwork} alt={metadata?.name || "twpot #1"} className="taboshi1-real-art" /> : <Image src="/tokens/taboshi.PNG" alt="Taboshi leaf" fill sizes="220px" className="object-contain p-7" />}</div>
              <div className="taboshi1-balance">
                <small>YOU HOLD</small>
                <strong>{isConnected ? (balanceRead.isLoading ? "…" : balance.toLocaleString()) : "—"}</strong>
                <span>Taboshi 1 · Token #1</span>
              </div>
            </div>

            {!isConnected ? (
              <div className="taboshi1-connect"><p>Connect the wallet that holds your relic.</p><ConnectPill /></div>
            ) : (
              <div className="taboshi1-owner"><span>Connected</span><strong>{shortAddress(address)}</strong><button onClick={() => balanceRead.refetch()}>Refresh</button></div>
            )}

            <div className="taboshi1-onchain-facts">
              <div><span>STANDARD</span><strong>ERC-1155</strong></div>
              <div><span>NETWORK</span><strong>Base</strong></div>
              <div><span>TOKEN ID</span><strong>#1</strong></div>
              <div><span>SUPPLY</span><strong>{totalSupply === null ? "Onchain" : totalSupply.toLocaleString()}</strong></div>
            </div>
            <div className="taboshi1-contract-line"><span>CONTRACT</span><code>{shortAddress(TABOSHI1)}</code><b>LIVE ONCHAIN</b></div>

            <div className="taboshi1-link-row">
              <LinkMaybeMini href={MARKET_URL} className="metal-button taboshi1-trade">Trade <span>↗</span></LinkMaybeMini>
              <LinkMaybeMini href={BASESCAN_URL} className="metal-button">Onchain <span>↗</span></LinkMaybeMini>
            </div>
            <p className="taboshi1-market-note">Trading opens the external collection market. TobySwap does not custody the NFT or set the market price.</p>
          </article>

          <article className="taboshi1-card taboshi1-send-card">
            <div className="taboshi1-card-head">
              <div><span className="taboshi1-kicker">TRANSFER</span><h2>Send a relic</h2></div>
              <div className="taboshi1-send-orb">→</div>
            </div>
            <p className="taboshi1-card-copy">Send directly from your wallet. No marketplace and no extra approval.</p>

            <label className="taboshi1-label">
              <span>TO</span>
              <input value={recipient} onChange={(e) => setRecipient(e.target.value.trim())} placeholder="0x… wallet address" autoComplete="off" spellCheck={false} />
            </label>
            <label className="taboshi1-label">
              <span>QUANTITY</span>
              <div className="taboshi1-quantity-row">
                <input inputMode="numeric" pattern="[0-9]*" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} />
                <button type="button" onClick={() => balance > 0n && setQuantity(balance.toString())} disabled={balance === 0n}>ALL</button>
              </div>
            </label>

            <button className="taboshi1-send-button" disabled={!canSend} onClick={sendRelic}>
              <span>{txState === "sending" ? "Sending…" : !isConnected ? "Connect to send" : balance === 0n ? "No Taboshi 1 found" : "Send Taboshi 1"}</span>
              <b>→</b>
            </button>

            {message && (
              <div className={`taboshi1-message ${txState === "success" ? "is-success" : "is-error"}`}>
                <strong>{txState === "success" ? "Transfer complete" : "Transfer not completed"}</strong>
                <span>{message}</span>
                {txHash && <LinkMaybeMini href={`https://basescan.org/tx/${txHash}`}>View transaction ↗</LinkMaybeMini>}
              </div>
            )}

            <div className="taboshi1-proof">
              <span className="taboshi1-proof-icon">1155</span>
              <p><strong>Self-custody.</strong> The transfer calls the collection directly from your connected Base wallet.</p>
            </div>
          </article>
        </section>

        <section className="taboshi1-lore-strip">
          <div className="taboshi1-lore-frog"><Image src="/tokens/toby.PNG" alt="Toby" fill sizes="70px" className="object-contain" /></div>
          <div><span className="taboshi1-kicker">FROM THE ARCHIVE</span><strong>An early Tobyworld artifact.</strong><p>Known in the collection as <b>twpot</b>. Kept here as a simple holder tool—not a new token and not a replacement for TABOSHI.</p></div>
          <span className="taboshi1-lore-leaf"><Image src="/tokens/taboshi.PNG" alt="" fill sizes="64px" className="object-contain" /></span>
        </section>
      </div>
      <Footer />
      <PondDock active="swap" />
    </MiniAppGate>
  );
}
