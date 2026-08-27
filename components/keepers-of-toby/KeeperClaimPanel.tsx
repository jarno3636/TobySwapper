"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

import ConnectPill from "@/components/ConnectPill";
import {
  keeperProfileMessage,
  normalizeKeeperHandle,
} from "@/lib/keeper-of-toby-profile";
import { keeperEdition, type KeeperOfTobySelf } from "@/lib/keeper-of-toby";

import styles from "./KeepersOfToby.module.css";

type Status = "idle" | "checking" | "ready" | "saving" | "saved" | "error";

export default function KeeperClaimPanel() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [keeper, setKeeper] = useState<KeeperOfTobySelf | null>(null);
  const [xHandle, setXHandle] = useState("");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const busy = status === "checking" || status === "saving";

  async function loadKeeper(wallet: string) {
    setStatus("checking");
    setMessage("");

    try {
      const response = await fetch("/api/keeper-of-toby/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: wallet }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Keeper registry unavailable.");
      }

      if (!json?.keeper) {
        setKeeper(null);
        setXHandle("");
        setTelegramHandle("");
        setStatus("idle");
        return;
      }

      const next = json.keeper as KeeperOfTobySelf;
      setKeeper(next);
      setXHandle(next.xHandle || "");
      setTelegramHandle(next.telegramHandle || "");
      setStatus("ready");
    } catch (error: any) {
      setKeeper(null);
      setStatus("error");
      setMessage(error?.message || "The Keeper registry could not be checked.");
    }
  }

  useEffect(() => {
    if (!address || !isConnected) {
      setKeeper(null);
      setStatus("idle");
      setMessage("");
      return;
    }

    void loadKeeper(address);
  }, [address, isConnected]);

  const dirty = useMemo(() => {
    if (!keeper) return false;
    return (
      normalizeKeeperHandle(xHandle) !== (keeper.xHandle || "") ||
      normalizeKeeperHandle(telegramHandle) !== (keeper.telegramHandle || "")
    );
  }, [keeper, telegramHandle, xHandle]);

  async function save() {
    if (!address || !keeper || busy) return;

    const cleanX = normalizeKeeperHandle(xHandle);
    const cleanTelegram = normalizeKeeperHandle(telegramHandle);
    const timestamp = Date.now();

    setStatus("saving");
    setMessage("Sign once to place your community handles beside your Keeper.");

    try {
      const signedMessage = keeperProfileMessage({
        tokenId: keeper.tokenId,
        signer: address,
        xHandle: cleanX,
        telegramHandle: cleanTelegram,
        timestamp,
      });

      const signature = await signMessageAsync({ message: signedMessage });

      const response = await fetch("/api/keeper-of-toby/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: keeper.tokenId,
          signer: address,
          xHandle: cleanX,
          telegramHandle: cleanTelegram,
          timestamp,
          signature,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Your Keeper profile could not be saved.");
      }

      setKeeper({
        ...keeper,
        xHandle: cleanX || null,
        telegramHandle: cleanTelegram || null,
      });
      setXHandle(cleanX);
      setTelegramHandle(cleanTelegram);
      setStatus("saved");
      setMessage("Your name has been set beside your Keeper.");
    } catch (error: any) {
      setStatus("error");
      setMessage(error?.shortMessage || error?.message || "The signature was not saved.");
    }
  }

  return (
    <section className={styles.claim}>
      <div className={styles.claimIntro}>
        <span>ARE YOU AMONG THEM?</span>
        <h2>Leave a mark beside your Keeper.</h2>
        <p>
          A Keeper can add an X or Telegram handle to the community registry.
          Nothing here changes the soulbound NFT.
        </p>
      </div>

      <div className={styles.claimBody}>
        <ConnectPill />

        {!isConnected ? (
          <div className={styles.claimState}>
            <strong>Connect the wallet that received the Keeper.</strong>
            <span>We will check the cached Keeper registry.</span>
          </div>
        ) : status === "checking" ? (
          <div className={styles.claimState}>
            <strong>Looking through the sediment…</strong>
            <span>Checking your wallet against the Keeper registry.</span>
          </div>
        ) : !keeper ? (
          <div className={styles.claimState}>
            <strong>No Keeper is registered to this wallet yet.</strong>
            <span>
              If you were named very recently, the registry may simply be
              waiting for its next sync.
            </span>
            {address ? (
              <button type="button" onClick={() => loadKeeper(address)} disabled={busy}>
                CHECK AGAIN
              </button>
            ) : null}
          </div>
        ) : (
          <div className={styles.profileEditor}>
            <div className={styles.yourKeeper}>
              <span>YOUR SOULBOUND MARK</span>
              <strong>Keeper of Toby {keeperEdition(keeper.tokenId)}</strong>
            </div>

            <label>
              <span>X HANDLE</span>
              <div>
                <b>@</b>
                <input
                  value={xHandle}
                  onChange={(event) => setXHandle(event.target.value)}
                  placeholder="yourhandle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  maxLength={32}
                />
              </div>
            </label>

            <label>
              <span>TELEGRAM HANDLE</span>
              <div>
                <b>@</b>
                <input
                  value={telegramHandle}
                  onChange={(event) => setTelegramHandle(event.target.value)}
                  placeholder="yourhandle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  maxLength={32}
                />
              </div>
            </label>

            <button
              type="button"
              className={styles.save}
              disabled={busy || !dirty}
              onClick={save}
            >
              {status === "saving"
                ? "SIGNING THE MARK…"
                : dirty
                  ? "SAVE KEEPER MARK"
                  : "MARK SAVED"}
            </button>

            {message ? (
              <p className={status === "error" ? styles.error : styles.success}>
                {message}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
