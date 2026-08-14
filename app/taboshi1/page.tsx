"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { erc20Abi, formatUnits, isAddress, parseUnits } from "viem";
import { base } from "viem/chains";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import ConnectPill from "@/components/ConnectPill";
import LinkMaybeMini from "@/components/LinkMaybeMini";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { TOBY, PATIENCE, TABOSHI } from "@/lib/addresses";
import { TABOSHI1_ADDRESS, TABOSHI1_TOKEN_ID, TABOSHI1_ABI, TABOSHI1_OPENSEA, resolveIpfs } from "@/lib/taboshi1";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEED_ID, TABOSHI_SEEDS_ABI, TABOSHI_SEEDS_BASESCAN, resolveSeedUri, seedImageCandidates } from "@/lib/taboshi-seeds";

type TxState = "idle" | "sending" | "success" | "error";
type AssetKind = "toby" | "patience" | "taboshi" | "leaf" | "seed";
type Metadata = { name?: string; description?: string; image?: string };

function shortAddress(value?: string) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : ""; }
function compact(value?: bigint, decimals = 18) {
  if (value === undefined) return "…";
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumSignificantDigits: 6 });
}
async function loadMetadata(uri: string | null, setter: (v: Metadata | null) => void) {
  if (!uri) return;
  try { const r = await fetch(uri); if (r.ok) { const j = await r.json(); setter(j && typeof j === "object" ? j : null); } } catch {}
}
async function loadSeedMetadata(uri: string | null, setter: (v: Metadata | null) => void) {
  if (!uri) return;
  const candidates = seedImageCandidates(uri);
  for (const candidate of candidates.length ? candidates : [uri]) {
    try {
      const r = await fetch(candidate);
      if (!r.ok) continue;
      const j = await r.json();
      if (j && typeof j === "object") { setter(j); return; }
    } catch {}
  }
}

function SeedArt({ image, name }: { image?: string | null; name?: string }) {
  const candidates = useMemo(() => seedImageCandidates(image), [image]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [image]);
  if (!candidates.length) return <div className="seedleaf-seed-fallback"><span>✦</span><b>SEED</b></div>;
  return <img src={candidates[Math.min(index, candidates.length - 1)]} alt={name || "Taboshi Seed"} className="taboshi1-real-art" onError={() => setIndex((i) => Math.min(i + 1, candidates.length - 1))} />;
}

