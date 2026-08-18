"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { useAccount, useSignMessage } from "wagmi";
import {
  landProfileMessage,
  readPublicLandProfile,
  rememberPublicLandProfile,
  type LandBannerTheme,
  type LandCommunityProfile,
} from "@/lib/land-profile";

const themes: Array<{ id: LandBannerTheme; label: string; note: string }> = [
  { id: "moss", label: "Moss", note: "Deep green pondlight" },
  { id: "moon", label: "Moon", note: "Blue night over water" },
  { id: "lotus", label: "Lotus", note: "Soft bloom and sunrise" },
  { id: "ember", label: "Ember", note: "Warm ancient glow" },
  { id: "tide", label: "Tide", note: "Bright cyan water" },
  { id: "dusk", label: "Dusk", note: "Violet evening sky" },
  { id: "bloom", label: "Bloom", note: "Pink garden light" },
  { id: "gold", label: "Gold", note: "Warm sunlit relic" },
];

export default function LandCommunityProfile({
  tokenId,
  owner,
  onProfile,
}: {
  tokenId: bigint;
  owner?: Address;
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
  const [description, setDescription] = useState("");
  const [bannerTheme, setBannerTheme] = useState<LandBannerTheme>("moss");

  const isKeeper = useMemo(
    () => Boolean(address && owner && address.toLowerCase() === owner.toLowerCase()),
    [address, owner],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readPublicLandProfile(tokenId)
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setCommunityName(next?.communityName || "");
        setDescription(next?.description || "");
        setBannerTheme(next?.bannerTheme || "moss");
        onProfile?.(next);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tokenId, onProfile]);

  async function save() {
    if (!address || !owner || !isKeeper || saving || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      const timestamp = Date.now();
      const cleanName = communityName.trim().slice(0, 64);
      const cleanDescription = description.trim().slice(0, 280);
      const signedMessage = landProfileMessage({
        tokenId,
        communityName: cleanName,
        description: cleanDescription,
        bannerTheme,
        timestamp,
      });
      const signature = await signMessageAsync({ message: signedMessage });
      const response = await fetch("/api/land/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: tokenId.toString(),
          signer: address,
          communityName: cleanName,
          description: cleanDescription,
          bannerTheme,
          timestamp,
          signature,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || "The name would not settle into the land.");
      const next: LandCommunityProfile = {
        tokenId: tokenId.toString(),
        communityName: cleanName || null,
        description: cleanDescription || null,
        bannerTheme,
        updatedAt: new Date().toISOString(),
      };
      setProfile(next);
      rememberPublicLandProfile(next);
      onProfile?.(next);
      setEditing(false);
      setMessage("Your land now carries its community name.");
    } catch (error: any) {
      setMessage(error?.message || "The land stayed quiet.");
    } finally {
      setSaving(false);
      window.setTimeout(() => { saveLockRef.current = false; }, 3000);
    }
  }

  return (
    <section className={`land-community-card theme-${editing ? bannerTheme : (profile?.bannerTheme || bannerTheme)}`}>
      <div className="land-community-banner">
        <span className="land-community-banner-orb" />
        <span className="land-community-banner-hill h1" />
        <span className="land-community-banner-hill h2" />
        <span className="land-community-banner-water" />
        <div className="land-community-banner-copy">
          <span className="land-section-kicker">COMMUNITY LAND</span>
          <h2>{loading ? "Listening for a name…" : editing ? (communityName.trim() || `Lore Land #${tokenId.toString()}`) : (profile?.communityName || `Lore Land #${tokenId.toString()}`)}</h2>
          <p>{editing ? (description.trim() || "A quiet place in Tobyworld, waiting for its keeper to leave a mark.") : (profile?.description || "A quiet place in Tobyworld, waiting for its keeper to leave a mark.")}</p>
        </div>
      </div>

      <div className="land-community-foot">
        <div><small>KEEPER&apos;S MARK</small><strong>{profile?.communityName ? "NAMED" : "OPEN"}</strong></div>
        {isKeeper ? (
          <button type="button" className="land-community-edit" onClick={() => setEditing((value) => !value)}>
            {editing ? "Close editor" : profile ? "Edit my land" : "Name my land"}
          </button>
        ) : <span className="land-community-visitor-chip">PUBLIC PLACE</span>}
      </div>

      {editing && isKeeper && (
        <div className="land-community-editor">
          <label><span>LAND NAME</span><input value={communityName} maxLength={64} onChange={(event) => setCommunityName(event.target.value)} placeholder="The Mossy Hollow" /></label>
          <label><span>DESCRIPTION</span><textarea value={description} maxLength={280} onChange={(event) => setDescription(event.target.value)} placeholder="A small corner of the pond where the old leaves still whisper." /></label>
          <div className="land-theme-picker"><span>LAND MOOD</span><div>{themes.map((theme) => <button key={theme.id} type="button" className={bannerTheme === theme.id ? "is-selected" : ""} aria-pressed={bannerTheme === theme.id} onClick={() => setBannerTheme(theme.id)}><i className={`theme-swatch theme-${theme.id}`} /><b>{theme.label}</b><small>{theme.note}</small></button>)}</div></div>
          <button type="button" className="land-community-save" disabled={saving} onClick={save}>{saving ? "Setting the marker…" : "Save my land"}</button>
        </div>
      )}
      {message && <p className="land-community-message" role="status">{message}</p>}
    </section>
  );
}
