"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { erc20Abi, formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { base } from "viem/chains";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
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
import PondPulse from "@/components/PondPulse";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useUsdPrices } from "@/lib/prices";
import { TOBY, PATIENCE, TABOSHI } from "@/lib/addresses";
import {
  TABOSHI1_ADDRESS,
  TABOSHI1_TOKEN_ID,
  TABOSHI1_ABI,
  resolveIpfs,
} from "@/lib/taboshi1";
import {
  TABOSHI_SEEDS_ADDRESS,
  TABOSHI_SEED_ID,
  TABOSHI_SEEDS_ABI,
  seedImageCandidates,
} from "@/lib/taboshi-seeds";
import {
  LORE_COLLECTION_ADDRESS,
  LORE_DEEDS_ABI,
  LORE_INITIAL_SUPPLY,
} from "@/lib/lore-deeds";

type TxState = "idle" | "sending" | "success" | "error";
type AssetKind = "toby" | "patience" | "taboshi" | "leaf" | "seed" | "lore";
type Metadata = { name?: string; description?: string; image?: string };

function shortAddress(value?: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";
}

function compact(value?: bigint, decimals = 18) {
  if (value === undefined) return "…";
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function usd(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  if (value < 0.01) return `<$0.01`;
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });
}

function atomicUsdValue(value: bigint, decimals: number, price?: number) {
  if (!price || price <= 0) return undefined;
  const amount = Number(formatUnits(value, decimals));
  if (!Number.isFinite(amount)) return undefined;
  return amount * price;
}

async function loadMetadata(uri: string | null, setter: (v: Metadata | null) => void) {
  if (!uri) return;
  try {
    const response = await fetch(uri);
    if (!response.ok) return;
    const json = await response.json();
    setter(json && typeof json === "object" ? json : null);
  } catch {}
}

async function loadSeedMetadata(uri: string | null, setter: (v: Metadata | null) => void) {
  if (!uri) return;
  const candidates = seedImageCandidates(uri);
  for (const candidate of candidates.length ? candidates : [uri]) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) continue;
      const json = await response.json();
      if (json && typeof json === "object") {
        setter(json);
        return;
      }
    } catch {}
  }
}

function SeedArt({ image, name }: { image?: string | null; name?: string }) {
  const candidates = useMemo(() => seedImageCandidates(image), [image]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [image]);

  if (!candidates.length) {
    return (
      <div className="seedleaf-seed-fallback">
        <span>✦</span>
        <b>SEED</b>
      </div>
    );
  }

  return (
    <img
      src={candidates[Math.min(index, candidates.length - 1)]}
      alt={name || "Taboshi Seed"}
      className="taboshi1-real-art"
      onError={() => setIndex((current) => Math.min(current + 1, candidates.length - 1))}
    />
  );
}

function LoreDeedArt({ revealed }: { revealed?: boolean }) {
  return (
    <div className={`lore-deed-art ${revealed ? "is-revealed" : "is-veiled"}`} aria-label="Lore Land Deed">
      <span className="lore-deed-moon" />
      <span className="lore-deed-island" />
      <span className="lore-deed-rune">△</span>
      <span className="lore-deed-stars">✦ · ✦</span>
      <strong>{revealed ? "LORE" : "VEILED"}</strong>
      <small>{revealed ? "Deed awakened" : "Reveal coming soon"}</small>
    </div>
  );
}

