import "server-only";

type RestInit = RequestInit & { prefer?: string };

export function hasSupabaseServerEnv() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
  );
}

function baseUrl() {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
}

function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export async function supabaseRest<T>(path: string, init: RestInit = {}): Promise<T> {
  if (!hasSupabaseServerEnv()) {
    throw new Error("Supabase server environment is not configured");
  }

  const headers = new Headers(init.headers);
  headers.set("apikey", serviceKey());
  headers.set("Authorization", `Bearer ${serviceKey()}`);
  headers.set("Content-Type", "application/json");
  if (init.prefer) headers.set("Prefer", init.prefer);

  const response = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text || response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function supabaseRpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  return supabaseRest<T>(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
