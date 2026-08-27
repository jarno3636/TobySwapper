import "server-only";

import {
  KEEPER_MAX_SUPPLY,
  keeperEdition,
  shortKeeperAddress,
  type KeeperOfTobyPublic,
  type KeeperOfTobySelf,
} from "@/lib/keeper-of-toby";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

type KeeperRow = {
  token_id: number | string;
  wallet_address: string;
  token_uri?: string | null;
  image_uri?: string | null;
  image_url?: string | null;
  named_at?: string | null;
  x_handle?: string | null;
  telegram_handle?: string | null;
  synced_at?: string | null;
};

type KeeperStateRow = {
  total_minted?: number | string | null;
  metadata_frozen?: boolean | null;
  hero_image_url?: string | null;
  artist?: string | null;
  commissioned_by?: string | null;
  synced_at?: string | null;
};

const KEEPER_SELECT =
  "token_id,wallet_address,token_uri,image_uri,image_url,named_at,x_handle,telegram_handle,synced_at";

export async function getKeeperOfTobyDirectory(): Promise<KeeperOfTobyPublic[]> {
  if (!hasSupabaseServerEnv()) return [];

  const rows = await supabaseRest<KeeperRow[]>(
    `tobyswap_keeper_of_toby?select=${KEEPER_SELECT}&order=token_id.asc&limit=${KEEPER_MAX_SUPPLY}`,
  );

  return rows.map((row) => ({
    tokenId: Number(row.token_id),
    walletDisplay: shortKeeperAddress(row.wallet_address),
    xHandle: row.x_handle || null,
    telegramHandle: row.telegram_handle || null,
    imageUrl: row.image_url || null,
    namedAt: row.named_at || null,
  }));
}

export async function getKeeperOfTobyState() {
  if (!hasSupabaseServerEnv()) {
    return {
      totalMinted: 0,
      metadataFrozen: false,
      heroImageUrl: null as string | null,
      artist: "nova100x",
      commissionedBy: "ToadGod",
      syncedAt: null as string | null,
    };
  }

  const rows = await supabaseRest<KeeperStateRow[]>(
    "tobyswap_keeper_of_toby_state?id=eq.1&select=total_minted,metadata_frozen,hero_image_url,artist,commissioned_by,synced_at&limit=1",
  ).catch(() => []);

  const row = rows[0];

  return {
    totalMinted: Number(row?.total_minted || 0),
    metadataFrozen: Boolean(row?.metadata_frozen),
    heroImageUrl: row?.hero_image_url || null,
    artist: row?.artist || "nova100x",
    commissionedBy: row?.commissioned_by || "ToadGod",
    syncedAt: row?.synced_at || null,
  };
}

export async function getKeeperOfTobySelf(walletAddress: string): Promise<KeeperOfTobySelf | null> {
  if (!hasSupabaseServerEnv()) return null;

  const wallet = walletAddress.trim().toLowerCase();
  const rows = await supabaseRest<KeeperRow[]>(
    `tobyswap_keeper_of_toby?wallet_address=eq.${encodeURIComponent(wallet)}&select=${KEEPER_SELECT}&limit=1`,
  );

  const row = rows[0];
  if (!row) return null;

  return {
    tokenId: Number(row.token_id),
    walletAddress: row.wallet_address,
    xHandle: row.x_handle || null,
    telegramHandle: row.telegram_handle || null,
  };
}

export function keeperDisplayName(keeper: KeeperOfTobyPublic) {
  return `Keeper of Toby ${keeperEdition(keeper.tokenId)}`;
}
