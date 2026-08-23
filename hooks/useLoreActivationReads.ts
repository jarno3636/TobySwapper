"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { erc20Abi } from "viem";
import { base } from "viem/chains";
import {
  useReadContract,
  useReadContracts,
} from "wagmi";

import {
  ACTIVATION_MANAGER,
  ACTIVATION_PATIENCE,
  ACTIVATION_TOBY,
  ACTIVATION_VAULT,
  CANONICAL_LORE_NFT,
} from "@/lib/activation-contracts";

import {
  activationManagerAbi,
  canonicalActivationNftAbi,
} from "@/lib/activation-abis";

export type OwnedActivationDeed = {
  tokenId: string;
  communityName?: string | null;
};

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

function result<T>(
  entry: any,
  fallback: T,
): T {
  return entry?.status === "success"
    ? (entry.result as T)
    : fallback;
}

function normalizeLock(
  lockId: bigint,
  value: any,
): ActivationLock | undefined {
  if (!value) return undefined;

  /*
   * Viem returns named tuple components as an object
   * for this ABI. The array fallback makes this resilient
   * if the transport/client happens to expose a tuple array.
   */
  if (Array.isArray(value)) {
    return {
      lockId,
      tokenId: BigInt(value[0]),
      locker: value[1] as Address,
      xAmount: BigInt(value[2]),
      startTime: BigInt(value[3]),
      unlockTime: BigInt(value[4]),
      ownershipNonceAtActivation:
        BigInt(value[5]),
      withdrawn: Boolean(value[6]),
    };
  }

  return {
    lockId,
    tokenId: BigInt(value.tokenId),
    locker: value.locker as Address,
    xAmount: BigInt(value.xAmount),
    startTime: BigInt(value.startTime),
    unlockTime: BigInt(value.unlockTime),
    ownershipNonceAtActivation:
      BigInt(
        value.ownershipNonceAtActivation,
      ),
    withdrawn: Boolean(value.withdrawn),
  };
}

