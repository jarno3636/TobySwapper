"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { erc20Abi, isAddressEqual } from "viem";
import { base } from "viem/chains";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { ACTIVATION_MANAGER, ACTIVATION_PATIENCE, ACTIVATION_TOBY, ACTIVATION_VAULT, CANONICAL_LORE_NFT } from "@/lib/activation-contracts";
import { activationManagerAbi, activationVaultAbi, canonicalActivationNftAbi, patienceActivationAbi } from "@/lib/activation-abis";

export type OwnedActivationDeed = { tokenId: string; communityName?: string | null };
export type ActivationLock = {
  lockId: bigint;
  tokenId: bigint;
  locker: Address;
  xAmount: bigint;
  startTime: bigint;
  unlockTime: bigint;
  ownershipNonceAtActivation: bigint;
  withdrawn: boolean;
};

function result<T>(entry: any, fallback: T): T {
  return entry?.status === "success" ? (entry.result as T) : fallback;
}

export function useLoreActivationReads(owner?: Address) {
  const client = usePublicClient({ chainId: base.id });
  const [deeds, setDeeds] = useState<OwnedActivationDeed[]>([]);
  const [deedsLoading, setDeedsLoading] = useState(false);
  const [lockMap, setLockMap] = useState<Record<string, ActivationLock | undefined>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!owner) { setDeeds([]); return; }
    let cancelled = false;
    setDeedsLoading(true);
    fetch(`/api/land/owned?owner=${encodeURIComponent(owner)}&activation=${refreshTick}`, { cache: "no-store" })
      .then(async (r) => r.ok ? r.json() : Promise.reject(new Error("owned deeds unavailable")))
      .then((json) => { if (!cancelled) setDeeds(Array.isArray(json?.deeds) ? json.deeds : []); })
      .catch(() => { if (!cancelled) setDeeds([]); })
      .finally(() => { if (!cancelled) setDeedsLoading(false); });
    return () => { cancelled = true; };
  }, [owner, refreshTick]);

  const globalContracts = useMemo(() => [
    "activationStarted", "activationXAmount", "activationYCost", "minActivationX", "maxActivationX",
    "minActivationY", "maxActivationY", "totalActivations", "totalLockedX", "heldX", "solvent",
    "pausableOperations", "LOCK_DURATION", "tokenXDecimals",
  ].map((functionName) => ({ address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName, chainId: base.id } as any)), []);

  const globalRead = useReadContracts({ contracts: globalContracts, query: { staleTime: 8_000, refetchOnWindowFocus: true, refetchOnReconnect: true } });
  const ops = result<readonly Hex[]>(globalRead.data?.[11], []);
  const activationOperationId = ops?.[0];

  const pauseRead = useReadContract({
    address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "operationPaused",
    args: activationOperationId ? [activationOperationId] : undefined, chainId: base.id,
    query: { enabled: Boolean(activationOperationId), staleTime: 5_000 },
  });

  const protocolRead = useReadContracts({
    contracts: [
      { address: ACTIVATION_VAULT, abi: activationVaultAbi, functionName: "tokenY", chainId: base.id },
      { address: ACTIVATION_VAULT, abi: activationVaultAbi, functionName: "balance", chainId: base.id },
      { address: ACTIVATION_VAULT, abi: activationVaultAbi, functionName: "totalGrossQuoted", chainId: base.id },
      { address: ACTIVATION_VAULT, abi: activationVaultAbi, functionName: "totalActuallyReceived", chainId: base.id },
      { address: ACTIVATION_VAULT, abi: activationVaultAbi, functionName: "totalActivationsCollected", chainId: base.id },
      { address: ACTIVATION_PATIENCE, abi: patienceActivationAbi, functionName: "decimals", chainId: base.id },
      { address: ACTIVATION_PATIENCE, abi: patienceActivationAbi, functionName: "txFee", chainId: base.id },
      { address: ACTIVATION_PATIENCE, abi: patienceActivationAbi, functionName: "burnFee", chainId: base.id },
    ] as any,
    query: { staleTime: 30_000, refetchOnWindowFocus: true, refetchOnReconnect: true },
  });

  const perDeedContracts = useMemo(() => deeds.flatMap((deed) => {
    const id = BigInt(deed.tokenId);
    return [
      { address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "isActive", args: [id], chainId: base.id },
      { address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "activeLockId", args: [id], chainId: base.id },
      { address: CANONICAL_LORE_NFT, abi: canonicalActivationNftAbi, functionName: "ownerOf", args: [id], chainId: base.id },
      { address: CANONICAL_LORE_NFT, abi: canonicalActivationNftAbi, functionName: "transferNonce", args: [id], chainId: base.id },
    ];
  }), [deeds]);

  const deedRead = useReadContracts({ contracts: perDeedContracts as any, query: { enabled: perDeedContracts.length > 0, staleTime: 7_000, refetchOnWindowFocus: true, refetchOnReconnect: true } });

  const walletContracts = useMemo(() => owner ? [
    { address: ACTIVATION_TOBY, abi: erc20Abi, functionName: "balanceOf", args: [owner], chainId: base.id },
    { address: ACTIVATION_PATIENCE, abi: patienceActivationAbi, functionName: "balanceOf", args: [owner], chainId: base.id },
    { address: ACTIVATION_TOBY, abi: erc20Abi, functionName: "allowance", args: [owner, ACTIVATION_MANAGER], chainId: base.id },
    { address: ACTIVATION_PATIENCE, abi: patienceActivationAbi, functionName: "allowance", args: [owner, ACTIVATION_VAULT], chainId: base.id },
  ] : [], [owner]);

  const walletRead = useReadContracts({ contracts: walletContracts as any, query: { enabled: Boolean(owner), staleTime: 5_000, refetchOnWindowFocus: true, refetchOnReconnect: true } });

  const activationXAmount = result<bigint>(globalRead.data?.[1], 0n);
  const deedStates = useMemo(() => deeds.map((deed, i) => {
    const at = i * 4;
    return {
      ...deed,
      isActive: result<boolean>(deedRead.data?.[at], false),
      lockId: result<bigint>(deedRead.data?.[at + 1], 0n),
      owner: result<Address | undefined>(deedRead.data?.[at + 2], undefined),
      transferNonce: result<bigint>(deedRead.data?.[at + 3], 0n),
      lock: lockMap[deed.tokenId],
    };
  }), [deeds, deedRead.data, lockMap]);

  const activeLockKey = deedStates.filter((d) => d.isActive && d.lockId > 0n).map((d) => `${d.tokenId}:${d.lockId}`).join("|");
  useEffect(() => {
    if (!client) return;
    const active = deedStates.filter((deed) => deed.isActive && deed.lockId > 0n);
    if (!active.length) { setLockMap({}); return; }
    let cancelled = false;
    client.multicall({
      allowFailure: true,
      contracts: active.map((deed) => ({ address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "getLock", args: [deed.lockId] })) as any,
    }).then((rows) => {
      if (cancelled) return;
      const next: Record<string, ActivationLock | undefined> = {};
      active.forEach((deed, index) => {
        const row: any = rows[index];
        if (row?.status !== "success" || !row.result) { next[deed.tokenId] = undefined; return; }
        const lock: any = row.result;
        next[deed.tokenId] = {
          lockId: deed.lockId,
          tokenId: BigInt(lock.tokenId), locker: lock.locker as Address, xAmount: BigInt(lock.xAmount),
          startTime: BigInt(lock.startTime), unlockTime: BigInt(lock.unlockTime),
          ownershipNonceAtActivation: BigInt(lock.ownershipNonceAtActivation), withdrawn: Boolean(lock.withdrawn),
        };
      });
      setLockMap(next);
    }).catch(() => { if (!cancelled) setLockMap({}); });
    return () => { cancelled = true; };
    // activeLockKey intentionally collapses the dependency to onchain lock identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, activeLockKey]);

  const vaultTokenY = result<Address | undefined>(protocolRead.data?.[0], undefined);
  const vaultTokenYMatches = Boolean(vaultTokenY && isAddressEqual(vaultTokenY, ACTIVATION_PATIENCE));
  const rawPatienceDecimals = result<bigint>(protocolRead.data?.[5], 18n);
  const patienceDecimals = rawPatienceDecimals >= 0n && rawPatienceDecimals <= 255n ? Number(rawPatienceDecimals) : 18;
  const tobyDecimals = Number(result<number>(globalRead.data?.[13], 18));

  const refetch = async () => {
    setRefreshTick((x) => x + 1);
    await Promise.allSettled([globalRead.refetch(), pauseRead.refetch(), protocolRead.refetch(), deedRead.refetch(), walletRead.refetch()]);
  };

  return {
    deeds: deedStates, deedsLoading,
    activationStarted: result<boolean>(globalRead.data?.[0], false),
    activationXAmount,
    activationYCost: result<bigint>(globalRead.data?.[2], 0n),
    minActivationX: result<bigint>(globalRead.data?.[3], 0n), maxActivationX: result<bigint>(globalRead.data?.[4], 0n),
    minActivationY: result<bigint>(globalRead.data?.[5], 0n), maxActivationY: result<bigint>(globalRead.data?.[6], 0n),
    totalActivations: result<bigint>(globalRead.data?.[7], 0n), totalLockedX: result<bigint>(globalRead.data?.[8], 0n),
    heldX: result<bigint>(globalRead.data?.[9], 0n), solvent: result<boolean>(globalRead.data?.[10], false),
    activationOperationId, activationPaused: Boolean(pauseRead.data),
    lockDuration: result<bigint>(globalRead.data?.[12], 0n), tobyDecimals, patienceDecimals,
    vaultTokenY, vaultTokenYMatches,
    vaultBalance: result<bigint>(protocolRead.data?.[1], 0n),
    vaultTotalGrossQuoted: result<bigint>(protocolRead.data?.[2], 0n),
    vaultTotalActuallyReceived: result<bigint>(protocolRead.data?.[3], 0n),
    vaultTotalActivationsCollected: result<bigint>(protocolRead.data?.[4], 0n),
    patienceTxFee: result<bigint>(protocolRead.data?.[6], 0n), patienceBurnFee: result<bigint>(protocolRead.data?.[7], 0n),
    tobyBalance: result<bigint>(walletRead.data?.[0], 0n), patienceBalance: result<bigint>(walletRead.data?.[1], 0n),
    tobyAllowance: result<bigint>(walletRead.data?.[2], 0n), patienceAllowance: result<bigint>(walletRead.data?.[3], 0n),
    protocolReady: vaultTokenYMatches,
    isLoading: globalRead.isLoading || pauseRead.isLoading || protocolRead.isLoading || deedRead.isLoading || walletRead.isLoading || deedsLoading,
    refetch,
  };
}
