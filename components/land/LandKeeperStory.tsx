"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { useAccount, useSignMessage } from "wagmi";
import { landProfileMessage, readPublicLandProfile, rememberPublicLandProfile, type LandBannerTheme, type LandCommunityProfile } from "@/lib/land-profile";

export default function LandKeeperStory({ tokenId, owner, transferNonce }: { tokenId: bigint; owner?: Address; transferNonce: bigint }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [profile, setProfile] = useState<LandCommunityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [story, setStory] = useState("");
  const [keeperName, setKeeperName] = useState("");
  const [keeperSocial, setKeeperSocial] = useState("");
  const [keeperLink, setKeeperLink] = useState("");
  const [message, setMessage] = useState("");

  const isKeeper = useMemo(() => Boolean(address && owner && address.toLowerCase() === owner.toLowerCase()), [address, owner]);
  const currentProfile = Boolean(profile?.ownerAddress && owner && profile.ownerAddress.toLowerCase() === owner.toLowerCase() && (profile.transferNonce == null || profile.transferNonce === transferNonce.toString()));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readPublicLandProfile(tokenId).then((next) => {
      if (cancelled) return;
      setProfile(next);
      if (next) {
        setStory(next.description || "");
        setKeeperName(next.keeperName || "");
        setKeeperSocial(next.keeperSocial || "");
        setKeeperLink(next.keeperLink || "");
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tokenId]);

  function beginEdit() {
    const active = currentProfile ? profile : null;
    setStory(active?.description || "");
    setKeeperName(active?.keeperName || "");
    setKeeperSocial(active?.keeperSocial || "");
    setKeeperLink(active?.keeperLink || "");
    setMessage("");
    setEditing(true);
  }

  async function save() {
    if (!address || !owner || !isKeeper || saving || lock.current) return;
    lock.current = true;
    setSaving(true);
    setMessage("");
    try {
      const active = currentProfile ? profile : null;
      const timestamp = Date.now();
      const cleanStory = story.trim().slice(0, 800);
      const cleanName = keeperName.trim().slice(0, 64);
      const cleanSocial = keeperSocial.trim().slice(0, 80);
      const cleanLink = keeperLink.trim().slice(0, 240);
      const communityName = active?.communityName || "";
      const bannerTheme = (active?.bannerTheme || "moss") as LandBannerTheme;
      const signedMessage = landProfileMessage({ tokenId, transferNonce, communityName, description: cleanStory, keeperName: cleanName, keeperSocial: cleanSocial, keeperLink: cleanLink, bannerTheme, timestamp });
      const signature = await signMessageAsync({ message: signedMessage });
      const response = await fetch("/api/land/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: tokenId.toString(), transferNonce: transferNonce.toString(), signer: address, communityName, description: cleanStory, keeperName: cleanName, keeperSocial: cleanSocial, keeperLink: cleanLink, bannerTheme, timestamp, signature }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || "The Keeper Mark could not be saved.");
      const next: LandCommunityProfile = {
        tokenId: tokenId.toString(), ownerAddress: address.toLowerCase(), transferNonce: transferNonce.toString(), communityName: communityName || null,
        description: cleanStory || null, keeperName: cleanName || null, keeperSocial: cleanSocial || null, keeperLink: cleanLink || null,
        bannerTheme, updatedAt: new Date().toISOString(),
      };
      setProfile(next);
      rememberPublicLandProfile(next);
      setEditing(false);
      setMessage("Keeper Mark saved.");
    } catch (error: any) {
      setMessage(error?.message || "The story stayed quiet.");
    } finally {
      setSaving(false);
      window.setTimeout(() => { lock.current = false; }, 2500);
    }
  }

  const visible = currentProfile ? profile : null;
  const storyText = visible?.description || "";
  const markName = visible?.keeperName || visible?.keeperSocial || "";

  return (
    <section id="keeper-mark" className="land-keeper-story scroll-mt-24" aria-labelledby="keeper-story-title">
      <div className="land-keeper-story-head">
        <div>
          <span className="land-section-kicker">KEEPER-WRITTEN</span>
          <h2 id="keeper-story-title">The Keeper&apos;s Story</h2>
          <p>A community layer written by the current keeper. Canonical signs above remain unchanged.</p>
        </div>
        {isKeeper && !editing ? <button type="button" onClick={beginEdit}>{storyText || markName ? "Edit my mark" : "Leave a Keeper Mark"}</button> : null}
      </div>

      {editing ? (
        <div className="keeper-story-editor">
          <label><span>KEEPER NAME OR PSEUDONYM</span><input value={keeperName} maxLength={64} onChange={(e) => setKeeperName(e.target.value)} placeholder="Hush, Joshua, Pondwalker…" /></label>
          <label className="keeper-story-wide"><span>THE KEEPER&apos;S STORY</span><textarea value={story} maxLength={800} onChange={(e) => setStory(e.target.value)} placeholder="What does this place mean to you? Leave a short story for visitors…" /><small>{story.length}/800</small></label>
          <label><span>X / FARCASTER / HANDLE</span><input value={keeperSocial} maxLength={80} onChange={(e) => setKeeperSocial(e.target.value)} placeholder="@keeper" /></label>
          <label><span>OPTIONAL LINK</span><input value={keeperLink} maxLength={240} onChange={(e) => setKeeperLink(e.target.value)} placeholder="https://…" autoCapitalize="off" autoCorrect="off" /></label>
          <div className="keeper-story-actions keeper-story-wide"><button type="button" onClick={save} disabled={saving}>{saving ? "Signing Keeper Mark…" : "Save Keeper Mark"}</button><button type="button" className="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</button></div>
        </div>
      ) : loading ? (
        <div className="keeper-story-empty">Listening for the keeper&apos;s mark…</div>
      ) : storyText || markName ? (
        <div className="keeper-story-public">
          {storyText ? <blockquote>{storyText}</blockquote> : <p className="keeper-story-empty-copy">This keeper has left a mark, but no story yet.</p>}
          <div className="keeper-mark-row">
            <span className="keeper-mark-sigil" aria-hidden="true">◌</span>
            <div><small>KEEPER OF #{tokenId.toString()}</small><strong>{visible?.keeperName || visible?.keeperSocial || "Current Keeper"}</strong>{visible?.keeperSocial && visible.keeperName ? <span>{visible.keeperSocial}</span> : null}</div>
            {visible?.keeperLink ? <a href={visible.keeperLink} target="_blank" rel="noreferrer">Visit ↗</a> : null}
          </div>
        </div>
      ) : (
        <div className="keeper-story-empty">
          <strong>No Keeper&apos;s Story has been left here yet.</strong>
          <p>The canonical land is complete without one. Its current keeper may add a community story whenever they choose.</p>
          {isKeeper ? <button type="button" onClick={beginEdit}>Write the first story</button> : null}
        </div>
      )}
      {message ? <p className="keeper-story-message" role="status">{message}</p> : null}
    </section>
  );
}
