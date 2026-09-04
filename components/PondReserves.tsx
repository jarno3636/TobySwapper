"use client";

import { useMemo, useState, type ReactNode } from "react";
import { erc20Abi, type Address } from "viem";
import { base } from "viem/chains";
import { useBalance, useReadContract, useReadContracts } from "wagmi";
import { CBBTC, PATIENCE, TABOSHI, TOBY } from "@/lib/addresses";
import { LORE_COLLECTION_ADDRESS, OLD_LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";
import { useUsdPrices } from "@/lib/prices";
import { composeCast, SITE_URL } from "@/lib/miniapps";
import {
  LORE_ACTIVATION_MANAGER, LORE_ACTIVATION_VAULT, LORE_RESERVE_CUSTODY,
  LORE_REWARD_DISTRIBUTOR, LORE_REWARD_DISTRIBUTOR_ABI, PATIENCE_FEE_TREASURY,
  POND_FEE_ROUTER, POND_FEE_ROUTER_ABI, POND_LORE_RESERVE, RESERVE_MANAGER_ABI,
  RESERVE_VAULT_ABI, SYSTEM_ROLES, TOBYWORLD_GOVERNANCE_SAFE, reserveBaseScan,
} from "@/lib/pond-reserves";

const readQuery = { staleTime: 60_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
function valueAt(rows: readonly any[] | undefined, index: number) { const row = rows?.[index]; return row?.status === "success" && typeof row.result === "bigint" ? row.result as bigint : undefined; }
function boolAt(rows: readonly any[] | undefined, index: number) { const row = rows?.[index]; return row?.status === "success" && typeof row.result === "boolean" ? row.result as boolean : undefined; }
function addressAt(rows: readonly any[] | undefined, index: number) { const row = rows?.[index]; return row?.status === "success" && typeof row.result === "string" ? row.result as Address : undefined; }
function percentBps(value?: bigint) { return value === undefined ? "…" : `${(Number(value) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`; }
function units(value?: bigint, decimals = 18, maximumFractionDigits = 2) { if (value === undefined) return "…"; const n = Number(value) / 10 ** decimals; return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits }) : "…"; }
function compact(value?: bigint, decimals = 18) { if (value === undefined) return "…"; const n = Number(value) / 10 ** decimals; if (!Number.isFinite(n)) return "…"; if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`; if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`; if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`; return n.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function usd(value?: number) { if (value === undefined || !Number.isFinite(value)) return "…"; if (value === 0) return "$0"; if (value < 0.01) return "<$0.01"; return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: value >= 1_000 ? 0 : 2 }); }
function fiat(raw: bigint | undefined, decimals: number, price?: number) { return raw === undefined || !price ? undefined : (Number(raw) / 10 ** decimals) * price; }
function short(address: Address) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
function cashSymbol(symbol: string) { return symbol.startsWith("$") ? symbol : `$${symbol}`; }

function ReserveCard(props: { tone: string; icon: string; title: string; amount: string; value: string; status?: string; address: Address; children: ReactNode; wide?: boolean }) {
  return <details className={`pond-reserve-card ${props.tone}${props.wide ? " is-wide" : ""}`}>
    <summary><span className="pond-reserve-card-icon">{props.icon}</span><span className="pond-reserve-card-copy"><span>{props.title}</span><strong>{props.amount}</strong><em>{props.value}</em></span><span className="pond-reserve-card-state">{props.status ?? "DETAILS"}<i>⌄</i></span></summary>
    <div className="pond-reserve-card-detail">{props.children}<a href={reserveBaseScan(props.address)} target="_blank" rel="noreferrer">View contract · {short(props.address)} ↗</a></div>
  </details>;
}

export default function PondReserves(props: { seedTreasury: Address; seedCbBtc?: bigint; seedCbBtcUsd?: number }) {
  const [sharing, setSharing] = useState<"sharing" | "copied" | null>(null);
  const contracts = useMemo(() => [
    { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [PATIENCE_FEE_TREASURY], chainId: base.id },
    { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [LORE_ACTIVATION_VAULT], chainId: base.id },
    { address: LORE_ACTIVATION_VAULT, abi: RESERVE_VAULT_ABI, functionName: "totalActuallyReceived", chainId: base.id },
    { address: LORE_ACTIVATION_VAULT, abi: RESERVE_VAULT_ABI, functionName: "totalActivationsCollected", chainId: base.id },
    { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [POND_LORE_RESERVE], chainId: base.id },
    { address: LORE_COLLECTION_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [POND_LORE_RESERVE], chainId: base.id },
    { address: OLD_LORE_COLLECTION_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [POND_LORE_RESERVE], chainId: base.id },
    { address: LORE_COLLECTION_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [LORE_RESERVE_CUSTODY], chainId: base.id },
    { address: LORE_ACTIVATION_MANAGER, abi: RESERVE_MANAGER_ABI, functionName: "totalLockedX", chainId: base.id },
    { address: LORE_ACTIVATION_MANAGER, abi: RESERVE_MANAGER_ABI, functionName: "totalActivations", chainId: base.id },
    { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [TOBYWORLD_GOVERNANCE_SAFE], chainId: base.id },
    { address: TOBY, abi: erc20Abi, functionName: "balanceOf", args: [TOBYWORLD_GOVERNANCE_SAFE], chainId: base.id },
    { address: TABOSHI, abi: erc20Abi, functionName: "balanceOf", args: [TOBYWORLD_GOVERNANCE_SAFE], chainId: base.id },
    { address: CBBTC, abi: erc20Abi, functionName: "balanceOf", args: [TOBYWORLD_GOVERNANCE_SAFE], chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "routingEnabled", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "unallocatedProtocolETH", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "pendingMemberETH", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "operationsETH", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "safetyETH", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "totalETHFeesRecorded", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "totalMemberETHDrawn", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "memberBps", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "operationsBps", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "safetyBps", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "operationsRecipient", chainId: base.id },
    { address: POND_FEE_ROUTER, abi: POND_FEE_ROUTER_ABI, functionName: "safetyRecipient", chainId: base.id },
  ] as const, []);
  const reads = useReadContracts({ contracts: contracts as any, allowFailure: true, query: readQuery });
  const registeredRead = useReadContract({ address: LORE_REWARD_DISTRIBUTOR, abi: LORE_REWARD_DISTRIBUTOR_ABI, functionName: "registeredAssets", chainId: base.id, query: readQuery });
  const registeredAssets = useMemo(() => Array.isArray(registeredRead.data) ? [...registeredRead.data] as Address[] : [], [registeredRead.data]);
  const rewardContracts = useMemo(() => registeredAssets.flatMap((asset) => [
    { address: LORE_REWARD_DISTRIBUTOR, abi: LORE_REWARD_DISTRIBUTOR_ABI, functionName: "assetAccounting", args: [asset], chainId: base.id },
    { address: asset, abi: erc20Abi, functionName: "balanceOf", args: [LORE_REWARD_DISTRIBUTOR], chainId: base.id },
    { address: asset, abi: erc20Abi, functionName: "symbol", chainId: base.id },
    { address: asset, abi: erc20Abi, functionName: "decimals", chainId: base.id },
    { address: LORE_REWARD_DISTRIBUTOR, abi: LORE_REWARD_DISTRIBUTOR_ABI, functionName: "assetSolvent", args: [asset], chainId: base.id },
  ]), [registeredAssets]);
  const rewardReads = useReadContracts({ contracts: rewardContracts as any, allowFailure: true, query: readQuery });
  const feeRouterEthRead = useBalance({ address: POND_FEE_ROUTER, chainId: base.id, query: readQuery });
  const { prices } = useUsdPrices([PATIENCE, TOBY, TABOSHI, CBBTC, "ETH", ...registeredAssets.slice(0, 7)]);

  const patiencePrice = prices[PATIENCE.toLowerCase()], tobyPrice = prices[TOBY.toLowerCase()], taboshiPrice = prices[TABOSHI.toLowerCase()], cbBtcPrice = prices[CBBTC.toLowerCase()], ethPrice = prices.ETH;
  const feePatience = valueAt(reads.data, 0), activationPatience = valueAt(reads.data, 1), activationPatienceCollected = valueAt(reads.data, 2), activationCount = valueAt(reads.data, 3), pondPatience = valueAt(reads.data, 4), pondLore = valueAt(reads.data, 5), pondOldLore = valueAt(reads.data, 6), reserveLore = valueAt(reads.data, 7), lockedToby = valueAt(reads.data, 8), totalActivations = valueAt(reads.data, 9);
  const safePatience = valueAt(reads.data, 10), safeToby = valueAt(reads.data, 11), safeTaboshi = valueAt(reads.data, 12), safeCbBtc = valueAt(reads.data, 13), routingEnabled = boolAt(reads.data, 14), unallocatedProtocolEth = valueAt(reads.data, 15), pendingMemberEth = valueAt(reads.data, 16), operationsEth = valueAt(reads.data, 17), safetyEth = valueAt(reads.data, 18), totalEthFeesRecorded = valueAt(reads.data, 19), totalMemberEthDrawn = valueAt(reads.data, 20), memberBps = valueAt(reads.data, 21), operationsBps = valueAt(reads.data, 22), safetyBps = valueAt(reads.data, 23), operationsRecipient = addressAt(reads.data, 24), safetyRecipient = addressAt(reads.data, 25), feeRouterEth = feeRouterEthRead.data?.value;
  const rewardAssets = registeredAssets.map((address, assetIndex) => {
    const offset = assetIndex * 5, accountingRow = rewardReads.data?.[offset], accounting: any = accountingRow?.status === "success" ? accountingRow.result : undefined;
    const symbolRow = rewardReads.data?.[offset + 2], decimalsRow = rewardReads.data?.[offset + 3];
    return { address, symbol: symbolRow?.status === "success" && typeof symbolRow.result === "string" ? symbolRow.result : short(address), decimals: decimalsRow?.status === "success" && typeof decimalsRow.result === "number" ? decimalsRow.result : 18, held: valueAt(rewardReads.data, offset + 1), enabled: accounting === undefined ? undefined : Boolean(accounting.enabled ?? accounting[1]), reserved: accounting === undefined ? undefined : BigInt(accounting.reserved ?? accounting[3]), undistributed: accounting === undefined ? undefined : BigInt(accounting.undistributed ?? accounting[4]), distributed: accounting === undefined ? undefined : BigInt(accounting.totalDistributed ?? accounting[5]), solvent: boolAt(rewardReads.data, offset + 4), price: prices[address.toLowerCase()] };
  });
  const rewardAssetsUsd = rewardAssets.length > 0 && rewardAssets.every((asset) => asset.held !== undefined && asset.price) ? rewardAssets.reduce((sum, asset) => sum + (fiat(asset.held, asset.decimals, asset.price) ?? 0), 0) : undefined;
  const feePatienceUsd = fiat(feePatience, 18, patiencePrice), activationPatienceUsd = fiat(activationPatience, 18, patiencePrice), pondPatienceUsd = fiat(pondPatience, 18, patiencePrice), feeRouterEthUsd = fiat(feeRouterEth, 18, ethPrice), lockedTobyUsd = fiat(lockedToby, 18, tobyPrice);
  const reservesUsd = feePatienceUsd === undefined || activationPatienceUsd === undefined || props.seedCbBtcUsd === undefined || feeRouterEthUsd === undefined ? undefined : feePatienceUsd + activationPatienceUsd + props.seedCbBtcUsd + feeRouterEthUsd;
  const pondLoreTotal = pondLore === undefined || pondOldLore === undefined ? undefined : pondLore + pondOldLore;
  const safeAssets = [{ symbol: "$PATIENCE", raw: safePatience, decimals: 18, price: patiencePrice }, { symbol: "$TOBY", raw: safeToby, decimals: 18, price: tobyPrice }, { symbol: "$TABOSHI", raw: safeTaboshi, decimals: 18, price: taboshiPrice }, { symbol: "$cbBTC", raw: safeCbBtc, decimals: 8, price: cbBtcPrice }].filter((asset) => asset.raw !== undefined && asset.raw > 0n);

  const shareText = useMemo(() => {
    const fee = feePatience === undefined ? "$PATIENCE fee reserves are counting" : `${units(feePatience, 18, 0)} $PATIENCE in the fee treasury`, activation = activationPatience === undefined ? "Lore activation reserves are counting" : `${units(activationPatience)} $PATIENCE held from ${activationCount?.toLocaleString() ?? "…"} Lore activations`, pond = pondPatience === undefined ? "Pond liquidity is counting" : `${units(pondPatience)} $PATIENCE in Pond liquidity`, ethReserve = feeRouterEth === undefined ? "protocol $ETH is counting" : `${units(feeRouterEth, 18, 4)} $ETH in FeeRouterV1`, committed = lockedToby === undefined ? "committed $TOBY is counting" : `${compact(lockedToby)} $TOBY committed`, btc = props.seedCbBtc === undefined ? "the SEED reserve is counting" : `${units(props.seedCbBtc, 8, 8)} $cbBTC in the SEED reserve`, rewards = rewardAssets.length ? `${rewardAssets.length} member reward asset${rewardAssets.length === 1 ? "" : "s"} registered: ${rewardAssets.map((asset) => cashSymbol(asset.symbol)).join(", ")}` : "Member rewards staged for governance activation";
    return `The Pond Reserves · live on Base 🌊\n\n🔺 ${fee}\nΞ ${ethReserve}\n🌎 ${activation}\n🌊 ${pond}\n🐸 ${committed}\n₿ ${btc}\n✨ ${rewards}\n\nReserves, liquidity, rewards and committed value—counted separately.`;
  }, [activationCount, activationPatience, feePatience, feeRouterEth, lockedToby, pondPatience, props.seedCbBtc, rewardAssets]);
  async function share() { setSharing("sharing"); const page = `${SITE_URL.replace(/\/$/, "")}#pond-reserves`; try { if (await composeCast({ text: shareText, embeds: [page] })) return; if (navigator.share) await navigator.share({ title: "The Pond Reserves", text: shareText, url: page }); else { await navigator.clipboard.writeText(`${shareText}\n\n${page}`); setSharing("copied"); window.setTimeout(() => setSharing(null), 1400); } } catch { setSharing(null); } finally { setSharing((current) => current === "copied" ? current : null); } }

  return <section id="pond-reserves" className="pond-reserves" aria-labelledby="pond-reserves-title">
    <div className="pond-reserves-glow" aria-hidden="true" />
    <header className="pond-reserves-head"><div><span>LIVE ACCOUNTING · BASE</span><h3 id="pond-reserves-title">The Pond Reserves</h3><p>A clear view of reserves, live Pond activity, member rewards and committed assets—without double counting.</p></div><div className="pond-reserves-total"><small>RESERVE VALUE</small><strong>{usd(reservesUsd)}</strong><em>Spendable reserve assets only</em></div></header>
    <div className="pond-reserve-summary" aria-label="Reserve accounting categories">
      <article className="is-reserve"><span>RESERVES</span><strong>{usd(reservesUsd)}</strong><small>$PATIENCE + $cbBTC + protocol $ETH</small></article><article className="is-liquidity"><span>POND LIQUIDITY</span><strong>{usd(pondPatienceUsd)}</strong><small>AMM-held $PATIENCE</small></article><article className="is-rewards"><span>MEMBER REWARDS</span><strong>{rewardAssets.length ? (rewardAssetsUsd === undefined ? `${rewardAssets.length} ASSET${rewardAssets.length === 1 ? "" : "S"}` : usd(rewardAssetsUsd)) : "STAGED"}</strong><small>{rewardAssets.length ? "Held separately from reserves" : "No assets registered yet"}</small></article><article className="is-committed"><span>$TOBY COMMITTED</span><strong>{usd(lockedTobyUsd)}</strong><small>{compact(lockedToby)} $TOBY locked</small></article><article className="is-deeds"><span>LORE RESERVE</span><strong>{reserveLore?.toLocaleString() ?? "…"}</strong><small>Canonical deeds held for release</small></article>
    </div>
    <section className="pond-reserve-group is-revenue" aria-labelledby="pond-revenue-title"><header><div><span>01 · REVENUE &amp; RESERVES</span><h4 id="pond-revenue-title">What the protocol has collected</h4></div><b>EXPAND A CARD FOR ACCOUNTING</b></header><div className="pond-reserve-cards">
      <ReserveCard tone="is-fee" icon="🔺" title="$PATIENCE FEE TREASURY" amount={`${units(feePatience, 18, 2)} $PATIENCE`} value={usd(feePatienceUsd)} address={PATIENCE_FEE_TREASURY}><p>Collected from the token&apos;s 1% transfer fee.</p></ReserveCard>
      <ReserveCard tone="is-activation" icon="🌎" title="LORE ACTIVATION VAULT" amount={`${units(activationPatience)} $PATIENCE`} value={usd(activationPatienceUsd)} address={LORE_ACTIVATION_VAULT}><p>{activationPatienceCollected === undefined ? "Reading cumulative receipts…" : `${units(activationPatienceCollected)} $PATIENCE received across ${activationCount?.toLocaleString() ?? "…"} activations.`}</p></ReserveCard>
      <ReserveCard tone="is-bitcoin" icon="₿" title="SEED RESERVE" amount={`${units(props.seedCbBtc, 8, 8)} $cbBTC`} value={usd(props.seedCbBtcUsd)} address={props.seedTreasury}><p>The custody address and $cbBTC balance are derived live from the official Faucet contract.</p></ReserveCard>
      <ReserveCard tone="is-eth" icon="Ξ" title="POND PROTOCOL $ETH · FEEROUTERV1" amount={`${units(feeRouterEth, 18, 4)} $ETH`} value={usd(feeRouterEthUsd)} status={routingEnabled === undefined ? "READING" : routingEnabled ? "ROUTING ACTIVE" : "ACCUMULATION MODE"} address={POND_FEE_ROUTER} wide><p>{units(totalEthFeesRecorded, 18, 4)} $ETH recorded in total. Existing unallocated $ETH only moves after a separate governance allocation.</p><div className="pond-fee-router-buckets"><span><small>UNALLOCATED</small><b>{units(unallocatedProtocolEth, 18, 4)} $ETH</b></span><span><small>MEMBER PENDING</small><b>{units(pendingMemberEth, 18, 4)} $ETH</b></span><span><small>OPERATIONS</small><b>{units(operationsEth, 18, 4)} $ETH</b></span><span><small>SAFETY</small><b>{units(safetyEth, 18, 4)} $ETH</b></span></div><div className="pond-fee-router-config"><span><small>CURRENT SPLIT</small><b>{percentBps(memberBps)} Member · {percentBps(operationsBps)} Operations · {percentBps(safetyBps)} Safety</b></span><span><small>MEMBER DRAWN</small><b>{units(totalMemberEthDrawn, 18, 4)} $ETH</b></span><span><small>OPERATIONS TO</small><b>{operationsRecipient ? short(operationsRecipient) : "…"}</b></span><span><small>SAFETY TO</small><b>{safetyRecipient ? (safetyRecipient.toLowerCase() === POND_FEE_ROUTER ? "Retained in router" : short(safetyRecipient)) : "…"}</b></span></div></ReserveCard>
      <ReserveCard tone="is-rewards" icon="✨" title="LORE MEMBER REWARD RESERVE" amount={rewardAssets.length ? `${rewardAssets.length} REGISTERED ASSET${rewardAssets.length === 1 ? "" : "S"}` : "READY · 0 ASSETS"} value={rewardAssets.length ? (rewardAssetsUsd === undefined ? "Live asset accounting" : usd(rewardAssetsUsd)) : "Governance-gated"} status={rewardAssets.length ? "ASSETS DETECTED" : "STAGED"} address={LORE_REWARD_DISTRIBUTOR} wide><p>Assets are discovered from <b>registeredAssets()</b>; $cbBTC is not hardcoded. Balances do not mean reward distribution is active.</p>{rewardAssets.length === 0 ? <div className="pond-reward-empty"><b>Collect first. Activate later.</b><span>No reward assets are registered yet. This card will populate automatically when governance adds one.</span></div> : <div className="pond-reward-assets">{rewardAssets.map((asset) => <article key={asset.address}><header><strong>{cashSymbol(asset.symbol)}</strong><b className={asset.enabled ? "is-enabled" : "is-disabled"}>{asset.enabled ? "ENABLED" : "NEW FUNDING OFF"}</b></header><div><span><small>HELD</small><b>{units(asset.held, asset.decimals, 6)}</b></span><span><small>UNDISTRIBUTED</small><b>{units(asset.undistributed, asset.decimals, 6)}</b></span><span><small>RESERVED</small><b>{units(asset.reserved, asset.decimals, 6)}</b></span><span><small>DISTRIBUTED</small><b>{units(asset.distributed, asset.decimals, 6)}</b></span></div><footer>{usd(fiat(asset.held, asset.decimals, asset.price))} held value · {asset.solvent === undefined ? "Checking solvency" : asset.solvent ? "Fully solvent" : "Review required"}</footer></article>)}</div>}</ReserveCard>
    </div></section>
    <section className="pond-reserve-group is-activity" aria-labelledby="pond-activity-title"><header><div><span>02 · COMMITTED &amp; OPERATIONAL</span><h4 id="pond-activity-title">Value working inside the Pond</h4></div><b>NOT ADDED TO RESERVES</b></header><div className="pond-reserve-cards">
      <ReserveCard tone="is-pond" icon="🌊" title="POND / LORE AMM" amount={`${units(pondPatience)} $PATIENCE`} value={usd(pondPatienceUsd)} address={POND_LORE_RESERVE}><p>AMM-held $PATIENCE{pondLoreTotal && pondLoreTotal > 0n ? ` and ${pondLoreTotal.toLocaleString()} Lore Deeds` : ""}. Protocol $ETH fees forward to FeeRouterV1.</p></ReserveCard><ReserveCard tone="is-toby" icon="🐸" title="LORE ACTIVATION $TOBY LOCK" amount={`${compact(lockedToby)} $TOBY`} value={usd(lockedTobyUsd)} address={LORE_ACTIVATION_MANAGER}><p>Committed across {totalActivations?.toLocaleString() ?? "…"} Lore activations. Locked $TOBY is not spendable treasury value.</p></ReserveCard><ReserveCard tone="is-lore" icon="📜" title="LORE RESERVE CUSTODY" amount={`${reserveLore?.toLocaleString() ?? "…"} DEEDS`} value="Protocol-controlled inventory" address={LORE_RESERVE_CUSTODY} wide><p>Canonical Lore reserve awaiting controlled release into the Pond.</p></ReserveCard>
    </div></section>
    <details className="pond-reserve-governance"><summary><span>TOBYWORLD GOVERNANCE SAFE</span><strong>{safeAssets.length ? "Protocol assets detected" : "No counted protocol assets"}</strong><i>⌄</i></summary><div><p>Displayed separately and never added to reserve revenue automatically.</p>{safeAssets.length > 0 && <div className="pond-reserve-safe-assets">{safeAssets.map((asset) => <b key={asset.symbol}>{units(asset.raw, asset.decimals)} {asset.symbol} · {usd(fiat(asset.raw, asset.decimals, asset.price))}</b>)}</div>}<a href={reserveBaseScan(TOBYWORLD_GOVERNANCE_SAFE)} target="_blank" rel="noreferrer">View safe · {short(TOBYWORLD_GOVERNANCE_SAFE)} ↗</a></div></details>
    <details className="pond-reserve-systems"><summary><span>System infrastructure</span><b>Excluded from reserve totals</b><i>⌄</i></summary><div>{SYSTEM_ROLES.map((role) => <a href={reserveBaseScan(role.address)} target="_blank" rel="noreferrer" key={role.address}><span><strong>{role.title}</strong><small>{role.note}</small></span><b>{short(role.address)} ↗</b></a>)}</div></details>
    <footer className="pond-reserve-share"><div><span>SHARE THE SNAPSHOT</span><strong>One clean story. Live onchain numbers.</strong></div><button type="button" onClick={share} disabled={sharing === "sharing"}>{sharing === "sharing" ? "Opening…" : sharing === "copied" ? "Copied ✓" : "Share snapshot"}</button></footer>
  </section>;
}
