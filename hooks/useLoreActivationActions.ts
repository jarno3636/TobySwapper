"use client";

import { useCallback, useState } from "react";
import type { Address, Hex } from "viem";
import { decodeErrorResult, erc20Abi, isAddressEqual } from "viem";
import { base } from "viem/chains";
import { usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import {
  ACTIVATION_DEADLINE_SECONDS,
  ACTIVATION_MANAGER,
  ACTIVATION_PATIENCE,
  ACTIVATION_TOBY,
  ACTIVATION_VAULT,
  CANONICAL_LORE_NFT,
} from "@/lib/activation-contracts";
import { activationManagerAbi, canonicalActivationNftAbi } from "@/lib/activation-abis";

export type ActivationStage =
  | "idle" | "checking" | "approve-patience" | "approve-toby" | "awakening" | "confirming" | "awakened" | "withdrawing" | "withdrawn" | "error";

function extractHex(error: any): Hex | undefined {
  const seen = new Set<any>();
  let cursor = error;
  for (let i = 0; cursor && i < 8 && !seen.has(cursor); i += 1) {
    seen.add(cursor);
    const candidates = [cursor.data, cursor?.cause?.data, cursor?.details, cursor?.cause?.details];
    for (const value of candidates) if (typeof value === "string" && /^0x[0-9a-fA-F]{8,}$/.test(value)) return value as Hex;
    cursor = cursor.cause;
  }
  return undefined;
}

export function friendlyActivationError(error: unknown) {
  const data = extractHex(error as any);
  let name = "";
  if (data) {
    try { name = decodeErrorResult({ abi: activationManagerAbi, data }).errorName; } catch {}
  }
  if (!name) {
    const text = String((error as any)?.shortMessage || (error as any)?.message || error || "");
    name = ["ActivationNotStarted", "DeadlineExpired", "NotNFTOwner", "ProtocolCustodyCannotActivate", "AlreadyActive", "UnexpectedXRequirement", "YSlippageExceeded", "ShortXReceipt", "StillLocked"].find((x) => text.includes(x)) || "";
  }
  const messages: Record<string, string> = {
    ActivationNotStarted: "Land awakening has not started yet.",
    DeadlineExpired: "This activation quote expired. Refresh the terms and try again.",
    NotNFTOwner: "This wallet is no longer the current owner of that Lore Deed.",
    ProtocolCustodyCannotActivate: "This deed is currently held by protocol custody and cannot be awakened.",
    AlreadyActive: "This Lore Land is already awakened.",
    UnexpectedXRequirement: "Activation requirements changed onchain. We’ve refreshed the current terms.",
    YSlippageExceeded: "The PATIENCE requirement changed before execution. Current terms have been refreshed.",
    ShortXReceipt: "The TOBY transfer received less than the manager requires, so activation did not complete.",
    StillLocked: "The minimum TOBY lock has not matured yet.",
  };
  return { name, message: messages[name] || String((error as any)?.shortMessage || "The onchain action did not complete.") };
}

export function useLoreActivationActions(owner?: Address, onRefresh?: () => Promise<unknown> | void) {
  const client = usePublicClient({ chainId: base.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [stage, setStage] = useState<ActivationStage>("idle");
  const [message, setMessage] = useState("");
  const [hashes, setHashes] = useState<`0x${string}`[]>([]);

  const wait = useCallback(async (hash: `0x${string}`) => {
    setHashes((old) => old.includes(hash) ? old : [...old, hash]);
    if (!client) throw new Error("Base client unavailable");
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
  }, [client]);

  const activate = useCallback(async (tokenId: bigint) => {
    if (!owner || !client) return;
    setMessage(""); setHashes([]); setStage("checking");
    try {
      await switchChainAsync?.({ chainId: base.id }).catch(() => undefined);
      const operations = await client.readContract({ address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "pausableOperations" });
      const operationId = operations[0];
      const checks = await client.multicall({ allowFailure: false, contracts: [
        { address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "activationStarted" },
        { address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "activationXAmount" },
        { address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "activationYCost" },
        { address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "operationPaused", args: [operationId] },
        { address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "isActive", args: [tokenId] },
        { address: CANONICAL_LORE_NFT, abi: canonicalActivationNftAbi, functionName: "ownerOf", args: [tokenId] },
        { address: ACTIVATION_TOBY, abi: erc20Abi, functionName: "balanceOf", args: [owner] },
        { address: ACTIVATION_PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [owner] },
        { address: ACTIVATION_TOBY, abi: erc20Abi, functionName: "allowance", args: [owner, ACTIVATION_MANAGER] },
        { address: ACTIVATION_PATIENCE, abi: erc20Abi, functionName: "allowance", args: [owner, ACTIVATION_VAULT] },
      ] as any });
      const [started, xAmount, yCost, paused, active, nftOwner, xBalance, yBalance, xAllowance, yAllowance] = checks as unknown as [boolean,bigint,bigint,boolean,boolean,Address,bigint,bigint,bigint,bigint];
      if (!started) throw new Error("ActivationNotStarted");
      if (paused) throw new Error("Land awakening is currently paused.");
      if (active) throw new Error("AlreadyActive");
      if (!isAddressEqual(nftOwner, owner)) throw new Error("NotNFTOwner");
      if (xBalance < xAmount) throw new Error("Your wallet does not have enough TOBY for the current commitment.");
      if (yBalance < yCost) throw new Error("Your wallet does not have enough PATIENCE for the current offering.");

      if (yAllowance < yCost) {
        setStage("approve-patience");
        const h = await writeContractAsync({ address: ACTIVATION_PATIENCE, abi: erc20Abi, functionName: "approve", args: [ACTIVATION_VAULT, yCost], chainId: base.id });
        await wait(h);
      }
      if (xAllowance < xAmount) {
        setStage("approve-toby");
        const h = await writeContractAsync({ address: ACTIVATION_TOBY, abi: erc20Abi, functionName: "approve", args: [ACTIVATION_MANAGER, xAmount], chainId: base.id });
        await wait(h);
      }

      // Fresh terms immediately before activate. expectedXAmount is deliberately
      // pinned to this last read so governance changes fail safely onchain.
      setStage("awakening");
      const [freshX, freshY] = await client.multicall({ allowFailure: false, contracts: [
        { address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "activationXAmount" },
        { address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "activationYCost" },
      ] as any }) as unknown as [bigint, bigint];
      if (freshX !== xAmount || freshY !== yCost) throw new Error("UnexpectedXRequirement");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + ACTIVATION_DEADLINE_SECONDS);
      const hash = await writeContractAsync({ address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "activate", args: [tokenId, freshY, freshX, deadline], chainId: base.id });
      setStage("confirming");
      await wait(hash);
      setStage("awakened");
      setMessage("Lore Land awakened. The current activation is confirmed on Base.");
      await onRefresh?.();
    } catch (error) {
      const friendly = friendlyActivationError(error);
      setStage("error"); setMessage(friendly.message);
      if (friendly.name === "UnexpectedXRequirement" || friendly.name === "YSlippageExceeded") await onRefresh?.();
    }
  }, [owner, client, switchChainAsync, writeContractAsync, wait, onRefresh]);

  const withdraw = useCallback(async (lockId: bigint) => {
    if (!owner || !client || lockId <= 0n) return;
    setMessage(""); setHashes([]); setStage("withdrawing");
    try {
      await switchChainAsync?.({ chainId: base.id }).catch(() => undefined);
      const hash = await writeContractAsync({ address: ACTIVATION_MANAGER, abi: activationManagerAbi, functionName: "withdrawX", args: [lockId], chainId: base.id });
      await wait(hash);
      setStage("withdrawn"); setMessage("TOBY returned to your wallet. This deed’s current activation is now deactivated.");
      await onRefresh?.();
    } catch (error) {
      const friendly = friendlyActivationError(error);
      setStage("error"); setMessage(friendly.message);
    }
  }, [owner, client, switchChainAsync, writeContractAsync, wait, onRefresh]);

  return { stage, message, hashes, activate, withdraw, reset: () => { setStage("idle"); setMessage(""); setHashes([]); } };
}