export default function TaboshiOnePage() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: base.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const [selected, setSelected] = useState<AssetKind>("seed");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("1");
  const [loreTokenId, setLoreTokenId] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [message, setMessage] = useState("");
  const [syncingWallet, setSyncingWallet] = useState(false);
  const [refreshCooling, setRefreshCooling] = useState(false);
  const refreshCooldownRef = useRef<number | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [leafMetadata, setLeafMetadata] = useState<Metadata | null>(null);
  const [seedMetadata, setSeedMetadata] = useState<Metadata | null>(null);

  const leafBalanceRead = useReadContract({
    address: TABOSHI1_ADDRESS,
    abi: TABOSHI1_ABI,
    functionName: "balanceOf",
    args: address ? [address, TABOSHI1_TOKEN_ID] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), staleTime: 30_000, refetchInterval: false, refetchOnWindowFocus: false },
  });
  const leafUriRead = useReadContract({
    address: TABOSHI1_ADDRESS,
    abi: TABOSHI1_ABI,
    functionName: "uri",
    args: [TABOSHI1_TOKEN_ID],
    chainId: base.id,
  });
  const seedBalanceRead = useReadContract({
    address: TABOSHI_SEEDS_ADDRESS,
    abi: TABOSHI_SEEDS_ABI,
    functionName: "balanceOf",
    args: address ? [address, TABOSHI_SEED_ID] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), staleTime: 30_000, refetchInterval: false, refetchOnWindowFocus: false },
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
  const loreBalanceRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), staleTime: 30_000, refetchInterval: false, refetchOnWindowFocus: false },
  });
  const loreRevealedRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "revealed",
    chainId: base.id,
  });
  const loreMintedRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "totalMinted",
    chainId: base.id,
  });
  const loreCommunityMintedRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "communityMinted",
    chainId: base.id,
    query: { staleTime: 60_000, refetchInterval: false, refetchOnWindowFocus: false },
  });

  const tobyWallet = useTokenBalance(address, TOBY, { chainId: base.id });
  const patienceWallet = useTokenBalance(address, PATIENCE, { chainId: base.id });
  const taboshiWallet = useTokenBalance(address, TABOSHI, { chainId: base.id });
  const { prices: pondPrices } = useUsdPrices([TOBY, PATIENCE, TABOSHI]);
  const tobyUsd = pondPrices[TOBY.toLowerCase()];
  const patienceUsd = pondPrices[PATIENCE.toLowerCase()];
  const taboshiUsd = pondPrices[TABOSHI.toLowerCase()];

  useEffect(() => {
    void loadMetadata(
      typeof leafUriRead.data === "string" ? resolveIpfs(leafUriRead.data) : null,
      setLeafMetadata,
    );
  }, [leafUriRead.data]);

  useEffect(() => {
    void loadSeedMetadata(
      typeof seedUriRead.data === "string" ? seedUriRead.data : null,
      setSeedMetadata,
    );
  }, [seedUriRead.data]);

  const leafBalance = typeof leafBalanceRead.data === "bigint" ? leafBalanceRead.data : 0n;
  const seedBalance = typeof seedBalanceRead.data === "bigint" ? seedBalanceRead.data : 0n;
  const loreBalance = typeof loreBalanceRead.data === "bigint" ? loreBalanceRead.data : 0n;
  const seedSupply = typeof seedSupplyRead.data === "bigint" ? seedSupplyRead.data : null;
  const loreMinted = typeof loreMintedRead.data === "bigint" ? loreMintedRead.data : null;
  const loreCommunityMinted = typeof loreCommunityMintedRead.data === "bigint" ? loreCommunityMintedRead.data : null;
  const loreSupply = loreCommunityMinted === null ? loreMinted : LORE_INITIAL_SUPPLY + loreCommunityMinted;
  const loreRevealed = loreRevealedRead.data === true;
  const leafArtwork = resolveIpfs(leafMetadata?.image);
  const seedArtwork = seedMetadata?.image || null;

  const assets = [
    { key: "toby" as const, symbol: "TOBY", label: "Pond token", icon: "/tokens/toby.PNG", value: tobyWallet.value ?? 0n, decimals: tobyWallet.decimals, standard: "ERC-20", address: TOBY, usdPrice: tobyUsd },
    { key: "patience" as const, symbol: "PATIENCE", label: "Ancient flame", icon: "/tokens/patience.PNG", value: patienceWallet.value ?? 0n, decimals: patienceWallet.decimals, standard: "ERC-20", address: PATIENCE, usdPrice: patienceUsd },
    { key: "taboshi" as const, symbol: "TABOSHI", label: "Awakened leaf", icon: "/tokens/taboshi.PNG", value: taboshiWallet.value ?? 0n, decimals: taboshiWallet.decimals, standard: "ERC-20", address: TABOSHI, usdPrice: taboshiUsd },
    { key: "leaf" as const, symbol: "TABOSHI 1", label: "Old leaf", icon: leafArtwork || "/tokens/taboshi.PNG", value: leafBalance, decimals: 0, standard: "ERC-1155", address: TABOSHI1_ADDRESS, usdPrice: undefined },
    { key: "seed" as const, symbol: "SEED", label: "New seed", icon: null, value: seedBalance, decimals: 0, standard: "ERC-1155", address: TABOSHI_SEEDS_ADDRESS, usdPrice: undefined },
    { key: "lore" as const, symbol: "LORE DEED", label: "Veiled land", icon: null, value: loreBalance, decimals: 0, standard: "ERC-721", address: LORE_COLLECTION_ADDRESS, usdPrice: undefined },
  ];

  const selectedAsset = assets.find((asset) => asset.key === selected)!;
  const is1155 = selectedAsset.standard === "ERC-1155";
  const isLore = selected === "lore";

  const amountAtomic = useMemo(() => {
    if (isLore) return 1n;
    try {
      if (!amount.trim()) return 0n;
      if (is1155) return /^\d+$/.test(amount.trim()) ? BigInt(amount.trim()) : 0n;
      return parseUnits(amount.trim(), selectedAsset.decimals);
    } catch {
      return 0n;
    }
  }, [amount, is1155, isLore, selectedAsset.decimals]);

  const parsedLoreTokenId = useMemo(() => {
    try {
      return /^\d+$/.test(loreTokenId.trim()) ? BigInt(loreTokenId.trim()) : null;
    } catch {
      return null;
    }
  }, [loreTokenId]);

  function setTransferPercent(percent: 25 | 50 | 75 | 100) {
    if (isLore || selectedAsset.value <= 0n) return;
    const raw = percent === 100 ? selectedAsset.value : (selectedAsset.value * BigInt(percent)) / 100n;
    const adjusted = is1155 && raw === 0n ? 1n : raw;
    setAmount(is1155 ? adjusted.toString() : formatUnits(adjusted, selectedAsset.decimals));
  }

  const canSend = Boolean(
    address &&
      isAddress(recipient) &&
      txState !== "sending" &&
      (isLore
        ? loreBalance > 0n && parsedLoreTokenId !== null
        : amountAtomic > 0n && amountAtomic <= selectedAsset.value),
  );

  useEffect(() => {
    setAmount("1");
    setLoreTokenId("");
    setMessage("");
    setTxHash(null);
    setTxState("idle");
  }, [selected]);

  async function refreshAll() {
    await Promise.allSettled([
      leafBalanceRead.refetch(),
      leafUriRead.refetch(),
      seedBalanceRead.refetch(),
      seedUriRead.refetch(),
      seedSupplyRead.refetch(),
      loreBalanceRead.refetch(),
      loreRevealedRead.refetch(),
      loreMintedRead.refetch(),
      loreCommunityMintedRead.refetch(),
      tobyWallet.refetch(),
      patienceWallet.refetch(),
      taboshiWallet.refetch(),
    ]);
  }

  async function syncWalletAndHoldings() {
    if (syncingWallet || refreshCooling) return;
    setSyncingWallet(true);
    setRefreshCooling(true);
    setSyncMessage("Checking the wallet in the pond…");

    try {
      let providerAccounts: string[] = [];
      const activeConnector = connector || connectors[0];

      if (activeConnector) {
        try {
          const provider = await activeConnector.getProvider();
          if (provider && typeof (provider as any).request === "function") {
            const raw = await (provider as any).request({ method: "eth_accounts" });
            if (Array.isArray(raw)) providerAccounts = raw.filter((value): value is string => typeof value === "string");
          }
        } catch {}

        if (!providerAccounts.length) {
          try {
            const accounts = await activeConnector.getAccounts();
            providerAccounts = accounts.map(String);
          } catch {}
        }
      }

      const liveAddress = providerAccounts[0];
      const walletChanged = Boolean(liveAddress && address && liveAddress.toLowerCase() !== address.toLowerCase());

      if (activeConnector && (walletChanged || (!liveAddress && isConnected))) {
        setSyncMessage(walletChanged ? "New wallet found — reopening the pouch…" : "Reconnecting wallet…");
        try { await disconnectAsync({ connector: activeConnector }); } catch {}
        await new Promise((resolve) => setTimeout(resolve, 120));
        try { await connectAsync({ connector: activeConnector }); } catch {}
        // Query keys throughout the app are address-scoped. A clean reload after the
        // connector handshake guarantees no cached balance from the previous wallet survives.
        if (typeof window !== "undefined") {
          window.setTimeout(() => window.location.reload(), 120);
          return;
        }
      }

      await refreshAll();
      setSyncMessage("Pouch refreshed from Base.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tobyswap:wallet-data-refreshed", { detail: { address } }));
      }
    } catch {
      setSyncMessage("Could not refresh the pouch. Try Change wallet from the wallet menu.");
    } finally {
      setSyncingWallet(false);
      if (typeof window !== "undefined") {
        window.setTimeout(() => setSyncMessage(""), 3200);
        if (refreshCooldownRef.current) window.clearTimeout(refreshCooldownRef.current);
        refreshCooldownRef.current = window.setTimeout(() => setRefreshCooling(false), 12_000);
      } else {
        setRefreshCooling(false);
      }
    }
  }

  async function transfer() {
    if (!address || !canSend) return;
    setTxState("sending");
    setMessage("");
    setTxHash(null);

    try {
      if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
      let hash: `0x${string}`;

      if (selected === "lore") {
        if (parsedLoreTokenId === null || !client) throw new Error("Enter a Lore Deed token ID.");
        const owner = await client.readContract({
          address: LORE_COLLECTION_ADDRESS,
          abi: LORE_DEEDS_ABI,
          functionName: "ownerOf",
          args: [parsedLoreTokenId],
        });
        if (getAddress(owner) !== getAddress(address)) throw new Error(`This wallet does not own Lore Deed #${parsedLoreTokenId}.`);
        hash = await writeContractAsync({
          address: LORE_COLLECTION_ADDRESS,
          abi: LORE_DEEDS_ABI,
          functionName: "safeTransferFrom",
          args: [address, recipient as Address, parsedLoreTokenId],
          chainId: base.id,
        });
      } else if (selected === "seed") {
        hash = await writeContractAsync({ address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "safeTransferFrom", args: [address, recipient as Address, TABOSHI_SEED_ID, amountAtomic, "0x"], chainId: base.id });
      } else if (selected === "leaf") {
        hash = await writeContractAsync({ address: TABOSHI1_ADDRESS, abi: TABOSHI1_ABI, functionName: "safeTransferFrom", args: [address, recipient as Address, TABOSHI1_TOKEN_ID, amountAtomic, "0x"], chainId: base.id });
      } else {
        hash = await writeContractAsync({ address: selectedAsset.address, abi: erc20Abi, functionName: "transfer", args: [recipient as Address, amountAtomic], chainId: base.id });
      }

      setTxHash(hash);
      if (client) await client.waitForTransactionReceipt({ hash });
      await refreshAll();
      setTxState("success");
      setMessage(isLore ? `Lore Deed #${parsedLoreTokenId} sent.` : `${amount} ${selectedAsset.symbol} sent.`);
      setRecipient("");
      setAmount("1");
      setLoreTokenId("");
    } catch (error) {
      setTxState("error");
      setMessage(error instanceof Error ? error.message.split("\n")[0] : "Transfer was not completed.");
    }
  }

  return (
    <MiniAppGate>
      <div className="taboshi1-page seeds-leaves-page mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <section className="taboshi1-hero seeds-leaves-hero lore-pouch-hero">
          <div className="taboshi1-hero-copy">
            <span className="taboshi1-kicker">THE POND REMEMBERS</span>
            <h1>Seeds &amp; Leaves</h1>
            <p>Old leaves, new seeds, and veiled land. A quiet inventory of what your wallet carries through Tobyworld.</p>
            <div className="taboshi1-hero-actions">
              <a href="#pouch" className="metal-button taboshi1-primary">Open the pouch</a>
              <a href="#transfer" className="metal-button">Enter the portal ↓</a>
            </div>
          </div>
          <div className="taboshi1-hero-art" aria-hidden="true">
            <span className="taboshi1-orbit taboshi1-orbit-a" />
            <span className="taboshi1-orbit taboshi1-orbit-b" />
            <div className="taboshi1-relic-disc seeds-leaves-disc"><SeedArt image={seedArtwork} name={seedMetadata?.name} /></div>
            <div className="taboshi1-frog"><Image src="/tokens/toby.PNG" alt="" fill sizes="120px" className="object-contain" /></div>
            <span className="taboshi1-triangle" />
          </div>
        </section>

        <PondPulse />

        <section id="pouch" className="seedleaf-relic-triad scroll-mt-24">
          <article className="taboshi1-card seedleaf-relic-card seedleaf-seed-card lore-relic-panel">
            <div className="taboshi1-card-head"><div><span className="taboshi1-kicker">THE NEW SEED</span><h2>{seedMetadata?.name || "Taboshi Seeds"}</h2></div><span className="lore-soft-chip">AWAKE</span></div>
            <div className="taboshi1-showcase seedleaf-seed-showcase"><div className="taboshi1-token-art seedleaf-seed-art"><SeedArt image={seedArtwork} name={seedMetadata?.name} /></div><div className="taboshi1-balance seedleaf-seed-balance"><small>IN YOUR POUCH</small><strong>{isConnected ? (seedBalanceRead.isLoading ? "…" : seedBalance.toLocaleString()) : "—"}</strong><span>SEED · the faucet's draw</span></div></div>
            <div className="lore-whisper"><span>✦</span><p>New seeds wake when the faucet runs. Supply grows only through the bound Faucet.</p></div>
            <div className="lore-mini-stats"><span><small>DRAWN</small><b>{seedSupply === null ? "—" : seedSupply.toLocaleString()}</b></span><span><small>FORM</small><b>WHOLE SEED</b></span></div>
          </article>

          <article className="taboshi1-card seedleaf-relic-card lore-relic-panel">
            <div className="taboshi1-card-head"><div><span className="taboshi1-kicker">THE OLD LEAF</span><h2>{leafMetadata?.name || "twpot #1"}</h2></div><span className="lore-soft-chip green">RETURNED</span></div>
            <div className="taboshi1-showcase"><div className="taboshi1-token-art">{leafArtwork ? <img src={leafArtwork} alt={leafMetadata?.name || "twpot #1"} className="taboshi1-real-art" /> : <Image src="/tokens/taboshi.PNG" alt="Taboshi 1" fill sizes="220px" className="object-contain p-7" />}</div><div className="taboshi1-balance"><small>IN YOUR POUCH</small><strong>{isConnected ? leafBalance.toLocaleString() : "—"}</strong><span>Taboshi 1 · early leaf</span></div></div>
            <div className="lore-whisper green"><span>◌</span><p>Before the seed, there was the leaf. An early relic carried forward from the first pond.</p></div>
          </article>

          <article className="taboshi1-card seedleaf-relic-card lore-deed-card lore-relic-panel">
            <div className="taboshi1-card-head"><div><span className="taboshi1-kicker">THE VEILED LAND</span><h2>Lore Land Deeds</h2></div><span className={`lore-soft-chip purple ${loreRevealed ? "is-live" : ""}`}>{loreRevealed ? "REVEALED" : "VEILED"}</span></div>
            <div className="taboshi1-showcase lore-deed-showcase"><div className="taboshi1-token-art lore-deed-token"><LoreDeedArt revealed={loreRevealed} /></div><div className="taboshi1-balance lore-deed-balance"><small>DEEDS HELD</small><strong>{isConnected ? loreBalance.toLocaleString() : "—"}</strong><span>{loreRevealed ? "Lore · awakened land" : "Lore · reveal coming soon"}</span></div></div>
            <div className="lore-whisper purple"><span>△</span><p>{loreRevealed ? "The veil has lifted. Your deed remains the key to the land it carries." : "The deed exists before the landscape is known. The land waits behind the veil."}</p></div>
            <div className="lore-mini-stats"><span><small>COMMUNITY</small><b>{loreCommunityMinted === null ? "—" : loreCommunityMinted.toLocaleString()}</b></span><span><small>SUPPLY</small><b>{loreSupply === null ? "—" : loreSupply.toLocaleString()}</b></span></div>
          </article>
        </section>

        {!isConnected ? (
          <div className="taboshi1-connect seedleaf-connect lore-connect-card"><div><span className="taboshi1-kicker">YOUR POUCH IS CLOSED</span><p>Connect a Base wallet to see what has followed you through the pond.</p></div><ConnectPill /></div>
        ) : (
          <>
            <div className="taboshi1-owner seedleaf-owner seedleaf-wallet-sync-row">
              <div className="seedleaf-wallet-sync-copy"><span>Wallet in the pond</span><strong>{shortAddress(address)}</strong></div>
              <button type="button" className="seedleaf-sync-button" onClick={syncWalletAndHoldings} disabled={syncingWallet || refreshCooling} aria-busy={syncingWallet}>
                <span className={syncingWallet ? "seedleaf-sync-icon is-spinning" : "seedleaf-sync-icon"}>↻</span>
                {syncingWallet ? "Syncing…" : refreshCooling ? "Updated" : "Refresh wallet"}
              </button>
            </div>
            {syncMessage && <div className="seedleaf-sync-message" role="status">{syncMessage}</div>}
          </>
        )}

        <section className="seedleaf-all-assets lore-inventory-card">
          <div className="seedleaf-section-head"><div><span className="taboshi1-kicker">WHAT YOU CARRY</span><h2>Your Tobyworld pouch</h2><p>Tokens, relics, and deeds gathered into one view.</p></div>{isConnected ? (
              <button type="button" className="seedleaf-pouch-refresh" onClick={syncWalletAndHoldings} disabled={syncingWallet || refreshCooling} aria-label="Refresh wallet and pouch balances">
                <span className={syncingWallet ? "is-spinning" : ""}>↻</span>{syncingWallet ? "SYNCING" : refreshCooling ? "UPDATED" : "REFRESH"}
              </button>
            ) : <span className="seedleaf-asset-count">CLOSED</span>}</div>
          <div className="seedleaf-assets-grid lore-assets-grid">
            {assets.map((asset) => (
              <button
                key={asset.key}
                type="button"
                className={`seedleaf-asset-card ${selected === asset.key ? "is-selected" : ""} ${asset.key === "lore" ? "is-lore" : ""}`}
                onClick={() => setSelected(asset.key)}
                aria-pressed={selected === asset.key}
                aria-label={`Select ${asset.symbol} for transfer`}
              >
                <div className="seedleaf-asset-icon seedleaf-asset-image">
                  {asset.key === "seed" ? <SeedArt image={seedArtwork} name="SEED" /> : asset.key === "lore" ? <LoreDeedArt revealed={loreRevealed} /> : <img src={asset.icon!} alt={asset.symbol} />}
                </div>
                <div className="seedleaf-asset-copy">
                  <span>{asset.label}</span>
                  <strong>{asset.symbol}</strong>
                  <b>{isConnected ? (asset.standard === "ERC-20" ? compact(asset.value, asset.decimals) : asset.value.toLocaleString()) : "—"}</b>
                  <em className="seedleaf-usd-value">
                    {!isConnected ? "USD VALUE" : asset.standard === "ERC-20" ? usd(atomicUsdValue(asset.value, asset.decimals, asset.usdPrice)) : "UNPRICED RELIC"}
                  </em>
                </div>
                <span className="seedleaf-selected-mark" aria-hidden="true">✓</span>
              </button>
            ))}
          </div>
          <div className="seedleaf-assets-note"><span className="seedleaf-note-dot" />Tap anything you carry to move it through the transfer portal.</div>
        </section>

        <section id="transfer" className="taboshi1-card seedleaf-transfer-card lore-transfer-card scroll-mt-24">
          <div className="taboshi1-card-head"><div><span className="taboshi1-kicker">PASS IT FORWARD</span><h2>Transfer portal</h2><p className="lore-transfer-intro">Your pouch above chooses what moves through the portal.</p></div><div className="taboshi1-send-orb">→</div></div>
          <div className="seedleaf-transfer-summary seedleaf-transfer-summary-polished">
            <span>SELECTED FROM POUCH</span>
            <strong>{selectedAsset.symbol}</strong>
            <b>{isConnected ? `${selectedAsset.standard === "ERC-20" ? compact(selectedAsset.value, selectedAsset.decimals) : selectedAsset.value.toLocaleString()} available` : "Connect wallet"}</b>
            {isConnected && selectedAsset.standard === "ERC-20" && (
              <em>{usd(atomicUsdValue(selectedAsset.value, selectedAsset.decimals, selectedAsset.usdPrice))} wallet value</em>
            )}
          </div>
          <div className="seedleaf-transfer-fields">
            <label className="taboshi1-label"><span>DESTINATION</span><input value={recipient} onChange={(event) => setRecipient(event.target.value.trim())} placeholder="0x… wallet address" autoComplete="off" spellCheck={false} /></label>
            {isLore ? (
              <label className="taboshi1-label"><span>DEED TOKEN ID</span><input inputMode="numeric" value={loreTokenId} onChange={(event) => setLoreTokenId(event.target.value.replace(/\D/g, ""))} placeholder="e.g. 1017" /></label>
            ) : (
              <label className="taboshi1-label">
                <span>AMOUNT</span>
                <input inputMode="decimal" value={amount} onChange={(event) => setAmount(is1155 ? event.target.value.replace(/\D/g, "") : event.target.value.replace(/[^0-9.]/g, ""))} />
                <div className="seedleaf-quick-selects" aria-label="Quick amount selection">
                  {[25, 50, 75, 100].map((percent) => (
                    <button key={percent} type="button" onClick={() => setTransferPercent(percent as 25 | 50 | 75 | 100)} disabled={selectedAsset.value === 0n}>
                      {percent === 100 ? "MAX" : `${percent}%`}
                    </button>
                  ))}
                </div>
              </label>
            )}
          </div>
          <p className="taboshi1-card-copy lore-transfer-note">{isLore ? "Enter a deed ID you own; ownership is checked before transfer." : selectedAsset.standard === "ERC-1155" ? "Relics move in whole units." : "Sent directly from your connected wallet on Base."}</p>
          <button className="taboshi1-send-button" disabled={!canSend} onClick={transfer}><span>{txState === "sending" ? "Sending…" : !isConnected ? "Connect to send" : selectedAsset.value === 0n ? `Nothing to send yet` : isLore ? `Send Lore Deed` : `Send ${selectedAsset.symbol}`}</span><b>→</b></button>
          {message && <div className={`taboshi1-message ${txState === "success" ? "is-success" : "is-error"}`}><strong>{txState === "success" ? "Passed through the portal" : "The portal stayed closed"}</strong><span>{message}</span>{txHash && <LinkMaybeMini href={`https://basescan.org/tx/${txHash}`}>View transaction ↗</LinkMaybeMini>}</div>}
        </section>

        <section className="taboshi1-lore-strip seeds-leaves-lore-strip lore-final-whisper"><div className="taboshi1-lore-frog"><Image src="/tokens/toby.PNG" alt="Toby" fill sizes="70px" className="object-contain" /></div><div><span className="taboshi1-kicker">FROM THE WATERLINE</span><strong>Old leaves return. New seeds wake. The land waits.</strong><p>Some things arrive before their meaning does.</p></div><span className="taboshi1-lore-leaf"><Image src="/tokens/taboshi.PNG" alt="" fill sizes="64px" className="object-contain" /></span></section>
      </div>
      <Footer />
      <PondDock active="swap" />
    </MiniAppGate>
  );
}
