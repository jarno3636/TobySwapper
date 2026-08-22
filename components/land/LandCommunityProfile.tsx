"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { useAccount, useSignMessage } from "wagmi";
import { landProfileMessage, readPublicLandProfile, rememberPublicLandProfile, type LandBannerTheme, type LandCommunityProfile } from "@/lib/land-profile";

export default function LandCommunityProfile({
  tokenId,
  owner,
  transferNonce,
  onProfile,
}: {
  tokenId: bigint;
  owner?: Address;
  transferNonce: bigint;
  onProfile?: (profile: LandCommunityProfile | null) => void;
}) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [profile, setProfile] = useState<LandCommunityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);
  const [message, setMessage] = useState("");
  const [communityName, setCommunityName] = useState("");

  const isKeeper = useMemo(
    () => Boolean(address && owner && address.toLowerCase() === owner.toLowerCase()),
    [address, owner],
  );

  const profileBelongsToKeeper = Boolean(
    profile?.ownerAddress && owner && profile.ownerAddress.toLowerCase() === owner.toLowerCase() &&
    (profile.transferNonce == null || profile.transferNonce === transferNonce.toString()),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readPublicLandProfile(tokenId)
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setCommunityName(next?.communityName || "");
        onProfile?.(next);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tokenId, onProfile]);

  function openEditor() {
    setCommunityName(profileBelongsToKeeper ? profile?.communityName || "" : "");
    setMessage("");
    setEditing(true);
  }

  async function saveName() {
    if (!address || !owner || !isKeeper || saving || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      const timestamp = Date.now();
      const cleanName = communityName.trim().slice(0, 64);
      const current = profileBelongsToKeeper ? profile : null;
      const preservedDescription = current?.description || "";
      const preservedTheme = (current?.bannerTheme || "moss") as LandBannerTheme;
      const keeperName = current?.keeperName || "";
      const keeperSocial = current?.keeperSocial || "";
      const keeperLink = current?.keeperLink || "";
      const signedMessage = landProfileMessage({ tokenId, transferNonce, communityName: cleanName, description: preservedDescription, keeperName, keeperSocial, keeperLink, bannerTheme: preservedTheme, timestamp });
      const signature = await signMessageAsync({ message: signedMessage });
      const response = await fetch("/api/land/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: tokenId.toString(), transferNonce: transferNonce.toString(), signer: address, communityName: cleanName, description: preservedDescription, keeperName, keeperSocial, keeperLink, bannerTheme: preservedTheme, timestamp, signature }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || "The name would not settle into the land.");
      const next: LandCommunityProfile = {
        tokenId: tokenId.toString(), ownerAddress: address.toLowerCase(), transferNonce: transferNonce.toString(),
        communityName: cleanName || null, description: preservedDescription || null, keeperName: keeperName || null,
        keeperSocial: keeperSocial || null, keeperLink: keeperLink || null, bannerTheme: preservedTheme, updatedAt: new Date().toISOString(),
      };
      setProfile(next);
      rememberPublicLandProfile(next);
      onProfile?.(next);
      setEditing(false);
      setMessage("Land name saved.");
    } catch (error: any) {
      setMessage(error?.message || "The land stayed quiet.");
    } finally {
      setSaving(false);
      window.setTimeout(() => { saveLockRef.current = false; }, 3000);
    }
  }

  const displayName = loading
    ? "Listening for this land…"
    : (profileBelongsToKeeper && profile?.communityName) || `Lore Land #${tokenId.toString()}`;

  return (
    <section className="land-nameplate" aria-labelledby="land-place-name">
      <div className="land-nameplate-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none"><path d="M20 4.5 31.5 11v13L20 35.5 8.5 24V11L20 4.5Z"/><path d="M13 23.8c2.2-4.5 4.55-6.75 7.05-6.75 2.45 0 4.75 2.25 6.95 6.75"/><circle cx="20" cy="13.5" r="2.25"/></svg>
      </div>
      <div className="land-nameplate-copy">
        <span className="land-section-kicker">LORE LAND · PUBLIC DESTINATION</span>
        {editing ? (
          <div className="land-nameplate-editor">
            <label htmlFor={`land-name-${tokenId.toString()}`}>LAND NAME · KEEPER-WRITTEN</label>
            <input id={`land-name-${tokenId.toString()}`} value={communityName} maxLength={64} autoFocus onChange={(event) => setCommunityName(event.target.value)} placeholder={`Lore Land #${tokenId.toString()}`} />
            <div className="land-nameplate-editor-actions">
              <button type="button" className="land-nameplate-save" onClick={saveName} disabled={saving}>{saving ? "Signing…" : "Save name"}</button>
              <button type="button" className="land-nameplate-cancel" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            </div>
          </div>
        ) : <h1 id="land-place-name">{displayName}</h1>}
      </div>
      <div className="land-nameplate-side">
        <span className="land-nameplate-deed">DEED #{tokenId.toString()}</span>
        {isKeeper && !editing ? <button type="button" className="land-nameplate-edit" onClick={openEditor}>Edit name</button> : null}
      </div>
      {message ? <p className={`land-nameplate-message ${message === "Land name saved." ? "success" : ""}`} role="status">{message}</p> : null}
    </section>
  );
}
