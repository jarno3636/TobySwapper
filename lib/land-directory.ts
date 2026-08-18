export type WorldLandSummary = {
  tokenId: string;
  communityName: string | null;
  description: string | null;
  bannerTheme: "moss" | "moon" | "lotus" | "ember";
  ownerAddress: string | null;
  updatedAt: string | null;
};

let memory: { at: number; rows: WorldLandSummary[] } | null = null;
let inflight: Promise<WorldLandSummary[]> | null = null;
const MEMORY_MS = 20 * 60_000;
const SESSION_KEY = "tobyswap:world-directory:v1";

function normalizeTheme(value: unknown): WorldLandSummary["bannerTheme"] {
  return value === "moon" || value === "lotus" || value === "ember" ? value : "moss";
}

function normalizeRows(input: unknown): WorldLandSummary[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row: any) => ({
      tokenId: String(row?.token_id ?? row?.tokenId ?? ""),
      communityName: typeof (row?.community_name ?? row?.communityName) === "string" ? (row.community_name ?? row.communityName) : null,
      description: typeof row?.description === "string" ? row.description : null,
      bannerTheme: normalizeTheme(row?.banner_theme ?? row?.bannerTheme),
      ownerAddress: typeof (row?.owner_address ?? row?.ownerAddress) === "string" ? (row.owner_address ?? row.ownerAddress) : null,
      updatedAt: typeof (row?.updated_at ?? row?.updatedAt) === "string" ? (row.updated_at ?? row.updatedAt) : null,
    }))
    .filter((row) => /^\d+$/.test(row.tokenId));
}

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; rows?: unknown };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at >= MEMORY_MS) return null;
    const rows = normalizeRows(parsed.rows);
    return { at: parsed.at, rows };
  } catch { return null; }
}

function writeSession(rows: WorldLandSummary[]) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), rows })); } catch {}
}

async function fetchDirectory(): Promise<WorldLandSummary[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    let response: Response;
    if (url && key) {
      response = await fetch(
        `${url}/rest/v1/tobyswap_land_profiles?select=token_id,owner_address,community_name,description,banner_theme,updated_at&order=updated_at.desc&limit=120`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "force-cache" },
      );
    } else {
      response = await fetch("/api/land/world", { cache: "force-cache" });
    }

    if (!response.ok) return memory?.rows || [];
    const body = await response.json();
    const rows = normalizeRows(Array.isArray(body) ? body : body?.lands);
    memory = { at: Date.now(), rows };
    writeSession(rows);
    return rows;
  } catch {
    return memory?.rows || [];
  }
}

export async function readWorldLandDirectory(): Promise<WorldLandSummary[]> {
  if (memory && Date.now() - memory.at < MEMORY_MS) return memory.rows;
  const session = readSession();
  if (session) { memory = session; return session.rows; }
  if (inflight) return inflight;
  inflight = fetchDirectory().finally(() => { inflight = null; });
  return inflight;
}
