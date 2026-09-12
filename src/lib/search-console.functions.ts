import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { googleCreds, tokenExpiry } from "./blogger.server";
import { writeActivity } from "./operations.server";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GSC_SITES_URL = "https://www.googleapis.com/webmasters/v3/sites";

type GscSite = { siteUrl: string; permissionLevel: string };
type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

function gscRedirectUri(requested?: string) {
  const configured = process.env["GSC_REDIRECT_URI"]?.trim();
  if (configured) return configured;
  if (requested) return requested;
  throw new Error("Search Console is not configured yet (missing redirect URI).");
}

function buildGscAuthUrl(redirectUri: string, state: string) {
  const { clientId } = googleCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGscCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleCreds();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Google Search Console sign-in failed: ${detail}`);
  }
  return (await response.json()) as TokenResponse;
}

async function refreshGscToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleCreds();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("Search Console authorization expired. Reconnect Google Search Console.");
  return (await response.json()) as TokenResponse;
}

async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const response = await fetch(GSC_SITES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Could not read Search Console properties: ${detail}`);
  }
  const payload = (await response.json()) as { siteEntry?: GscSite[] };
  return (payload.siteEntry ?? []).sort((a, b) => a.siteUrl.localeCompare(b.siteUrl));
}

async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  input: { startDate: string; endDate: string; dimensions?: string[]; rowLimit?: number },
): Promise<SearchRow[]> {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: input.dimensions ?? [],
        rowLimit: input.rowLimit ?? 10,
      }),
    },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Search Console analytics request failed: ${detail}`);
  }
  const payload = (await response.json()) as { rows?: SearchRow[] };
  return payload.rows ?? [];
}

function analyticsWindow() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function getAdminConnection(admin: any, userId: string) {
  const { data, error } = await admin
    .from("search_console_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function getUsableAccessToken(admin: any, row: any, userId: string) {
  if (!row) throw new Error("Search Console is not connected.");
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null;
  if (expiresAt && expiresAt > new Date(Date.now() + 60_000)) return row.access_token as string;
  if (!row.refresh_token) throw new Error("Search Console authorization expired. Reconnect Google Search Console.");

  const refreshed = await refreshGscToken(row.refresh_token);
  const nextExpiry = tokenExpiry(refreshed.expires_in);
  const { error } = await admin
    .from("search_console_connections")
    .update({ access_token: refreshed.access_token, token_expires_at: nextExpiry, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return refreshed.access_token;
}

export const startSearchConsoleAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ redirectUri: z.string().url().optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const redirectUri = gscRedirectUri(data.redirectUri);
    const state = btoa(JSON.stringify({ userId: context.userId, nonce: crypto.randomUUID() }));
    return { url: buildGscAuthUrl(redirectUri, state), redirectUri };
  });

export const completeSearchConsoleAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(1), state: z.string().min(1), redirectUri: z.string().url().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let state: { userId: string };
    try {
      state = z.object({ userId: z.string().uuid() }).passthrough().parse(JSON.parse(atob(data.state)));
    } catch {
      throw new Error("Invalid Search Console authorization state.");
    }
    if (state.userId !== context.userId) throw new Error("Search Console authorization state does not match this admin account.");

    const redirectUri = gscRedirectUri(data.redirectUri);
    const tokens = await exchangeGscCode(data.code, redirectUri);
    const sites = await listGscSites(tokens.access_token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const existing = await getAdminConnection(admin, context.userId);
    const selected = existing?.selected_site_url && sites.some((s) => s.siteUrl === existing.selected_site_url)
      ? sites.find((s) => s.siteUrl === existing.selected_site_url)!
      : sites[0] ?? null;

    const { error } = await admin.from("search_console_connections").upsert({
      user_id: context.userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
      token_expires_at: tokenExpiry(tokens.expires_in),
      selected_site_url: selected?.siteUrl ?? null,
      selected_permission_level: selected?.permissionLevel ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    await writeActivity(admin, {
      userId: context.userId,
      actorUserId: context.userId,
      eventType: existing ? "gsc.reconnected" : "gsc.connected",
      entityType: "system",
      message: existing ? "Google Search Console reconnected" : "Google Search Console connected",
      metadata: { propertyCount: sites.length, selectedSiteUrl: selected?.siteUrl ?? null },
    });

    return { sites, selectedSiteUrl: selected?.siteUrl ?? null };
  });

export const disconnectSearchConsole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.from("search_console_connections").delete().eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await writeActivity(admin, {
      userId: context.userId,
      actorUserId: context.userId,
      eventType: "gsc.disconnected",
      entityType: "system",
      message: "Google Search Console disconnected",
    });
    return { ok: true };
  });

export const selectSearchConsoleProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ siteUrl: z.string().min(1), permissionLevel: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = await getAdminConnection(admin, context.userId);
    const accessToken = await getUsableAccessToken(admin, row, context.userId);
    const sites = await listGscSites(accessToken);
    const selected = sites.find((s) => s.siteUrl === data.siteUrl);
    if (!selected) throw new Error("That Search Console property is no longer available to this Google account.");
    const { error } = await admin.from("search_console_connections").update({
      selected_site_url: selected.siteUrl,
      selected_permission_level: selected.permissionLevel,
      updated_at: new Date().toISOString(),
    }).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await writeActivity(admin, {
      userId: context.userId,
      actorUserId: context.userId,
      eventType: "gsc.property_selected",
      entityType: "system",
      message: "Search Console property selected",
      metadata: { siteUrl: selected.siteUrl, permissionLevel: selected.permissionLevel },
    });
    return { ok: true };
  });

export const getSearchConsoleDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = await getAdminConnection(admin, context.userId);
    if (!row) return { connected: false as const, sites: [], selectedSiteUrl: null, selectedPermissionLevel: null, range: null, metrics: null, topQueries: [], topPages: [] };

    const accessToken = await getUsableAccessToken(admin, row, context.userId);
    const sites = await listGscSites(accessToken);
    let selected = sites.find((s) => s.siteUrl === row.selected_site_url) ?? sites[0] ?? null;
    if (!selected) return { connected: true as const, sites, selectedSiteUrl: null, selectedPermissionLevel: null, range: analyticsWindow(), metrics: null, topQueries: [], topPages: [] };

    if (selected.siteUrl !== row.selected_site_url) {
      await admin.from("search_console_connections").update({
        selected_site_url: selected.siteUrl,
        selected_permission_level: selected.permissionLevel,
        updated_at: new Date().toISOString(),
      }).eq("user_id", context.userId);
    }

    const range = analyticsWindow();
    const [totalsRows, queryRows, pageRows] = await Promise.all([
      querySearchAnalytics(accessToken, selected.siteUrl, { ...range, rowLimit: 1 }),
      querySearchAnalytics(accessToken, selected.siteUrl, { ...range, dimensions: ["query"], rowLimit: 10 }),
      querySearchAnalytics(accessToken, selected.siteUrl, { ...range, dimensions: ["page"], rowLimit: 10 }),
    ]);
    const totals = totalsRows[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    return {
      connected: true as const,
      sites,
      selectedSiteUrl: selected.siteUrl,
      selectedPermissionLevel: selected.permissionLevel,
      range,
      metrics: {
        clicks: totals.clicks ?? 0,
        impressions: totals.impressions ?? 0,
        ctr: totals.ctr ?? 0,
        position: totals.position ?? 0,
      },
      topQueries: queryRows.map((row) => ({
        query: row.keys?.[0] ?? "",
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      })),
      topPages: pageRows.map((row) => ({
        page: row.keys?.[0] ?? "",
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      })),
    };
  });
