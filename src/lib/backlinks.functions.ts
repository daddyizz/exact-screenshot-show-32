import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeActivity } from "./operations.server";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  const parsed = new URL(trimmed);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs are allowed');
  parsed.hash = '';
  return parsed.toString();
}

export const listOwnedBacklinkSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data, error } = await admin
      .from("owned_backlink_sites")
      .select("id,name,url,topics,anchor_hint,enabled,created_at,updated_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { sites: data ?? [] };
  });

const siteSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  url: z.string().trim().url().max(500),
  topics: z.string().trim().min(2).max(1000),
  anchorHint: z.string().trim().max(120).optional().default(""),
  enabled: z.boolean().default(true),
});

export const saveOwnedBacklinkSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => siteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = {
      name: data.name,
      url: normalizeUrl(data.url),
      topics: data.topics,
      anchor_hint: data.anchorHint || null,
      enabled: data.enabled,
      created_by: context.userId,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (data.id) {
      result = await admin.from("owned_backlink_sites").update(row).eq("id", data.id).select("id").single();
    } else {
      result = await admin.from("owned_backlink_sites").insert(row).select("id").single();
    }
    if (result.error) throw new Error(result.error.message);

    await writeActivity(admin, {
      actorUserId: context.userId,
      eventType: data.id ? "admin.backlink_site_updated" : "admin.backlink_site_created",
      entityType: "owned_backlink_site",
      entityId: result.data.id,
      message: data.id ? "Owned backlink site updated" : "Owned backlink site added",
      metadata: { name: data.name, url: row.url, enabled: data.enabled },
    });
    return { ok: true, id: result.data.id };
  });

export const deleteOwnedBacklinkSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const lookup = await admin.from("owned_backlink_sites").select("name,url").eq("id", data.id).maybeSingle();
    const { error } = await admin.from("owned_backlink_sites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeActivity(admin, {
      actorUserId: context.userId,
      eventType: "admin.backlink_site_deleted",
      entityType: "owned_backlink_site",
      entityId: data.id,
      message: "Owned backlink site removed",
      metadata: lookup.data ?? {},
    });
    return { ok: true };
  });