export default function TaboshiOnePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: base.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [selected, setSelected] = useState<AssetKind>("seed");
  const [recipient, setRecipient] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [message, setMessage] = useState("");
  const [leafMetadata, setLeafMetadata] = useState<Metadata | null>(null);
  const [seedMetadata, setSeedMetadata] = useState<Metadata | null>(null);

  const leafBalanceRead = useReadContract({ address: TABOSHI1_ADDRESS, abi: TABOSHI1_ABI, functionName: "balanceOf", args: address ? [address, TABOSHI1_TOKEN_ID] : undefined, chainId: base.id, query: { enabled: Boolean(address), refetchInterval: 20_000 } });
  const leafUriRead = useReadContract({ address: TABOSHI1_ADDRESS, abi: TABOSHI1_ABI, functionName: "uri", args: [TABOSHI1_TOKEN_ID], chainId: base.id });
  const seedBalanceRead = useReadContract({ address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "balanceOf", args: address ? [address, TABOSHI_SEED_ID] : undefined, chainId: base.id, query: { enabled: Boolean(address), refetchInterval: 20_000 } });
  const seedUriRead = useReadContract({ address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "uri", args: [TABOSHI_SEED_ID], chainId: base.id });
  const seedSupplyRead = useReadContract({ address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "totalMinted", chainId: base.id });
  const seedInitializedRead = useReadContract({ address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "initialized", chainId: base.id });
  const seedFaucetRead = useReadContract({ address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "faucet", chainId: base.id });

  const tobyWallet = useTokenBalance(address, TOBY, { chainId: base.id });
  const patienceWallet = useTokenBalance(address, PATIENCE, { chainId: base.id });
  const taboshiWallet = useTokenBalance(address, TABOSHI, { chainId: base.id });

  useEffect(() => { void loadMetadata(typeof leafUriRead.data === "string" ? resolveIpfs(leafUriRead.data) : null, setLeafMetadata); }, [leafUriRead.data]);
  useEffect(() => { void loadSeedMetadata(typeof seedUriRead.data === "string" ? seedUriRead.data : null, setSeedMetadata); }, [seedUriRead.data]);

  const leafBalance = typeof leafBalanceRead.data === "bigint" ? leafBalanceRead.data : 0n;
  const seedBalance = typeof seedBalanceRead.data === "bigint" ? seedBalanceRead.data : 0n;
  const seedSupply = typeof seedSupplyRead.data === "bigint" ? seedSupplyRead.data : null;
  const leafArtwork = resolveIpfs(leafMetadata?.image);
  const seedArtwork = seedMetadata?.image || null;
  const seedUri = typeof seedUriRead.data === "string" ? resolveSeedUri(seedUriRead.data) : null;

  const assets = [
    { key: "toby" as const, symbol: "TOBY", label: "Pond token", icon: "/tokens/toby.PNG", value: tobyWallet.value ?? 0n, decimals: tobyWallet.decimals, standard: "ERC-20", address: TOBY },
    { key: "patience" as const, symbol: "PATIENCE", label: "Ancient flame", icon: "/tokens/patience.PNG", value: patienceWallet.value ?? 0n, decimals: patienceWallet.decimals, standard: "ERC-20", address: PATIENCE },
    { key: "taboshi" as const, symbol: "TABOSHI", label: "Awakened leaf", icon: "/tokens/taboshi.PNG", value: taboshiWallet.value ?? 0n, decimals: taboshiWallet.decimals, standard: "ERC-20", address: TABOSHI },
    { key: "leaf" as const, symbol: "TABOSHI 1", label: "Old leaf", icon: leafArtwork || "/tokens/taboshi.PNG", value: leafBalance, decimals: 0, standard: "ERC-1155", address: TABOSHI1_ADDRESS },
    { key: "seed" as const, symbol: "SEED", label: "New seed", icon: null, value: seedBalance, decimals: 0, standard: "ERC-1155", address: TABOSHI_SEEDS_ADDRESS },
  ];
  const selectedAsset = assets.find((a) => a.key === selected)!;
  const is1155 = selectedAsset.standard === "ERC-1155";
  const amountAtomic = useMemo(() => {
    try {
      if (!quantity.trim()) return 0n;
      if (is1155) return /^\d+$/.test(quantity.trim()) ? BigInt(quantity.trim()) : 0n;
      return parseUnits(quantity.trim(), selectedAsset.decimals);
    } catch { return 0n; }
  }, [quantity, is1155, selectedAsset.decimals]);
  const canSend = Boolean(address && isAddress(recipient) && amountAtomic > 0n && amountAtomic <= selectedAsset.value && txState !== "sending");

  useEffect(() => { setQuantity("1"); setMessage(""); setTxHash(null); setTxState("idle"); }, [selected]);

  async function refreshAll() { await Promise.all([leafBalanceRead.refetch(), seedBalanceRead.refetch(), tobyWallet.refetch(), patienceWallet.refetch(), taboshiWallet.refetch()]); }
  async function transfer() {
    if (!address || !canSend) return;
    setTxState("sending"); setMessage(""); setTxHash(null);
    try {
      if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
      let hash: `0x${string}`;
      if (selected === "seed") hash = await writeContractAsync({ address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "safeTransferFrom", args: [address, recipient as Address, TABOSHI_SEED_ID, amountAtomic, "0x"], chainId: base.id });
      else if (selected === "leaf") hash = await writeContractAsync({ address: TABOSHI1_ADDRESS, abi: TABOSHI1_ABI, functionName: "safeTransferFrom", args: [address, recipient as Address, TABOSHI1_TOKEN_ID, amountAtomic, "0x"], chainId: base.id });
      else hash = await writeContractAsync({ address: selectedAsset.address, abi: erc20Abi, functionName: "transfer", args: [recipient as Address, amountAtomic], chainId: base.id });
      setTxHash(hash); if (client) await client.waitForTransactionReceipt({ hash }); await refreshAll();
      setTxState("success"); setMessage(`${quantity} ${selectedAsset.symbol} sent.`); setRecipient(""); setQuantity("1");
    } catch (error) { setTxState("error"); setMessage(error instanceof Error ? error.message.split("\n")[0] : "Transfer was not completed."); }
  }

  return <MiniAppGate>
    <div className="taboshi1-page seeds-leaves-page mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
      <section className="taboshi1-hero seeds-leaves-hero">
        <div className="taboshi1-hero-copy"><span className="taboshi1-kicker">OLD LEAVES · NEW SEEDS · ONCHAIN</span><h1>Seeds &amp; Leaves</h1><p>Your Tobyworld pouch: see what this wallet carries, view the Seed artwork from its ERC-1155 metadata, and send any supported asset from one portal.</p><div className="taboshi1-hero-actions"><a href="#pouch" className="metal-button taboshi1-primary">Open my pouch</a><a href="#transfer" className="metal-button">Transfer portal ↓</a></div></div>
        <div className="taboshi1-hero-art" aria-hidden="true"><span className="taboshi1-orbit taboshi1-orbit-a"/><span className="taboshi1-orbit taboshi1-orbit-b"/><div className="taboshi1-relic-disc seeds-leaves-disc"><SeedArt image={seedArtwork} name={seedMetadata?.name}/></div><div className="taboshi1-frog"><Image src="/tokens/toby.PNG" alt="" fill sizes="120px" className="object-contain"/></div><span className="taboshi1-triangle"/></div>
      </section>

      <section id="pouch" className="seedleaf-dual-grid scroll-mt-24">
        <article className="taboshi1-card seedleaf-relic-card seedleaf-seed-card"><div className="taboshi1-card-head"><div><span className="taboshi1-kicker">NEW SEED · ERC-1155</span><h2>{seedMetadata?.name || "Taboshi Seeds"}</h2></div><span className="taboshi1-chain-chip"><i/>BASE</span></div><div className="taboshi1-showcase seedleaf-seed-showcase"><div className="taboshi1-token-art seedleaf-seed-art"><SeedArt image={seedArtwork} name={seedMetadata?.name}/></div><div className="taboshi1-balance seedleaf-seed-balance"><small>YOU HOLD</small><strong>{isConnected ? (seedBalanceRead.isLoading ? "…" : seedBalance.toLocaleString()) : "—"}</strong><span>SEED · Token #1</span></div></div><div className="taboshi1-onchain-facts"><div><span>MINTED</span><strong>{seedSupply === null ? "Onchain" : seedSupply.toLocaleString()}</strong></div><div><span>FAUCET</span><strong>{seedInitializedRead.data === true ? "BOUND" : "PENDING"}</strong></div><div><span>ID</span><strong>#1</strong></div><div><span>TYPE</span><strong>ERC-1155</strong></div></div><div className="taboshi1-contract-line"><span>FAUCET</span><code>{typeof seedFaucetRead.data === "string" ? shortAddress(seedFaucetRead.data) : "—"}</code><b>WRITE-ONCE</b></div><div className="taboshi1-link-row">{seedUri && <a href={seedUri} target="_blank" rel="noreferrer" className="metal-button">Metadata ↗</a>}<LinkMaybeMini href={TABOSHI_SEEDS_BASESCAN} className="metal-button">Onchain ↗</LinkMaybeMini></div></article>
        <article className="taboshi1-card seedleaf-relic-card"><div className="taboshi1-card-head"><div><span className="taboshi1-kicker">OLD LEAF · EARLY RELIC</span><h2>{leafMetadata?.name || "twpot #1"}</h2></div><span className="taboshi1-chain-chip"><i/>BASE</span></div><div className="taboshi1-showcase"><div className="taboshi1-token-art">{leafArtwork ? <img src={leafArtwork} alt={leafMetadata?.name || "twpot #1"} className="taboshi1-real-art"/> : <Image src="/tokens/taboshi.PNG" alt="Taboshi 1" fill sizes="220px" className="object-contain p-7"/>}</div><div className="taboshi1-balance"><small>YOU HOLD</small><strong>{isConnected ? leafBalance.toLocaleString() : "—"}</strong><span>Taboshi 1 · Token #1</span></div></div><div className="taboshi1-link-row"><LinkMaybeMini href={TABOSHI1_OPENSEA} className="metal-button taboshi1-trade">Market ↗</LinkMaybeMini></div></article>
      </section>

      {!isConnected ? <div className="taboshi1-connect seedleaf-connect"><p>Connect your Base wallet to reveal the pouch.</p><ConnectPill/></div> : <div className="taboshi1-owner seedleaf-owner"><span>Connected</span><strong>{shortAddress(address)}</strong><button onClick={refreshAll}>Refresh all</button></div>}

      <section className="seedleaf-all-assets"><div className="seedleaf-section-head"><div><span className="taboshi1-kicker">YOUR POND</span><h2>Everything in this wallet</h2><p>TOBY, PATIENCE, TABOSHI, the old leaf, and SEED—read directly from Base.</p></div><span className="seedleaf-asset-count">{isConnected ? "LIVE ON BASE" : "CONNECT TO VIEW"}</span></div><div className="seedleaf-assets-grid">{assets.map((asset) => <article key={asset.key} className={`seedleaf-asset-card ${selected === asset.key ? "is-selected" : ""}`} onClick={() => setSelected(asset.key)}><div className="seedleaf-asset-icon seedleaf-asset-image">{asset.key === "seed" ? <SeedArt image={seedArtwork} name="SEED"/> : <img src={asset.icon!} alt={asset.symbol}/>}</div><div className="seedleaf-asset-copy"><span>{asset.label} · {asset.standard.replace("ERC-", "")}</span><strong>{asset.symbol}</strong><b>{isConnected ? (asset.standard === "ERC-1155" ? asset.value.toLocaleString() : compact(asset.value, asset.decimals)) : "—"}</b></div></article>)}</div><div className="seedleaf-assets-note"><span className="seedleaf-note-dot"/>Tap any asset to load it into the transfer portal below.</div></section>

      <section id="transfer" className="taboshi1-card seedleaf-transfer-card scroll-mt-24"><div className="taboshi1-card-head"><div><span className="taboshi1-kicker">TRANSFER PORTAL</span><h2>Send any Tobyworld asset</h2></div><div className="taboshi1-send-orb">→</div></div><div className="seedleaf-portal-assets">{assets.map((asset) => <button key={asset.key} type="button" className={selected === asset.key ? "active" : ""} onClick={() => setSelected(asset.key)}><span className="seedleaf-portal-icon">{asset.key === "seed" ? <SeedArt image={seedArtwork} name="SEED"/> : <img src={asset.icon!} alt=""/>}</span><span><b>{asset.symbol}</b><small>{asset.standard}</small></span><strong>{isConnected ? (is1155 && selected === asset.key ? asset.value.toLocaleString() : asset.standard === "ERC-1155" ? asset.value.toLocaleString() : compact(asset.value, asset.decimals)) : "—"}</strong></button>)}</div><div className="seedleaf-transfer-summary"><span>SELECTED</span><strong>{selectedAsset.symbol}</strong><b>{is1155 ? "Whole units" : `${selectedAsset.decimals} decimals`}</b></div><div className="seedleaf-transfer-fields"><label className="taboshi1-label"><span>TO</span><input value={recipient} onChange={(e)=>setRecipient(e.target.value.trim())} placeholder="0x… wallet address" autoComplete="off" spellCheck={false}/></label><label className="taboshi1-label"><span>AMOUNT</span><div className="taboshi1-quantity-row"><input inputMode="decimal" value={quantity} onChange={(e)=>setQuantity(is1155 ? e.target.value.replace(/\D/g, "") : e.target.value.replace(/[^0-9.]/g, ""))}/><button type="button" onClick={()=>setQuantity(is1155 ? selectedAsset.value.toString() : formatUnits(selectedAsset.value, selectedAsset.decimals))} disabled={selectedAsset.value === 0n}>ALL</button></div></label></div><p className="taboshi1-card-copy">ERC-20 transfers call <b>transfer</b>. SEED and Taboshi 1 use ERC-1155 <b>safeTransferFrom</b>. No approval or custody is added by this portal.</p><button className="taboshi1-send-button" disabled={!canSend} onClick={transfer}><span>{txState === "sending" ? "Sending…" : !isConnected ? "Connect to send" : selectedAsset.value === 0n ? `No ${selectedAsset.symbol} found` : `Send ${selectedAsset.symbol}`}</span><b>→</b></button>{message && <div className={`taboshi1-message ${txState === "success" ? "is-success" : "is-error"}`}><strong>{txState === "success" ? "Transfer complete" : "Transfer not completed"}</strong><span>{message}</span>{txHash && <LinkMaybeMini href={`https://basescan.org/tx/${txHash}`}>View transaction ↗</LinkMaybeMini>}</div>}</section>

      <section className="taboshi1-lore-strip seeds-leaves-lore-strip"><div className="taboshi1-lore-frog"><Image src="/tokens/toby.PNG" alt="Toby" fill sizes="70px" className="object-contain"/></div><div><span className="taboshi1-kicker">FROM THE ARCHIVE</span><strong>Old leaves return. New seeds wake.</strong><p>The page stays simple: one pouch, one transfer portal, and live Base balances.</p></div><span className="taboshi1-lore-leaf"><Image src="/tokens/taboshi.PNG" alt="" fill sizes="64px" className="object-contain"/></span></section>
    </div><Footer/><PondDock active="swap"/>
  </MiniAppGate>;
}
