import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeActivity } from "./operations.server";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

export const setAffiliateCampaignEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ campaignName: z.string().trim().min(1).max(160), enabled: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const result = await admin
      .from("affiliate_links")
      .update({ enabled: data.enabled, updated_at: new Date().toISOString() })
      .eq("campaign_name", data.campaignName)
      .select("id");
    if (result.error) throw new Error(result.error.message);
    const count = result.data?.length ?? 0;
    await writeActivity(admin, {
      actorUserId: context.userId,
      eventType: data.enabled ? "admin.affiliate_campaign_enabled" : "admin.affiliate_campaign_disabled",
      entityType: "affiliate_campaign",
      message: `${data.enabled ? "Enabled" : "Disabled"} affiliate campaign ${data.campaignName}`,
      metadata: { campaignName: data.campaignName, affectedLinks: count },
    });
    return { ok: true, affected: count };
  });

export const duplicateAffiliateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ sourceCampaign: z.string().trim().min(1).max(160), newCampaign: z.string().trim().min(1).max(160) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.sourceCampaign.toLowerCase() === data.newCampaign.toLowerCase()) throw new Error("New campaign name must be different");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const existing = await admin.from("affiliate_links").select("id").eq("campaign_name", data.newCampaign).limit(1);
    if (existing.error) throw new Error(existing.error.message);
    if ((existing.data ?? []).length) throw new Error("A campaign with that name already exists");
    const source = await admin
      .from("affiliate_links")
      .select("name,destination_url,platform,link_type,category,keywords,cta_text,priority,max_clicks")
      .eq("campaign_name", data.sourceCampaign)
      .order("created_at", { ascending: true });
    if (source.error) throw new Error(source.error.message);
    if (!source.data?.length) throw new Error("Source campaign has no links");
    const rows = source.data.map((row: any) => ({
      ...row,
      campaign_name: data.newCampaign,
      enabled: false,
      click_count: 0,
      last_clicked_at: null,
      starts_at: null,
      expires_at: null,
      created_by: context.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const inserted = await admin.from("affiliate_links").insert(rows).select("id");
    if (inserted.error) throw new Error(inserted.error.message);
    const count = inserted.data?.length ?? rows.length;
    await writeActivity(admin, {
      actorUserId: context.userId,
      eventType: "admin.affiliate_campaign_duplicated",
      entityType: "affiliate_campaign",
      message: `Duplicated affiliate campaign ${data.sourceCampaign} to ${data.newCampaign}`,
      metadata: { sourceCampaign: data.sourceCampaign, newCampaign: data.newCampaign, copiedLinks: count },
    });
    return { ok: true, copied: count };
  });

export const listAffiliateCampaignSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const result = await admin
      .from("affiliate_links")
      .select("campaign_name,enabled,click_count,max_clicks,starts_at,expires_at,platform");
    if (result.error) throw new Error(result.error.message);
    const groups = new Map<string, any>();
    for (const row of result.data ?? []) {
      const name = row.campaign_name?.trim();
      if (!name) continue;
      const current = groups.get(name) ?? { name, links: 0, enabled: 0, clicks: 0, capped: 0, platforms: new Set<string>(), startsAt: null, expiresAt: null };
      current.links += 1;
      current.enabled += row.enabled ? 1 : 0;
      current.clicks += Number(row.click_count || 0);
      if (row.max_clicks && Number(row.click_count || 0) >= Number(row.max_clicks)) current.capped += 1;
      if (row.platform) current.platforms.add(row.platform);
      if (row.starts_at && (!current.startsAt || new Date(row.starts_at) < new Date(current.startsAt))) current.startsAt = row.starts_at;
      if (row.expires_at && (!current.expiresAt || new Date(row.expires_at) > new Date(current.expiresAt))) current.expiresAt = row.expires_at;
      groups.set(name, current);
    }
    return Array.from(groups.values()).map((group) => ({ ...group, platforms: Array.from(group.platforms) })).sort((a, b) => a.name.localeCompare(b.name));
  });
