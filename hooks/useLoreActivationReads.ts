"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { encodeFunctionData, erc20Abi, getAddress, isAddressEqual } from "viem";
import { base } from "viem/chains";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import {
  ACTIVATION_MANAGER,
  ACTIVATION_PATIENCE,
  ACTIVATION_TOBY,
  ACTIVATION_VAULT,
  CANONICAL_LORE_NFT,
} from "@/lib/activation-contracts";
import { activationManagerAbi, canonicalActivationNftAbi } from "@/lib/activation-abis";

export type OwnedActivationDeed = { tokenId: string; communityName?: string | null };
export type DecodedActivationLock = {
  lockId: bigint;
  tokenId?: bigint;
  locker?: Address;
  xAmount?: bigint;
  activatedAt?: bigint;
  unlockAt?: bigint;
  rawWords: bigint[];
};

function result<T>(entry: any, fallback: T): T {
  return entry?.status === "success" ? (entry.result as T) : fallback;
}

function splitWords(data?: Hex): bigint[] {
  if (!data || data === "0x") return [];
  const body = data.slice(2);
  const words: bigint[] = [];
  for (let i = 0; i + 64 <= body.length; i += 64) words.push(BigInt(`0x${body.slice(i, i + 64)}`));
  return words;
}

function addressFromWord(word: bigint): Address | undefined {
  const hex = word.toString(16).padStart(64, "0");
  try { return getAddress(`0x${hex.slice(24)}`); } catch { return undefined; }
}

function decodeLockWords(args: {
  lockId: bigint;
  data?: Hex;
  tokenId: bigint;
  owner?: Address;
  currentX?: bigint;
}): DecodedActivationLock {
  const words = splitWords(args.data);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const earliest = 1_577_836_800n; // 2020-01-01; only used to classify timestamp-shaped words.
  const latest = now + 10n * 365n * 24n * 60n * 60n;
  const timestamps = words.filter((w) => w >= earliest && w <= latest).sort((a, b) => a < b ? -1 : 1);

  let locker: Address | undefined;
  if (args.owner) {
    locker = words.map(addressFromWord).find((candidate) => {
      if (!candidate) return false;
      try { return isAddressEqual(candidate, args.owner!); } catch { return false; }
    });
  }

  const xAmount = args.currentX && words.includes(args.currentX)
    ? args.currentX
    : words.filter((w) => w >= 1_000_000_000_000_000_000n).sort((a, b) => a > b ? -1 : 1)[0];

  return {
    lockId: args.lockId,
    tokenId: words.includes(args.tokenId) ? args.tokenId : undefined,
    locker,
    xAmount,
    activatedAt: timestamps[0],
    unlockAt: timestamps.length > 1 ? timestamps[timestamps.length - 1] : undefined,
    rawWords: words,
  };
}

export function useLoreActivationReads(owner?: Address) {
  const client = usePublicClient({ chainId: base.id });
  const [deeds, setDeeds] = useState<OwnedActivationDeed[]>([]);
  const [deedsLoading, setDeedsLoading] = useState(false);
  const [lockMap, setLockMap] = useState<Record<string, DecodedActivationLock | undefined>>({});
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
    "minActivationY", "maxActivationY", "totalActivations", "totalLockedX", "heldX", "solvent", "pausableOperations",
  ].map((functionName) => ({ address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName, chainId: base.id } as any)), []);

  const globalRead = useReadContracts({
    contracts: globalContracts,
    query: { staleTime: 8_000, refetchOnWindowFocus: true, refetchOnReconnect: true },
  });

  const ops = result<readonly Hex[]>(globalRead.data?.[11], []);
  const activationOperationId = ops?.[0];
  const pauseRead = useReadContract({
    address: ACTIVATION_MANAGER,
    abi: activationManagerAbi,
    functionName: "operationPaused",
    args: activationOperationId ? [activationOperationId] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(activationOperationId), staleTime: 5_000 },
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

  const deedRead = useReadContracts({
    contracts: perDeedContracts as any,
    query: { enabled: perDeedContracts.length > 0, staleTime: 7_000, refetchOnWindowFocus: true, refetchOnReconnect: true },
  });

  const walletContracts = useMemo(() => owner ? [
    { address: ACTIVATION_TOBY, abi: erc20Abi, functionName: "balanceOf", args: [owner], chainId: base.id },
    { address: ACTIVATION_PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [owner], chainId: base.id },
    { address: ACTIVATION_TOBY, abi: erc20Abi, functionName: "allowance", args: [owner, ACTIVATION_MANAGER], chainId: base.id },
    { address: ACTIVATION_PATIENCE, abi: erc20Abi, functionName: "allowance", args: [owner, ACTIVATION_VAULT], chainId: base.id },
  ] : [], [owner]);

  const walletRead = useReadContracts({
    contracts: walletContracts as any,
    query: { enabled: Boolean(owner), staleTime: 5_000, refetchOnWindowFocus: true, refetchOnReconnect: true },
  });

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

  useEffect(() => {
    if (!client) return;
    const active = deedStates.filter((deed) => deed.isActive && deed.lockId > 0n);
    if (!active.length) { setLockMap({}); return; }
    let cancelled = false;
    Promise.all(active.map(async (deed) => {
      try {
        const data = encodeFunctionData({ abi: activationManagerAbi, functionName: "getLock", args: [deed.lockId] });
        const response = await client.call({ to: ACTIVATION_MANAGER, data });
        return [deed.tokenId, decodeLockWords({ lockId: deed.lockId, data: response.data, tokenId: BigInt(deed.tokenId), owner, currentX: activationXAmount })] as const;
      } catch { return [deed.tokenId, undefined] as const; }
    })).then((pairs) => { if (!cancelled) setLockMap(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [client, owner, activationXAmount, deedStates.map((d) => `${d.tokenId}:${d.lockId}:${d.isActive}`).join("|")]);

  const refetch = async () => {
    setRefreshTick((x) => x + 1);
    await Promise.allSettled([globalRead.refetch(), pauseRead.refetch(), deedRead.refetch(), walletRead.refetch()]);
  };

  return {
    deeds: deedStates,
    deedsLoading,
    activationStarted: result<boolean>(globalRead.data?.[0], false),
    activationXAmount,
    activationYCost: result<bigint>(globalRead.data?.[2], 0n),
    minActivationX: result<bigint>(globalRead.data?.[3], 0n),
    maxActivationX: result<bigint>(globalRead.data?.[4], 0n),
    minActivationY: result<bigint>(globalRead.data?.[5], 0n),
    maxActivationY: result<bigint>(globalRead.data?.[6], 0n),
    totalActivations: result<bigint>(globalRead.data?.[7], 0n),
    totalLockedX: result<bigint>(globalRead.data?.[8], 0n),
    heldX: result<bigint>(globalRead.data?.[9], 0n),
    solvent: result<boolean>(globalRead.data?.[10], false),
    activationOperationId,
    activationPaused: Boolean(pauseRead.data),
    tobyBalance: result<bigint>(walletRead.data?.[0], 0n),
    patienceBalance: result<bigint>(walletRead.data?.[1], 0n),
    tobyAllowance: result<bigint>(walletRead.data?.[2], 0n),
    patienceAllowance: result<bigint>(walletRead.data?.[3], 0n),
    isLoading: globalRead.isLoading || pauseRead.isLoading || deedRead.isLoading || walletRead.isLoading || deedsLoading,
    refetch,
  };
}
