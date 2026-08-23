"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import MyLoreDeeds from "@/components/land/MyLoreDeeds";
import WalletAssetViewer from "@/components/pouch/WalletAssetViewer";
import PublicPouchCreator from "@/components/pouch/PublicPouchCreator";
import TobyworldIcon from "@/components/TobyworldIcon";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useUsdPrices } from "@/lib/prices";
import { TOBY, PATIENCE, TABOSHI, CBBTC } from "@/lib/addresses";
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
  LEGACY_LORE_DEED_ADDRESS,
  LEGACY_LORE_DEED_ABI,
} from "@/lib/lore-deeds";

type TxState = "idle" | "sending" | "success" | "error";
type AssetKind = "toby" | "patience" | "taboshi" | "cbbtc" | "leaf" | "seed" | "lore";
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

function SeedArt({ name }: { image?: string | null; name?: string }) {
  return (
    <Image
      src="/seed.png"
      alt={name || "Taboshi Seed"}
      fill
      sizes="(max-width: 680px) 180px, 220px"
      className="taboshi1-real-art object-cover"
    />
  );
}


function PondGlyph({ kind }: { kind: "swap" | "pouch" | "land" | "world" | "route" | "signal" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="mytw-glyph">
    {kind === "swap" && <><path {...common} d="M4 8h13m0 0-3-3m3 3-3 3"/><path {...common} d="M20 16H7m0 0 3-3m-3 3 3 3"/></>}
    {kind === "pouch" && <><circle {...common} cx="12" cy="12" r="7.5"/><path {...common} d="M8.5 8.5c2-2 5-2 7 0M8 15.5c2.4 1.8 5.6 1.8 8 0"/></>}
    {kind === "land" && <><path {...common} d="m12 4 7 15H5L12 4Z"/><path {...common} d="M9 15h6"/></>}
    {kind === "world" && <><circle {...common} cx="12" cy="12" r="8"/><path {...common} d="M4 12h16M12 4c2.6 2.5 3.8 5.2 3.8 8S14.6 17.5 12 20M12 4C9.4 6.5 8.2 9.2 8.2 12s1.2 5.5 3.8 8"/></>}
    {kind === "route" && <><path {...common} d="M5 17c2.5-7 6-9 14-10"/><circle cx="5" cy="17" r="2" fill="currentColor"/><circle cx="19" cy="7" r="2" fill="currentColor"/></>}
    {kind === "signal" && <><circle {...common} cx="12" cy="12" r="2.5"/><path {...common} d="M7.7 7.7a6 6 0 0 0 0 8.6M16.3 7.7a6 6 0 0 1 0 8.6M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/></>}
  </svg>;
}


function LoreDeedArt({ revealed }: { revealed?: boolean }) {
  return (
    <div className={`lore-deed-token-art ${revealed ? "is-revealed" : "is-veiled"}`} aria-label="Lore Land Deed">
      <TobyworldIcon kind="lore" size={84} />
      <span>{revealed ? "CANONICAL LORE DEED" : "LORE DEED"}</span>
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
  const [visitDeedId, setVisitDeedId] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [message, setMessage] = useState("");
  const [syncingWallet, setSyncingWallet] = useState(false);
  const [reconnectingWallet, setReconnectingWallet] = useState(false);
  const [refreshCooling, setRefreshCooling] = useState(false);
  const refreshCooldownRef = useRef<number | null>(null);
  const refreshLockUntilRef = useRef(0);
  const autoRefreshKeyRef = useRef("");
  const [syncMessage, setSyncMessage] = useState("");
  const [leafMetadata, setLeafMetadata] = useState<Metadata | null>(null);
  const [seedMetadata, setSeedMetadata] = useState<Metadata | null>(null);
  const [watchInput, setWatchInput] = useState("");
  const [watchAddress, setWatchAddress] = useState<Address | null>(null);
  const [watchError, setWatchError] = useState("");

  const leafBalanceRead = useReadContract({
    address: TABOSHI1_ADDRESS,
    abi: TABOSHI1_ABI,
    functionName: "balanceOf",
    args: address ? [address, TABOSHI1_TOKEN_ID] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), staleTime: 15_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: true, refetchOnMount: "always" },
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
    query: { enabled: Boolean(address), staleTime: 15_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: true, refetchOnMount: "always" },
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
    query: { enabled: Boolean(address), staleTime: 15_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: true, refetchOnMount: "always" },
  });
  const loreRevealedRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "revealed",
    chainId: base.id,
    query: { staleTime: 15_000, refetchInterval: false, refetchOnWindowFocus: true, refetchOnReconnect: true, refetchOnMount: "always", retry: 1 },
  });
  const legacyLoreBalanceRead = useReadContract({
    address: LEGACY_LORE_DEED_ADDRESS,
    abi: LEGACY_LORE_DEED_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), staleTime: 60_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: true, refetchOnMount: "always", retry: false },
  });

  const tobyWallet = useTokenBalance(address, TOBY, { chainId: base.id });
  const patienceWallet = useTokenBalance(address, PATIENCE, { chainId: base.id });
  const taboshiWallet = useTokenBalance(address, TABOSHI, { chainId: base.id });
  const cbbtcWallet = useTokenBalance(address, CBBTC, { chainId: base.id });
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
  const legacyLoreBalance = typeof legacyLoreBalanceRead.data === "bigint" ? legacyLoreBalanceRead.data : 0n;
  const seedSupply = typeof seedSupplyRead.data === "bigint" ? seedSupplyRead.data : null;
  const loreRevealed = loreRevealedRead.data === true;
  const leafArtwork = resolveIpfs(leafMetadata?.image);

  const assets = [
    { key: "toby" as const, symbol: "TOBY", label: "Pond token", icon: "/tokens/toby.PNG", value: tobyWallet.value ?? 0n, decimals: tobyWallet.decimals, standard: "ERC-20", address: TOBY, usdPrice: tobyUsd },
    { key: "patience" as const, symbol: "PATIENCE", label: "Ancient flame", icon: "/tokens/patience.PNG", value: patienceWallet.value ?? 0n, decimals: patienceWallet.decimals, standard: "ERC-20", address: PATIENCE, usdPrice: patienceUsd },
    { key: "taboshi" as const, symbol: "TABOSHI", label: "Awakened leaf", icon: "/tokens/taboshi.PNG", value: taboshiWallet.value ?? 0n, decimals: taboshiWallet.decimals, standard: "ERC-20", address: TABOSHI, usdPrice: taboshiUsd },
    { key: "cbbtc" as const, symbol: "cbBTC", label: "Bitcoin on Base", icon: "/tokens/cbbtc.svg", value: cbbtcWallet.value ?? 0n, decimals: cbbtcWallet.decimals, standard: "ERC-20", address: CBBTC, usdPrice: undefined },
    { key: "leaf" as const, symbol: "TABOSHI 1", label: "Old leaf", icon: leafArtwork || "/tokens/taboshi.PNG", value: leafBalance, decimals: 0, standard: "ERC-1155", address: TABOSHI1_ADDRESS, usdPrice: undefined },
    { key: "seed" as const, symbol: "SEED", label: "New seed", icon: null, value: seedBalance, decimals: 0, standard: "ERC-1155", address: TABOSHI_SEEDS_ADDRESS, usdPrice: undefined },
    { key: "lore" as const, symbol: "LORE DEED", label: "Lore land", icon: null, value: loreBalance, decimals: 0, standard: "ERC-721", address: LORE_COLLECTION_ADDRESS, usdPrice: undefined },
  ];

  const holdingFlags = {
    toby: (tobyWallet.value ?? 0n) > 0n,
    patience: (patienceWallet.value ?? 0n) > 0n,
    taboshi: (taboshiWallet.value ?? 0n) > 0n,
    leaf: leafBalance > 0n,
    seed: seedBalance > 0n,
    lore: loreBalance > 0n,
    legacyLore: legacyLoreBalance > 0n,
  };

  const foundSignals = Object.values(holdingFlags).filter(Boolean).length;

  const discoveryLine = !isConnected
    ? "Connect a Base wallet to see your land and pouch."
    : holdingFlags.lore
      ? "Your Lore Deed anchors a place in Tobyworld."
      : holdingFlags.leaf
        ? "An Old Leaf is remembered in your pouch."
        : holdingFlags.seed
          ? "SEED is present in your pouch."
          : foundSignals > 0
            ? "The pond recognizes assets you carry."
            : "This wallet is quiet in Tobyworld for now.";

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
      Promise.resolve(cbbtcWallet.refetch()),
      legacyLoreBalanceRead.refetch(),
      tobyWallet.refetch(),
      patienceWallet.refetch(),
      taboshiWallet.refetch(),
    ]);
  }


  // Base App can keep the connector alive across navigation while cached reads
  // remain empty. On each fresh visit to My Tobyworld, do one quiet direct Base
  // refresh for the connected wallet. Session storage prevents route-bouncing
  // from creating a request loop.
  useEffect(() => {
    if (!isConnected || !address) return;

    const key = `tobyswap:pouch-auto-refresh:${address.toLowerCase()}`;
    const now = Date.now();

    try {
      const previous = Number(window.sessionStorage.getItem(key) || "0");
      if (now - previous < 8_000) return;
      window.sessionStorage.setItem(key, String(now));
    } catch {}

    const runKey = `${address.toLowerCase()}:${now}`;
    if (autoRefreshKeyRef.current === runKey) return;
    autoRefreshKeyRef.current = runKey;

    const timer = window.setTimeout(() => {
      void refreshAll().then(() => {
        window.dispatchEvent(
          new CustomEvent("tobyswap:wallet-data-refreshed", {
            detail: { address, at: Date.now(), automatic: true },
          }),
        );
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [address, isConnected]);

  function openReadOnlyPouch() {
    const candidate = watchInput.trim();
    if (!isAddress(candidate)) {
      setWatchError("Enter a valid 0x Base wallet address.");
      return;
    }

    const normalized = getAddress(candidate);
    setWatchAddress(normalized);
    setWatchInput(normalized);
    setWatchError("");

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("wallet", normalized);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }

  function closeReadOnlyPouch() {
    setWatchAddress(null);
    setWatchError("");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("wallet");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }

  useEffect(() => {
    try {
      const value = new URL(window.location.href).searchParams.get("wallet");
      if (value && isAddress(value)) {
        const normalized = getAddress(value);
        setWatchAddress(normalized);
        setWatchInput(normalized);
      }
    } catch {}
  }, []);

  async function reconnectWalletSession() {
    if (reconnectingWallet) return;
    setReconnectingWallet(true);
    setSyncMessage("Reconnecting to the Base wallet…");

    const target = connector || connectors.find((item) =>
      String(item.id).toLowerCase().includes("coinbase") ||
      String(item.name || "").toLowerCase().includes("coinbase") ||
      String(item.id).toLowerCase().includes("injected")
    ) || connectors[0];

    try {
      if (connector) {
        try { await disconnectAsync({ connector }); } catch {}
      } else {
        try { await disconnectAsync(); } catch {}
      }
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (!target) throw new Error("No wallet connector is available.");
      await connectAsync({ connector: target });
      setSyncMessage("Wallet reconnected. Refreshing your pouch…");
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      await refreshAll();
      window.dispatchEvent(new CustomEvent("tobyswap:wallet-data-refreshed", { detail: { at: Date.now(), reconnect: true } }));
      setSyncMessage("Wallet reconnected ✓");
    } catch (error: any) {
      const text = String(error?.shortMessage || error?.message || "");
      setSyncMessage(/reject|denied|cancel/i.test(text) ? "Wallet reconnect was cancelled." : "Reconnect did not finish. Tap Connect and choose your Base wallet.");
    } finally {
      setReconnectingWallet(false);
      window.setTimeout(() => setSyncMessage(""), 3500);
    }
  }

  async function syncWalletAndHoldings() {
    const now = Date.now();
    if (syncingWallet || refreshCooling || now < refreshLockUntilRef.current) return;

    // Immediate ref lock prevents rapid taps before React commits disabled state.
    refreshLockUntilRef.current = now + 12_000;
    setSyncingWallet(true);
    setRefreshCooling(true);
    setSyncMessage("Refreshing your pouch…");

    try {
      // Do not disconnect/reconnect inside Base App just to refresh balances.
      // Embedded smart-wallet connectors can remain connected while their cached
      // query state is stale. A direct refetch is safer and much less disruptive.
      await refreshAll();

      setSyncMessage("Pouch refreshed.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tobyswap:wallet-data-refreshed", {
            detail: { address, at: Date.now() },
          }),
        );
      }
    } catch {
      setSyncMessage("Refresh did not finish. Try again in a few seconds.");
    } finally {
      setSyncingWallet(false);
      if (typeof window !== "undefined") {
        window.setTimeout(() => setSyncMessage(""), 3200);
        if (refreshCooldownRef.current) {
          window.clearTimeout(refreshCooldownRef.current);
        }
        refreshCooldownRef.current = window.setTimeout(
          () => setRefreshCooling(false),
          12_000,
        );
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
        <section className="taboshi1-hero seeds-leaves-hero lore-pouch-hero mytw-hero">
          <div className="taboshi1-hero-copy">
            <span className="taboshi1-kicker">YOUR PLACE IN TOBYWORLD</span>
            <h1>My Tobyworld</h1>
            <p>Your land comes first. Your pouch supports it. Explore your places, Keeper Mark, public world and onchain assets without repeating the same inventory everywhere.</p>
            <div className="taboshi1-hero-actions">
              <a href="#land" className="metal-button taboshi1-primary">Open my land</a>
              <a href="#pouch" className="metal-button">Open my pouch ↓</a>
            </div>
          </div>
          <div className="taboshi1-hero-art mytw-hero-art" aria-hidden="true">
            <span className="taboshi1-orbit taboshi1-orbit-a" />
            <span className="taboshi1-orbit taboshi1-orbit-b" />
            <div className="taboshi1-relic-disc seeds-leaves-disc"><SeedArt name={seedMetadata?.name} /></div>
            <div className="taboshi1-frog"><Image src="/tokens/toby.PNG" alt="" fill sizes="120px" className="object-contain" /></div>
            <span className="taboshi1-triangle" />
          </div>
        </section>

        <nav className="mytw-world-nav mytw-world-nav-refined" aria-label="My Tobyworld sections">
          <a href="#land"><TobyworldIcon kind="lore" size={32} /><b>LAND</b><small>Your place</small></a>
          <a href="#pouch"><TobyworldIcon kind="pouch" size={32} /><b>POUCH</b><small>What you carry</small></a>
          <Link prefetch={false} href="/world"><TobyworldIcon kind="sato" size={32} /><b>WORLD</b><small>Visit & explore</small></Link>
          <Link prefetch={false} href="/#swap"><TobyworldIcon kind="patience" size={32} /><b>POND</b><small>Swap utility</small></Link>
        </nav>

        <section className="mytw-profile-card mytw-place-card" aria-label="Your Tobyworld overview">
          <div className="mytw-place-head">
            <span className="mytw-place-sigil"><TobyworldIcon kind="lore" size={56} /></span>
            <div>
              <span className="taboshi1-kicker">YOUR TOBYWORLD</span>
              <h2>{isConnected ? "Your place, without the clutter." : "Find your place in Tobyworld"}</h2>
              <p>{discoveryLine}</p>
            </div>
          </div>
          <div className="mytw-place-metrics">
            <span><small>LORE LANDS</small><b>{isConnected ? loreBalance.toLocaleString() : "—"}</b></span>
            <span><small>POUCH SIGNALS</small><b>{isConnected ? foundSignals.toLocaleString() : "—"}</b></span>
            <span><small>WORLD</small><b>2,869</b></span>
          </div>
          <div className="mytw-place-actions">
            <Link prefetch={false} href="/world"><strong>Explore World</strong><small>Atlas · signs · wander</small><b>→</b></Link>
            <Link prefetch={false} href="/keepers"><strong>Meet Keepers</strong><small>Identity · stories · legacy</small><b>→</b></Link>
            <Link prefetch={false} href="/#swap" className="is-pond-utility"><span><PondGlyph kind="swap" /></span><div><strong>Pond Utility</strong><small>Swap when you need it</small></div><b>→</b></Link>
          </div>
        </section>

        <section id="next-path" className="mytw-action-grid mytw-action-grid-single scroll-mt-24">
          <article id="land" className="mytw-action-card mytw-land-card scroll-mt-24">
            <div className="mytw-action-head"><span className="mytw-action-icon"><LoreDeedArt revealed /></span><div><small>YOUR LAND</small><h2>{loreBalance > 0n ? `${loreBalance.toLocaleString()} Lore Deed${loreBalance === 1n ? "" : "s"}` : "The land waits"}</h2></div></div>
            <p>{loreBalance > 0n ? "Your deed anchors a public place in Tobyworld. Visit it, write your Keeper Mark, and see what the deed itself carries." : "You do not carry a Lore Deed in this wallet yet. The World is still open to explore."}</p>
            <div className="mytw-land-stats"><span><small>COLLECTION</small><b>CANONICAL</b></span><span><small>DEEDS HELD</small><b>{isConnected ? loreBalance.toLocaleString() : "—"}</b></span></div>
            <MyLoreDeeds owner={address} expectedCount={loreBalance} revealed={loreRevealed} />
            <div className="mytw-land-quicklinks">
              <Link prefetch={false} href="/world">Explore World</Link>
              <Link prefetch={false} href="/keepers">Meet Keepers</Link>
              <Link prefetch={false} href="/world/exchange">Tobyworld Market <small>live</small></Link>
              <a href="#wallet-viewer" className="mytw-manual-wallet-link">View a wallet manually <small>no connect</small></a>
            </div>
            <div className="mytw-land-engine-launch">
              <label><span>VISIT A DEED</span><input inputMode="numeric" value={visitDeedId} onChange={(event) => setVisitDeedId(event.target.value.replace(/\D/g, ""))} placeholder="e.g. 742" /></label>
              <a className={`mytw-inline-action ${!visitDeedId ? "is-disabled" : ""}`} href={visitDeedId ? `/land/${visitDeedId}` : undefined} aria-disabled={!visitDeedId}>Visit Land →</a>
            </div>
            <button type="button" className="mytw-secondary-land-action" disabled={loreBalance === 0n} onClick={() => { setSelected("lore"); document.getElementById("transfer")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              {loreBalance > 0n ? "Move one of my deeds" : "No deed in this wallet yet"}
            </button>
          </article>
        </section>

        <section className="mytw-pouch-bridge">
          <div><span className="taboshi1-kicker">ONE POUCH · ONE INVENTORY</span><h2>Your assets appear once, where they are useful.</h2><p>The duplicate Seed, Leaf and token showcases have been removed. Your live balances now live in the Pouch below, where you can select and transfer them.</p></div>
          <a href="#pouch">Open my pouch ↓</a>
        </section>

        <section id="wallet-viewer" className="watch-pouch-card scroll-mt-24">
          <div className="watch-pouch-copy">
            <span className="taboshi1-kicker">EXPLORE A WALLET</span>
            <h2>View any Tobyworld pouch</h2>
            <p>
              No connection needed. Enter a public Base address to see its Tobyworld assets
              and canonical Lore Deeds in read-only mode.
            </p>
          </div>
          <div className="watch-pouch-form">
            <input
              value={watchInput}
              onChange={(event) => {
                setWatchInput(event.target.value.trim());
                if (watchError) setWatchError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") openReadOnlyPouch();
              }}
              placeholder="0x… wallet address"
              autoComplete="off"
              spellCheck={false}
              aria-label="Wallet address to view"
            />
            <button type="button" onClick={openReadOnlyPouch}>View pouch</button>
          </div>
          {watchError ? <div className="watch-pouch-error">{watchError}</div> : null}
          <small className="watch-pouch-privacy">Public onchain data only · no signature · no wallet permissions</small>
        </section>

        {watchAddress ? (
          <WalletAssetViewer owner={watchAddress} onClose={closeReadOnlyPouch} />
        ) : null}

        {!isConnected ? (
          <div className="taboshi1-connect seedleaf-connect lore-connect-card"><div><span className="taboshi1-kicker">YOUR WORLD IS QUIET</span><p>Connect a Base wallet to assemble your Tobyworld profile.</p></div><ConnectPill /></div>
        ) : (
          <>
            <div className="taboshi1-owner seedleaf-owner seedleaf-wallet-sync-row">
              <div className="seedleaf-wallet-sync-copy"><span>Wallet in the pond</span><strong>{shortAddress(address)}</strong></div>
              <div className="seedleaf-wallet-session-actions">
                <button type="button" className="seedleaf-sync-button" onClick={syncWalletAndHoldings} disabled={syncingWallet || refreshCooling || reconnectingWallet} aria-busy={syncingWallet}>
                  <span className={syncingWallet ? "seedleaf-sync-icon is-spinning" : "seedleaf-sync-icon"}>↻</span>
                  {syncingWallet ? "Refreshing…" : refreshCooling ? "Refreshed" : "Refresh pouch"}
                </button>
                <button type="button" className="seedleaf-reconnect-button" onClick={reconnectWalletSession} disabled={reconnectingWallet || syncingWallet}>
                  {reconnectingWallet ? "Reconnecting…" : "Reconnect wallet"}
                </button>
              </div>
            </div>
            {syncMessage && <div className="seedleaf-sync-message" role="status">{syncMessage}</div>}
            {address ? (
              <PublicPouchCreator walletAddress={address} compact />
            ) : null}
          </>
        )}

        <details className="mytw-ambient-details">
          <summary>
            <span className="mytw-ambient-icon"><TobyworldIcon kind="sato" size={40} /></span>
            <div><span className="taboshi1-kicker">POND ACTIVITY</span><strong>See what is moving through Tobyworld</strong><small>A wider pond view, kept secondary to your own land and pouch.</small></div>
            <b>⌄</b>
          </summary>
          <div className="mytw-ambient-body"><PondPulse /></div>
        </details>

        <section className="mytw-pouch-transfer-shell" aria-label="Pouch and transfer tools">
          <div className="mytw-pouch-transfer-intro">
            <div>
              <span className="taboshi1-kicker">POUCH TO PORTAL</span>
              <h2>Carry it. Choose it. Move it.</h2>
              <p>Your Pouch selects the asset. The Transfer Portal handles the destination.</p>
            </div>
            <a href="#wallet-viewer">View another wallet <small>without connecting</small></a>
          </div>

          <div className="mytw-pouch-transfer-grid">
            <section id="pouch" className="seedleaf-all-assets lore-inventory-card scroll-mt-24">
            <div className="seedleaf-section-head"><div><span className="taboshi1-kicker">YOUR POUCH</span><h2>Everything you carry</h2><p>Choose an asset here to move it through the transfer portal.</p></div>{isConnected ? (
            <button type="button" className="seedleaf-pouch-refresh" onClick={syncWalletAndHoldings} disabled={syncingWallet || refreshCooling} aria-label="Refresh wallet and pouch balances">
            <span className={syncingWallet ? "is-spinning" : ""}>↻</span>{syncingWallet ? "REFRESHING" : refreshCooling ? "REFRESHED" : "REFRESH POUCH"}
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
            {asset.key === "seed" ? <SeedArt name="SEED" /> : asset.key === "lore" ? <LoreDeedArt revealed /> : <img src={asset.icon!} alt={asset.symbol} />}
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
            <div className={`seedleaf-asset-card legacy-land-asset ${legacyLoreBalance > 0n ? "is-held" : ""}`} aria-label="Old Lore Deed legacy asset">
            <div className="seedleaf-asset-icon legacy-land-asset-icon"><span>△</span></div>
            <div className="seedleaf-asset-copy"><span>Previous land collection</span><strong>OLD LORE LAND</strong><b>{isConnected ? legacyLoreBalance.toLocaleString() : "—"}</b><em className="seedleaf-usd-value">HISTORY ASSET</em></div>
            <span className="legacy-asset-mark" aria-hidden="true">{legacyLoreBalance > 0n ? "✓" : "○"}</span>
            </div>
            </div>
            <div className="seedleaf-assets-note"><span className="seedleaf-note-dot" />Your pouch is also your transfer selector. Old Lore Land stays as a history asset. Canonical Lore Land opens your place in the World.</div>
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
            {isLore ? (
              <div className="lore-deed-transfer-warning" role="note">
                <span aria-hidden="true">!</span>
                <div>
                  <strong>Check the Land Vault before you transfer.</strong>
                  <p>Anything still packed inside this Lore Deed goes with the NFT to its new keeper.</p>
                  {loreTokenId ? <Link prefetch={false} href={`/land/${loreTokenId}`}>Review &amp; unpack Land #{loreTokenId} →</Link> : null}
                </div>
              </div>
            ) : null}
            <button className="taboshi1-send-button" disabled={!canSend} onClick={transfer}><span>{txState === "sending" ? "Sending…" : !isConnected ? "Connect to send" : selectedAsset.value === 0n ? `Nothing to send yet` : isLore ? `Send Lore Deed` : `Send ${selectedAsset.symbol}`}</span><b>→</b></button>
            {message && <div className={`taboshi1-message ${txState === "success" ? "is-success" : "is-error"}`}><strong>{txState === "success" ? "Passed through the portal" : "The portal stayed closed"}</strong><span>{message}</span>{txHash && <LinkMaybeMini href={`https://basescan.org/tx/${txHash}`}>View transaction ↗</LinkMaybeMini>}</div>}
            </section>
          </div>
        </section>

        <section className="taboshi1-lore-strip seeds-leaves-lore-strip lore-final-whisper"><div className="taboshi1-lore-frog"><TobyworldIcon kind="sato" size={68} /></div><div><span className="taboshi1-kicker">FROM THE WATERLINE</span><strong>Your pouch is only the beginning.</strong><p>Carry what is real. Discover what is revealed. Build around what the pond actually shows.</p></div><span className="taboshi1-lore-leaf"><Image src="/tokens/taboshi.PNG" alt="" fill sizes="64px" className="object-contain" /></span></section>
      </div>
      <Footer />
      <PondDock active="pouch" />
    </MiniAppGate>
  );
}
