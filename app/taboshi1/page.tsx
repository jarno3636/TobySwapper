"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { formatUnits, isAddress } from "viem";
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
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { TOBY, PATIENCE, TABOSHI } from "@/lib/addresses";
import {
  TABOSHI1_ADDRESS,
  TABOSHI1_TOKEN_ID,
  TABOSHI1_ABI,
  TABOSHI1_BASESCAN,
  TABOSHI1_OPENSEA,
  resolveIpfs,
} from "@/lib/taboshi1";
import {
  TABOSHI_SEEDS_ADDRESS,
  TABOSHI_SEED_ID,
  TABOSHI_SEEDS_ABI,
  TABOSHI_SEEDS_BASESCAN,
  resolveSeedUri,
} from "@/lib/taboshi-seeds";

type TxState = "idle" | "sending" | "success" | "error";
type RelicKind = "leaf" | "seed";
type Metadata = { name?: string; description?: string; image?: string };

function shortAddress(value?: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function compactTokenBalance(value?: bigint, decimals = 18) {
  if (value === undefined) return "…";
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return n.toLocaleString(undefined, { maximumSignificantDigits: 4 });
}

async function loadMetadata(uri: string | null, setter: (value: Metadata | null) => void) {
  if (!uri) return;
  try {
    const response = await fetch(uri);
    if (!response.ok) return;
    const json = await response.json();
    setter(json && typeof json === "object" ? json : null);
  } catch {
    // The token remains usable even when a public metadata gateway is unavailable.
  }
}

export default function TaboshiOnePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: base.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [selected, setSelected] = useState<RelicKind>("seed");
  const [recipient, setRecipient] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [message, setMessage] = useState("");
  const [leafMetadata, setLeafMetadata] = useState<Metadata | null>(null);
  const [seedMetadata, setSeedMetadata] = useState<Metadata | null>(null);

  const leafBalanceRead = useReadContract({
    address: TABOSHI1_ADDRESS,
    abi: TABOSHI1_ABI,
    functionName: "balanceOf",
    args: address ? [address, TABOSHI1_TOKEN_ID] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), refetchInterval: 20_000 },
  });
  const leafUriRead = useReadContract({
    address: TABOSHI1_ADDRESS,
    abi: TABOSHI1_ABI,
    functionName: "uri",
    args: [TABOSHI1_TOKEN_ID],
    chainId: base.id,
  });
  const leafSupplyRead = useReadContract({
    address: TABOSHI1_ADDRESS,
    abi: TABOSHI1_ABI,
    functionName: "totalSupply",
    args: [TABOSHI1_TOKEN_ID],
    chainId: base.id,
  });

  const seedBalanceRead = useReadContract({
    address: TABOSHI_SEEDS_ADDRESS,
    abi: TABOSHI_SEEDS_ABI,
    functionName: "balanceOf",
    args: address ? [address, TABOSHI_SEED_ID] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), refetchInterval: 20_000 },
  });
  const seedUriRead = useReadContract({
    address: TABOSHI_SEEDS_ADDRESS,
    abi: TABOSHI_SEEDS_ABI,
    functionName: "uri",
    args: [TABOSHI_SEED_ID],
    chainId: base.id,
  });
  const seedSupplyRead = useReadContract({
    address: TABOSHI_SEEDS_ADDRESS,
    abi: TABOSHI_SEEDS_ABI,
    functionName: "totalMinted",
    chainId: base.id,
  });
  const seedInitializedRead = useReadContract({
    address: TABOSHI_SEEDS_ADDRESS,
    abi: TABOSHI_SEEDS_ABI,
    functionName: "initialized",
    chainId: base.id,
  });
  const seedFaucetRead = useReadContract({
    address: TABOSHI_SEEDS_ADDRESS,
    abi: TABOSHI_SEEDS_ABI,
    functionName: "faucet",
    chainId: base.id,
  });

  const tobyWallet = useTokenBalance(address, TOBY, { chainId: base.id });
  const patienceWallet = useTokenBalance(address, PATIENCE, { chainId: base.id });
  const taboshiWallet = useTokenBalance(address, TABOSHI, { chainId: base.id });

  useEffect(() => {
    const uri = typeof leafUriRead.data === "string" ? resolveIpfs(leafUriRead.data) : null;
    void loadMetadata(uri, setLeafMetadata);
  }, [leafUriRead.data]);

  useEffect(() => {
    const uri = typeof seedUriRead.data === "string" ? resolveSeedUri(seedUriRead.data) : null;
    void loadMetadata(uri, setSeedMetadata);
  }, [seedUriRead.data]);

  const leafBalance = typeof leafBalanceRead.data === "bigint" ? leafBalanceRead.data : 0n;
  const seedBalance = typeof seedBalanceRead.data === "bigint" ? seedBalanceRead.data : 0n;
  const leafSupply = typeof leafSupplyRead.data === "bigint" ? leafSupplyRead.data : null;
  const seedSupply = typeof seedSupplyRead.data === "bigint" ? seedSupplyRead.data : null;
  const leafArtwork = resolveIpfs(leafMetadata?.image);
  const seedArtwork = resolveSeedUri(seedMetadata?.image);
  const seedUri = typeof seedUriRead.data === "string" ? resolveSeedUri(seedUriRead.data) : null;
  const leafUri = typeof leafUriRead.data === "string" ? resolveIpfs(leafUriRead.data) : null;

  const selectedBalance = selected === "seed" ? seedBalance : leafBalance;
  const selectedName = selected === "seed" ? "SEED" : "Taboshi 1";

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
    qty <= selectedBalance &&
    txState !== "sending"
  );

  useEffect(() => {
    setQuantity(selectedBalance > 0n ? "1" : "1");
    setTxState("idle");
    setMessage("");
    setTxHash(null);
  }, [selected]);

  async function refreshAll() {
    await Promise.all([
      leafBalanceRead.refetch(),
      seedBalanceRead.refetch(),
      tobyWallet.refetch(),
      patienceWallet.refetch(),
      taboshiWallet.refetch(),
    ]);
  }

  async function sendRelic() {
    if (!address || !canSend) return;
    setTxState("sending");
    setMessage("");
    setTxHash(null);
    try {
      if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
      const hash = selected === "seed"
        ? await writeContractAsync({
            address: TABOSHI_SEEDS_ADDRESS,
            abi: TABOSHI_SEEDS_ABI,
            functionName: "safeTransferFrom",
            args: [address, recipient as Address, TABOSHI_SEED_ID, qty, "0x"],
            chainId: base.id,
          })
        : await writeContractAsync({
            address: TABOSHI1_ADDRESS,
            abi: TABOSHI1_ABI,
            functionName: "safeTransferFrom",
            args: [address, recipient as Address, TABOSHI1_TOKEN_ID, qty, "0x"],
            chainId: base.id,
          });
      setTxHash(hash);
      if (client) await client.waitForTransactionReceipt({ hash });
      await refreshAll();
      setTxState("success");
      setMessage(`${quantity} ${selectedName} sent.`);
      setRecipient("");
      setQuantity("1");
    } catch (error) {
      setTxState("error");
      setMessage(error instanceof Error ? error.message.split("\n")[0] : "Transfer was not completed.");
    }
  }

  const pondAssets = [
    { symbol: "TOBY", label: "Pond token", icon: "/tokens/toby.PNG", value: tobyWallet.value, decimals: tobyWallet.decimals, tone: "blue" },
    { symbol: "PATIENCE", label: "Ancient flame", icon: "/tokens/patience.PNG", value: patienceWallet.value, decimals: patienceWallet.decimals, tone: "red" },
    { symbol: "TABOSHI", label: "Awakened leaf", icon: "/tokens/taboshi.PNG", value: taboshiWallet.value, decimals: taboshiWallet.decimals, tone: "green" },
  ] as const;

  return (
    <MiniAppGate>
      <div className="taboshi1-page seeds-leaves-page mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <section className="taboshi1-hero seeds-leaves-hero">
          <div className="taboshi1-hero-copy">
            <span className="taboshi1-kicker">OLD LEAVES · NEW SEEDS · ONCHAIN</span>
            <h1>Seeds &amp; Leaves</h1>
            <p>See the early Taboshi leaf, the new Seed, and the Tobyworld assets your wallet carries through the pond.</p>
            <div className="taboshi1-hero-actions">
              <a href="#holdings" className="metal-button taboshi1-primary">Open my pouch</a>
              <LinkMaybeMini href={TABOSHI_SEEDS_BASESCAN} className="metal-button">Seed contract ↗</LinkMaybeMini>
            </div>
          </div>
          <div className="taboshi1-hero-art" aria-hidden="true">
            <span className="taboshi1-orbit taboshi1-orbit-a" />
            <span className="taboshi1-orbit taboshi1-orbit-b" />
            <div className="taboshi1-relic-disc seeds-leaves-disc">
              {seedArtwork ? <img src={seedArtwork} alt="" className="taboshi1-real-art" /> : <Image src="/tokens/taboshi.PNG" alt="" fill sizes="180px" className="object-contain p-5" />}
            </div>
            <div className="taboshi1-frog"><Image src="/tokens/toby.PNG" alt="" fill sizes="120px" className="object-contain" /></div>
            <span className="taboshi1-triangle" />
          </div>
        </section>

        <section id="holdings" className="seedleaf-dual-grid scroll-mt-24">
          <article className="taboshi1-card seedleaf-relic-card seedleaf-seed-card">
            <div className="taboshi1-card-head">
              <div><span className="taboshi1-kicker">NEW SEED · ERC-1155</span><h2>{seedMetadata?.name || "Taboshi Seeds"}</h2></div>
              <span className="taboshi1-chain-chip"><i />BASE</span>
            </div>
            <div className="taboshi1-showcase seedleaf-seed-showcase">
              <div className="taboshi1-token-art seedleaf-seed-art">
                {seedArtwork ? <img src={seedArtwork} alt={seedMetadata?.name || "Taboshi Seed"} className="taboshi1-real-art" /> : <div className="seedleaf-seed-fallback">SEED</div>}
              </div>
              <div className="taboshi1-balance seedleaf-seed-balance">
                <small>YOU HOLD</small>
                <strong>{isConnected ? (seedBalanceRead.isLoading ? "…" : seedBalance.toLocaleString()) : "—"}</strong>
                <span>SEED · Token #1</span>
              </div>
            </div>
            <div className="taboshi1-onchain-facts">
              <div><span>MINTED</span><strong>{seedSupply === null ? "Onchain" : seedSupply.toLocaleString()}</strong></div>
              <div><span>FAUCET</span><strong>{seedInitializedRead.data === true ? "BOUND" : "PENDING"}</strong></div>
              <div><span>TOKEN ID</span><strong>#1</strong></div>
              <div><span>STANDARD</span><strong>ERC-1155</strong></div>
            </div>
            <div className="taboshi1-contract-line"><span>FAUCET</span><code>{typeof seedFaucetRead.data === "string" ? shortAddress(seedFaucetRead.data) : "—"}</code><b>WRITE-ONCE LATCH</b></div>
            <div className="taboshi1-link-row">
              {seedUri && <a href={seedUri} target="_blank" rel="noreferrer" className="metal-button">URI metadata <span>↗</span></a>}
              <LinkMaybeMini href={TABOSHI_SEEDS_BASESCAN} className="metal-button">Onchain <span>↗</span></LinkMaybeMini>
            </div>
          </article>

          <article className="taboshi1-card seedleaf-relic-card">
            <div className="taboshi1-card-head">
              <div><span className="taboshi1-kicker">OLD LEAF · EARLY RELIC</span><h2>{leafMetadata?.name || "twpot #1"}</h2></div>
              <span className="taboshi1-chain-chip"><i />BASE</span>
            </div>
            <div className="taboshi1-showcase">
              <div className="taboshi1-token-art">
                {leafArtwork ? <img src={leafArtwork} alt={leafMetadata?.name || "twpot #1"} className="taboshi1-real-art" /> : <Image src="/tokens/taboshi.PNG" alt="Taboshi leaf" fill sizes="220px" className="object-contain p-7" />}
              </div>
              <div className="taboshi1-balance">
                <small>YOU HOLD</small>
                <strong>{isConnected ? (leafBalanceRead.isLoading ? "…" : leafBalance.toLocaleString()) : "—"}</strong>
                <span>Taboshi 1 · Token #1</span>
              </div>
            </div>
            <div className="taboshi1-onchain-facts">
              <div><span>SUPPLY</span><strong>{leafSupply === null ? "Onchain" : leafSupply.toLocaleString()}</strong></div>
              <div><span>NETWORK</span><strong>Base</strong></div>
              <div><span>TOKEN ID</span><strong>#1</strong></div>
              <div><span>STANDARD</span><strong>ERC-1155</strong></div>
            </div>
            <div className="taboshi1-link-row">
              {leafUri && <a href={leafUri} target="_blank" rel="noreferrer" className="metal-button">URI metadata <span>↗</span></a>}
              <LinkMaybeMini href={TABOSHI1_OPENSEA} className="metal-button taboshi1-trade">Market <span>↗</span></LinkMaybeMini>
            </div>
          </article>
        </section>

        {!isConnected ? (
          <div className="taboshi1-connect seedleaf-connect"><p>Connect your Base wallet to reveal the pouch.</p><ConnectPill /></div>
        ) : (
          <div className="taboshi1-owner seedleaf-owner"><span>Connected</span><strong>{shortAddress(address)}</strong><button onClick={refreshAll}>Refresh all</button></div>
        )}

        <section className="seedleaf-all-assets">
          <div className="seedleaf-section-head">
            <div>
              <span className="taboshi1-kicker">YOUR POND</span>
              <h2>Everything in this wallet</h2>
              <p>Tobyworld tokens, the old leaf, and the new Seed in one simple holder view.</p>
            </div>
            <span className="seedleaf-asset-count">{isConnected ? "LIVE ON BASE" : "CONNECT TO VIEW"}</span>
          </div>
          <div className="seedleaf-assets-grid">
            {pondAssets.map((asset) => (
              <article key={asset.symbol} className={`seedleaf-asset-card seedleaf-asset-${asset.tone}`}>
                <div className="seedleaf-asset-icon"><Image src={asset.icon} alt={asset.symbol} fill sizes="48px" className="object-contain p-1" /></div>
                <div className="seedleaf-asset-copy"><span>{asset.label}</span><strong>{asset.symbol}</strong><b>{isConnected ? compactTokenBalance(asset.value, asset.decimals) : "—"}</b></div>
              </article>
            ))}
            <article className="seedleaf-asset-card seedleaf-asset-leaf">
              <div className="seedleaf-asset-icon seedleaf-asset-image">{leafArtwork ? <img src={leafArtwork} alt="Taboshi 1" /> : <Image src="/tokens/taboshi.PNG" alt="Taboshi 1" fill sizes="48px" className="object-contain p-1" />}</div>
              <div className="seedleaf-asset-copy"><span>Old leaf · 1155</span><strong>TABOSHI 1</strong><b>{isConnected ? leafBalance.toLocaleString() : "—"}</b></div>
            </article>
            <article className="seedleaf-asset-card seedleaf-asset-seed">
              <div className="seedleaf-asset-icon seedleaf-asset-image">{seedArtwork ? <img src={seedArtwork} alt="SEED" /> : <span className="seedleaf-seed-mini">SEED</span>}</div>
              <div className="seedleaf-asset-copy"><span>New seed · 1155</span><strong>SEED</strong><b>{isConnected ? seedBalance.toLocaleString() : "—"}</b></div>
            </article>
          </div>
        </section>

        <section className="taboshi1-card seedleaf-transfer-card">
          <div className="taboshi1-card-head">
            <div><span className="taboshi1-kicker">TRANSFER</span><h2>Send from the pouch</h2></div>
            <div className="taboshi1-send-orb">→</div>
          </div>
          <div className="seedleaf-transfer-tabs">
            <button type="button" className={selected === "seed" ? "active" : ""} onClick={() => setSelected("seed")}>SEED <b>{isConnected ? seedBalance.toLocaleString() : "—"}</b></button>
            <button type="button" className={selected === "leaf" ? "active" : ""} onClick={() => setSelected("leaf")}>OLD LEAF <b>{isConnected ? leafBalance.toLocaleString() : "—"}</b></button>
          </div>
          <p className="taboshi1-card-copy">Direct ERC-1155 transfer from your wallet. No custody and no marketplace required.</p>
          <div className="seedleaf-transfer-fields">
            <label className="taboshi1-label">
              <span>TO</span>
              <input value={recipient} onChange={(e) => setRecipient(e.target.value.trim())} placeholder="0x… wallet address" autoComplete="off" spellCheck={false} />
            </label>
            <label className="taboshi1-label">
              <span>QUANTITY</span>
              <div className="taboshi1-quantity-row">
                <input inputMode="numeric" pattern="[0-9]*" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} />
                <button type="button" onClick={() => selectedBalance > 0n && setQuantity(selectedBalance.toString())} disabled={selectedBalance === 0n}>ALL</button>
              </div>
            </label>
          </div>
          <button className="taboshi1-send-button" disabled={!canSend} onClick={sendRelic}>
            <span>{txState === "sending" ? "Sending…" : !isConnected ? "Connect to send" : selectedBalance === 0n ? `No ${selectedName} found` : `Send ${selectedName}`}</span><b>→</b>
          </button>
          {message && (
            <div className={`taboshi1-message ${txState === "success" ? "is-success" : "is-error"}`}>
              <strong>{txState === "success" ? "Transfer complete" : "Transfer not completed"}</strong>
              <span>{message}</span>
              {txHash && <LinkMaybeMini href={`https://basescan.org/tx/${txHash}`}>View transaction ↗</LinkMaybeMini>}
            </div>
          )}
        </section>

        <section className="taboshi1-lore-strip seeds-leaves-lore-strip">
          <div className="taboshi1-lore-frog"><Image src="/tokens/toby.PNG" alt="Toby" fill sizes="70px" className="object-contain" /></div>
          <div><span className="taboshi1-kicker">FROM THE ARCHIVE</span><strong>Old leaves return. New seeds wake.</strong><p>Taboshi 1 preserves an early leaf from the pond. SEED is the single-token ERC-1155 minted only by THE OPEN FAUCET after its mint authority is permanently bound.</p></div>
          <span className="taboshi1-lore-leaf"><Image src="/tokens/taboshi.PNG" alt="" fill sizes="64px" className="object-contain" /></span>
        </section>
      </div>
      <Footer />
      <PondDock active="swap" />
    </MiniAppGate>
  );
}
