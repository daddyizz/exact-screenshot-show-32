import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeActivity } from "./operations.server";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

function normalizeUrl(value: string) {
  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs are allowed');
  return parsed.toString();
}

function csvCells(line: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { out.push(current.trim()); current = ""; }
    else current += ch;
  }
  out.push(current.trim());
  return out;
}

const linkSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  destinationUrl: z.string().trim().url().max(2000),
  platform: z.enum(["shopee", "tiktok", "amazon", "other"]).default("other"),
  linkType: z.enum(["product", "category"]).default("product"),
  category: z.string().trim().max(160).optional().default(""),
  keywords: z.string().trim().min(2).max(2000),
  ctaText: z.string().trim().min(2).max(120).default("Check the latest deal"),
  priority: z.number().int().min(0).max(10000).default(100),
  enabled: z.boolean().default(true),
});

export const listAffiliateAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const [links, settings, blogs] = await Promise.all([
      admin.from("affiliate_links").select("*").order("priority", { ascending: true }).order("created_at", { ascending: false }),
      admin.from("affiliate_prompt_settings").select("*").eq("singleton", true).maybeSingle(),
      admin.from("blogs").select("id,name,url,user_id,affiliate_recommendations_enabled").is("deleted_at", null).order("created_at", { ascending: true }),
    ]);
    if (links.error) throw new Error(links.error.message);
    if (settings.error) throw new Error(settings.error.message);
    if (blogs.error) throw new Error(blogs.error.message);
    return { links: links.data ?? [], settings: settings.data ?? null, blogs: blogs.data ?? [] };
  });

export const saveAffiliateBlogSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ blogId: z.string().uuid(), enabled: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const result = await admin.from("blogs").update({ affiliate_recommendations_enabled: data.enabled }).eq("id", data.blogId).select("id,name").single();
    if (result.error) throw new Error(result.error.message);
    await writeActivity(admin, { actorUserId: context.userId, eventType: "admin.affiliate_blog_setting_updated", entityType: "blog", entityId: data.blogId, message: data.enabled ? "Affiliate recommendations enabled for blog" : "Affiliate recommendations disabled for blog", metadata: { blogName: result.data.name, enabled: data.enabled } });
    return { ok: true };
  });

export const saveAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => linkSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = {
      name: data.name,
      destination_url: normalizeUrl(data.destinationUrl),
      platform: data.platform,
      link_type: data.linkType,
      category: data.category || null,
      keywords: data.keywords,
      cta_text: data.ctaText,
      priority: data.priority,
      enabled: data.enabled,
      created_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const result = data.id
      ? await admin.from("affiliate_links").update(row).eq("id", data.id).select("id").single()
      : await admin.from("affiliate_links").insert(row).select("id").single();
    if (result.error) throw new Error(result.error.message);
    await writeActivity(admin, {
      actorUserId: context.userId,
      eventType: data.id ? "admin.affiliate_link_updated" : "admin.affiliate_link_created",
      entityType: "affiliate_link",
      entityId: result.data.id,
      message: data.id ? "Affiliate link updated" : "Affiliate link added",
      metadata: { name: data.name, platform: data.platform, linkType: data.linkType, enabled: data.enabled },
    });
    return { ok: true, id: result.data.id };
  });

export const deleteAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.from("affiliate_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeActivity(admin, { actorUserId: context.userId, eventType: "admin.affiliate_link_deleted", entityType: "affiliate_link", entityId: data.id, message: "Affiliate link removed" });
    return { ok: true };
  });

export const saveAffiliatePromptSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    enabled: z.boolean(),
    delaySeconds: z.number().int().min(0).max(120),
    closeSnoozeMinutes: z.number().int().min(1).max(1440),
    clickedCooldownHours: z.number().int().min(1).max(168),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.from("affiliate_prompt_settings").upsert({
      singleton: true,
      enabled: data.enabled,
      delay_seconds: data.delaySeconds,
      close_snooze_minutes: data.closeSnoozeMinutes,
      clicked_cooldown_hours: data.clickedCooldownHours,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "singleton" });
    if (error) throw new Error(error.message);
    await writeActivity(admin, { actorUserId: context.userId, eventType: "admin.affiliate_prompt_updated", entityType: "affiliate_prompt", message: "Affiliate prompt settings updated", metadata: data });
    return { ok: true };
  });

export const importAffiliateCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ csv: z.string().min(1).max(500000) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const lines = data.csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("CSV needs a header row and at least one item.");
    const header = csvCells(lines[0]).map((cell) => cell.toLowerCase().replace(/\s+/g, "_"));
    const index = (name: string) => header.indexOf(name);
    const required = ["name", "destination_url", "keywords"];
    for (const field of required) if (index(field) < 0) throw new Error(`CSV missing required column: ${field}`);
    const rows = [];
    for (const line of lines.slice(1)) {
      const cells = csvCells(line);
      if (!cells[index("name")] || !cells[index("destination_url")]) continue;
      const platform = (cells[index("platform")] || "other").toLowerCase();
      const linkType = (cells[index("link_type")] || "product").toLowerCase();
      rows.push({
        name: cells[index("name")],
        destination_url: normalizeUrl(cells[index("destination_url")]),
        platform: ["shopee", "tiktok", "amazon", "other"].includes(platform) ? platform : "other",
        link_type: ["product", "category"].includes(linkType) ? linkType : "product",
        category: index("category") >= 0 ? cells[index("category")] || null : null,
        keywords: cells[index("keywords")] || "",
        cta_text: index("cta_text") >= 0 ? cells[index("cta_text")] || "Check the latest deal" : "Check the latest deal",
        priority: index("priority") >= 0 ? Math.max(0, Math.min(10000, Number(cells[index("priority")]) || 100)) : 100,
        enabled: true,
        created_by: context.userId,
        updated_at: new Date().toISOString(),
      });
    }
    if (!rows.length) throw new Error("No valid affiliate rows found.");
    const result = await admin.from("affiliate_links").insert(rows).select("id");
    if (result.error) throw new Error(result.error.message);
    await writeActivity(admin, { actorUserId: context.userId, eventType: "admin.affiliate_csv_imported", entityType: "affiliate_link", message: `Imported ${result.data?.length ?? rows.length} affiliate links`, metadata: { count: result.data?.length ?? rows.length } });
    return { imported: result.data?.length ?? rows.length };
  });
