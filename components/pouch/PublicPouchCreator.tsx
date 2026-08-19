"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import {
  POUCH_THEMES,
  makeEditSecret,
  readLocalPouchEditor,
  rememberLocalPouchEditor,
  rememberPublicPouchProfile,
  type LocalPouchEditor,
  type PouchTheme,
  type PublicPouchProfile,
} from "@/lib/pouch-profile";

function absoluteProfileUrl(slug: string) {
  if (typeof window === "undefined") return `/p/${slug}`;
  return `${window.location.origin}/p/${slug}`;
}

export default function PublicPouchCreator({
  walletAddress,
  initialProfile,
  initialEditor,
  compact = false,
}: {
  walletAddress: Address;
  initialProfile?: PublicPouchProfile | null;
  initialEditor?: LocalPouchEditor | null;
  compact?: boolean;
}) {
  const [editor, setEditor] = useState<LocalPouchEditor | null>(initialEditor || null);
  const [profile, setProfile] = useState<PublicPouchProfile | null>(initialProfile || null);
  const [editing, setEditing] = useState(Boolean(initialEditor && initialProfile));
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const [pageName, setPageName] = useState(initialProfile?.pageName || "My Tobyworld Pouch");
  const [description, setDescription] = useState(initialProfile?.description || "");
  const [theme, setTheme] = useState<PouchTheme>(initialProfile?.theme || "pond");
  const [featuredDeed, setFeaturedDeed] = useState(initialProfile?.featuredDeed || "");
  const [showWallet, setShowWallet] = useState(initialProfile?.showWallet !== false);
  const [xUrl, setXUrl] = useState(initialProfile?.xUrl || "");
  const [farcasterUrl, setFarcasterUrl] = useState(initialProfile?.farcasterUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(initialProfile?.websiteUrl || "");

  useEffect(() => {
    if (initialEditor) return;
    const stored = readLocalPouchEditor(walletAddress);
    if (stored) setEditor(stored);
  }, [initialEditor, walletAddress]);

  const publicUrl = useMemo(
    () => (editor?.slug ? absoluteProfileUrl(editor.slug) : ""),
    [editor?.slug],
  );

  function body(secret: string, action: "create" | "update") {
    return {
      action,
      secret,
      slug: editor?.slug,
      walletAddress,
      pageName,
      description,
      theme,
      featuredDeed,
      showWallet,
      xUrl,
      farcasterUrl,
      websiteUrl,
    };
  }

  async function createPage() {
    if (busy) return;
    setBusy("create");
    setMessage("Creating your public Pouch…");

    const secret = makeEditSecret();

    try {
      const response = await fetch("/api/pouch/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body(secret, "create")),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok || !result?.slug) {
        throw new Error(result?.error || "The page could not be created.");
      }

      const nextEditor = { slug: result.slug as string, secret };
      const nextProfile: PublicPouchProfile = {
        slug: result.slug,
        walletAddress,
        pageName,
        description: description || null,
        theme,
        featuredDeed: featuredDeed || null,
        showWallet,
        verified: false,
        xUrl: xUrl || null,
        farcasterUrl: farcasterUrl || null,
        websiteUrl: websiteUrl || null,
        createdAt: null,
        updatedAt: new Date().toISOString(),
      };

      rememberLocalPouchEditor(walletAddress, nextEditor);
      rememberPublicPouchProfile(nextProfile);
      setEditor(nextEditor);
      setProfile(nextProfile);
      setEditing(true);
      setMessage("Public Pouch created. This browser now holds its private edit key.");
    } catch (error: any) {
      setMessage(error?.message || "The public Pouch could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function savePage() {
    if (!editor || busy) return;
    setBusy("save");
    setMessage("Saving…");

    try {
      const response = await fetch("/api/pouch/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body(editor.secret, "update")),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "The page could not be saved.");
      }

      const nextProfile: PublicPouchProfile = {
        slug: editor.slug,
        walletAddress,
        pageName: pageName.trim() || "My Tobyworld Pouch",
        description: description.trim() || null,
        theme,
        featuredDeed: featuredDeed.trim() || null,
        showWallet,
        verified: profile?.verified || false,
        xUrl: xUrl.trim() || null,
        farcasterUrl: farcasterUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        createdAt: profile?.createdAt || null,
        updatedAt: new Date().toISOString(),
      };

      rememberPublicPouchProfile(nextProfile);
      setProfile(nextProfile);
      setMessage("Saved ✓");
      window.setTimeout(() => setMessage(""), 2600);
    } catch (error: any) {
      setMessage(error?.message || "The page could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(success);
      window.setTimeout(() => setMessage(""), 2600);
    } catch {
      setMessage("Copy failed.");
    }
  }

  if (!editor && compact) {
    return (
      <div className="public-pouch-create-compact">
        <div>
          <strong>Make this a public Tobyworld page</strong>
          <span>No login. No wallet connection. You keep a private edit key in this browser.</span>
        </div>
        <button type="button" onClick={createPage} disabled={Boolean(busy)}>
          {busy ? "Creating…" : "Create page"}
        </button>
        {message ? <small>{message}</small> : null}
      </div>
    );
  }

  return (
    <section className="public-pouch-editor">
      <div className="public-pouch-editor-head">
        <div>
          <span>{editor ? "YOUR PUBLIC PAGE" : "MAKE IT YOURS"}</span>
          <h3>{editor ? "Shape your Tobyworld page" : "Create a page without an account"}</h3>
          <p>
            Your wallet stays public and read-only. Editing is controlled by a private key kept in this browser,
            not by a TobySwap login.
          </p>
        </div>
        {editor ? <span className="public-pouch-unverified">UNVERIFIED</span> : null}
      </div>

      {!editor ? (
        <button className="public-pouch-create-main" type="button" onClick={createPage} disabled={Boolean(busy)}>
          {busy ? "Creating…" : "Create my public Pouch"}
        </button>
      ) : (
        <>
          <div className="public-pouch-editor-grid">
            <label className="public-pouch-field wide">
              <span>PAGE NAME</span>
              <input value={pageName} onChange={(e) => setPageName(e.target.value.slice(0, 56))} placeholder="The Mossy Hollow" />
            </label>

            <label className="public-pouch-field wide">
              <span>SHORT DESCRIPTION</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 240))} placeholder="A quiet place in Tobyworld…" />
            </label>

            <div className="public-pouch-field wide">
              <span>THEME</span>
              <div className="public-pouch-themes">
                {POUCH_THEMES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={theme === value ? "selected" : ""}
                    onClick={() => setTheme(value)}
                  >
                    <i className={`pouch-theme-dot theme-${value}`} />
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <label className="public-pouch-field">
              <span>FEATURED LORE DEED</span>
              <input
                inputMode="numeric"
                value={featuredDeed}
                onChange={(e) => setFeaturedDeed(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="30"
              />
            </label>

            <label className="public-pouch-toggle">
              <input type="checkbox" checked={showWallet} onChange={(e) => setShowWallet(e.target.checked)} />
              <span><strong>Show wallet address</strong><small>Useful when sharing your page publicly.</small></span>
            </label>

            <label className="public-pouch-field">
              <span>X LINK</span>
              <input value={xUrl} onChange={(e) => setXUrl(e.target.value.slice(0, 220))} placeholder="https://x.com/…" />
            </label>

            <label className="public-pouch-field">
              <span>FARCASTER LINK</span>
              <input value={farcasterUrl} onChange={(e) => setFarcasterUrl(e.target.value.slice(0, 220))} placeholder="https://farcaster.xyz/…" />
            </label>

            <label className="public-pouch-field wide">
              <span>WEBSITE</span>
              <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value.slice(0, 220))} placeholder="https://…" />
            </label>
          </div>

          <div className="public-pouch-editor-actions">
            <button type="button" className="primary" onClick={savePage} disabled={Boolean(busy)}>
              {busy === "save" ? "Saving…" : "Save page"}
            </button>
            <a href={`/p/${editor.slug}`}>Open public page ↗</a>
            <button type="button" onClick={() => copy(publicUrl, "Public page link copied.")}>Copy page link</button>
            <button type="button" onClick={() => copy(editor.secret, "Private edit key copied. Keep it somewhere safe.")}>Backup edit key</button>
          </div>

          <div className="public-pouch-key-note">
            <strong>Keep your edit key.</strong>
            <span>
              If browser storage is cleared, this key is the recovery credential for editing this unverified page.
              It is never shown publicly and only its hash is stored by TobySwap.
            </span>
          </div>
        </>
      )}

      {message ? <div className="public-pouch-editor-message">{message}</div> : null}
    </section>
  );
}