export function useLoreActivationReads(
  owner?: Address,
) {
  const [deeds, setDeeds] =
    useState<OwnedActivationDeed[]>([]);

  const [deedsLoading, setDeedsLoading] =
    useState(false);

  const [refreshTick, setRefreshTick] =
    useState(0);

  /* -------------------------------------------------------
     Owned canonical deeds

     Reuses the existing owned-deed endpoint.
     We do NOT scan every token ID.
  ------------------------------------------------------- */

  useEffect(() => {
    if (!owner) {
      setDeeds([]);
      return;
    }

    let cancelled = false;

    setDeedsLoading(true);

    fetch(
      `/api/land/owned?owner=${encodeURIComponent(
        owner,
      )}&activation=${refreshTick}`,
      {
        cache: "no-store",
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "owned deeds unavailable",
          );
        }

        return response.json();
      })
      .then((json) => {
        if (cancelled) return;

        setDeeds(
          Array.isArray(json?.deeds)
            ? json.deeds
            : [],
        );
      })
      .catch(() => {
        if (!cancelled) {
          setDeeds([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDeedsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [owner, refreshTick]);

  /* -------------------------------------------------------
     Global ActivationManager state

     One multicall.
  ------------------------------------------------------- */

  const globalContracts =
    useMemo(
      () =>
        [
          "activationStarted",
          "activationXAmount",
          "activationYCost",
          "minActivationX",
          "maxActivationX",
          "minActivationY",
          "maxActivationY",
          "LOCK_DURATION",
          "totalActivations",
          "totalLockedX",
          "heldX",
          "solvent",
          "pausableOperations",
        ].map(
          (functionName) =>
            ({
              address:
                ACTIVATION_MANAGER,
              abi: activationManagerAbi,
              functionName,
              chainId: base.id,
            }) as any,
        ),
      [],
    );

  const globalRead =
    useReadContracts({
      contracts:
        globalContracts,

      query: {
        staleTime: 8_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    });

  /*
   * pausableOperations()[0] is the official
   * ACTIVATION operation ID.
   *
   * Never hard-code this bytes32.
   */
  const operations =
    result<readonly Hex[]>(
      globalRead.data?.[12],
      [],
    );

  const activationOperationId =
    operations?.[0];

  const pauseRead =
    useReadContract({
      address:
        ACTIVATION_MANAGER,

      abi:
        activationManagerAbi,

      functionName:
        "operationPaused",

      args:
        activationOperationId
          ? [activationOperationId]
          : undefined,

      chainId:
        base.id,

      query: {
        enabled:
          Boolean(
            activationOperationId,
          ),

        staleTime: 5_000,

        refetchOnWindowFocus:
          true,

        refetchOnReconnect:
          true,
      },
    });

  /* -------------------------------------------------------
     Per-deed canonical state

     Four reads/deed in one multicall:
     - isActive
     - activeLockId
     - ownerOf
     - transferNonce
  ------------------------------------------------------- */

  const perDeedContracts =
    useMemo(
      () =>
        deeds.flatMap(
          (deed) => {
            const tokenId =
              BigInt(
                deed.tokenId,
              );

            return [
              {
                address:
                  ACTIVATION_MANAGER,

                abi:
                  activationManagerAbi,

                functionName:
                  "isActive",

                args:
                  [tokenId],

                chainId:
                  base.id,
              },
              {
                address:
                  ACTIVATION_MANAGER,

                abi:
                  activationManagerAbi,

                functionName:
                  "activeLockId",

                args:
                  [tokenId],

                chainId:
                  base.id,
              },
              {
                address:
                  CANONICAL_LORE_NFT,

                abi:
                  canonicalActivationNftAbi,

                functionName:
                  "ownerOf",

                args:
                  [tokenId],

                chainId:
                  base.id,
              },
              {
                address:
                  CANONICAL_LORE_NFT,

                abi:
                  canonicalActivationNftAbi,

                functionName:
                  "transferNonce",

                args:
                  [tokenId],

                chainId:
                  base.id,
              },
            ];
          },
        ),
      [deeds],
    );

  const deedRead =
    useReadContracts({
      contracts:
        perDeedContracts as any,

      query: {
        enabled:
          perDeedContracts.length >
          0,

        staleTime: 7_000,

        refetchOnWindowFocus:
          true,

        refetchOnReconnect:
          true,
      },
    });

  /*
   * First construct authoritative activation state
   * WITHOUT lock details.
   */
  const baseDeedStates =
    useMemo(
      () =>
        deeds.map(
          (deed, index) => {
            const offset =
              index * 4;

            return {
              ...deed,

              isActive:
                result<boolean>(
                  deedRead.data?.[
                    offset
                  ],
                  false,
                ),

              lockId:
                result<bigint>(
                  deedRead.data?.[
                    offset + 1
                  ],
                  0n,
                ),

              owner:
                result<
                  | Address
                  | undefined
                >(
                  deedRead.data?.[
                    offset + 2
                  ],
                  undefined,
                ),

              transferNonce:
                result<bigint>(
                  deedRead.data?.[
                    offset + 3
                  ],
                  0n,
                ),
            };
          },
        ),

      [
        deeds,
        deedRead.data,
      ],
    );

  /* -------------------------------------------------------
     Exact getLock reads

     Only active deeds with a valid current lock ID
     are queried.

     No raw call.
     No guessing.
     No timestamp heuristics.
  ------------------------------------------------------- */

  const activeDeeds =
    useMemo(
      () =>
        baseDeedStates.filter(
          (deed) =>
            deed.isActive &&
            deed.lockId > 0n,
        ),

      [baseDeedStates],
    );

  const lockContracts =
    useMemo(
      () =>
        activeDeeds.map(
          (deed) => ({
            address:
              ACTIVATION_MANAGER,

            abi:
              activationManagerAbi,

            functionName:
              "getLock",

            args:
              [deed.lockId],

            chainId:
              base.id,
          }),
        ),

      [activeDeeds],
    );

  const lockRead =
    useReadContracts({
      contracts:
        lockContracts as any,

      query: {
        enabled:
          lockContracts.length >
          0,

        staleTime: 7_000,

        refetchOnWindowFocus:
          true,

        refetchOnReconnect:
          true,
      },
    });

  const lockMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          ActivationLock
        >();

      activeDeeds.forEach(
        (deed, index) => {
          const entry =
            lockRead.data?.[
              index
            ];

          if (
            entry?.status !==
            "success"
          ) {
            return;
          }

          const lock =
            normalizeLock(
              deed.lockId,
              entry.result,
            );

          if (lock) {
            map.set(
              deed.tokenId,
              lock,
            );
          }
        },
      );

      return map;
    }, [
      activeDeeds,
      lockRead.data,
    ]);

  const deedStates =
    useMemo(
      () =>
        baseDeedStates.map(
          (deed) => ({
            ...deed,

            lock:
              lockMap.get(
                deed.tokenId,
              ),
          }),
        ),

      [
        baseDeedStates,
        lockMap,
      ],
    );

  /* -------------------------------------------------------
     Connected wallet state

     Correct approval spenders:
     TOBY     -> ActivationManager
     PATIENCE -> ActivationVault
  ------------------------------------------------------- */

  const walletContracts =
    useMemo(
      () =>
        owner
          ? [
              {
                address:
                  ACTIVATION_TOBY,

                abi:
                  erc20Abi,

                functionName:
                  "balanceOf",

                args:
                  [owner],

                chainId:
                  base.id,
              },
              {
                address:
                  ACTIVATION_PATIENCE,

                abi:
                  erc20Abi,

                functionName:
                  "balanceOf",

                args:
                  [owner],

                chainId:
                  base.id,
              },
              {
                address:
                  ACTIVATION_TOBY,

                abi:
                  erc20Abi,

                functionName:
                  "allowance",

                args: [
                  owner,
                  ACTIVATION_MANAGER,
                ],

                chainId:
                  base.id,
              },
              {
                address:
                  ACTIVATION_PATIENCE,

                abi:
                  erc20Abi,

                functionName:
                  "allowance",

                args: [
                  owner,
                  ACTIVATION_VAULT,
                ],

                chainId:
                  base.id,
              },
            ]
          : [],

      [owner],
    );

  const walletRead =
    useReadContracts({
      contracts:
        walletContracts as any,

      query: {
        enabled:
          Boolean(owner),

        staleTime: 5_000,

        refetchOnWindowFocus:
          true,

        refetchOnReconnect:
          true,
      },
    });

  /* -------------------------------------------------------
     Explicit refresh after transactions
  ------------------------------------------------------- */

  const refetch =
    async () => {
      setRefreshTick(
        (value) =>
          value + 1,
      );

      await Promise.allSettled(
        [
          globalRead.refetch(),
          pauseRead.refetch(),
          deedRead.refetch(),
          lockRead.refetch(),
          walletRead.refetch(),
        ],
      );
    };

  return {
    deeds:
      deedStates,

    deedsLoading,

    activationStarted:
      result<boolean>(
        globalRead.data?.[0],
        false,
      ),

    activationXAmount:
      result<bigint>(
        globalRead.data?.[1],
        0n,
      ),

    activationYCost:
      result<bigint>(
        globalRead.data?.[2],
        0n,
      ),

    minActivationX:
      result<bigint>(
        globalRead.data?.[3],
        0n,
      ),

    maxActivationX:
      result<bigint>(
        globalRead.data?.[4],
        0n,
      ),

    minActivationY:
      result<bigint>(
        globalRead.data?.[5],
        0n,
      ),

    maxActivationY:
      result<bigint>(
        globalRead.data?.[6],
        0n,
      ),

    lockDuration:
      result<bigint>(
        globalRead.data?.[7],
        0n,
      ),

    totalActivations:
      result<bigint>(
        globalRead.data?.[8],
        0n,
      ),

    totalLockedX:
      result<bigint>(
        globalRead.data?.[9],
        0n,
      ),

    heldX:
      result<bigint>(
        globalRead.data?.[10],
        0n,
      ),

    solvent:
      result<boolean>(
        globalRead.data?.[11],
        false,
      ),

    activationOperationId,

    activationPaused:
      activationOperationId
        ? Boolean(
            pauseRead.data,
          )
        : false,

    tobyBalance:
      result<bigint>(
        walletRead.data?.[0],
        0n,
      ),

    patienceBalance:
      result<bigint>(
        walletRead.data?.[1],
        0n,
      ),

    tobyAllowance:
      result<bigint>(
        walletRead.data?.[2],
        0n,
      ),

    patienceAllowance:
      result<bigint>(
        walletRead.data?.[3],
        0n,
      ),

    isLoading:
      globalRead.isLoading ||
      pauseRead.isLoading ||
      deedRead.isLoading ||
      lockRead.isLoading ||
      walletRead.isLoading ||
      deedsLoading,

    refetch,
  };
}
