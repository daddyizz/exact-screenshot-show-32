import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

function isMissingAdsSchema(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("ad_placements") || message.includes("schema cache") || message.includes("does not exist");
}

export const listAdsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("ad_placements")
      .select("id, slot_key, name, headline, body, image_url, target_url, cta_label, is_active, opens_new_tab, updated_at")
      .order("slot_key");
    if (error) {
      if (isMissingAdsSchema(error)) return { ads: [], schemaMissing: true };
      throw new Error(error.message);
    }
    return { ads: data ?? [], schemaMissing: false };
  });

const adInput = z.object({
  id: z.string().uuid().optional(),
  slotKey: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  headline: z.string().trim().min(2).max(160),
  body: z.string().trim().max(400).optional().default(""),
  imageUrl: z.string().trim().max(2048).optional().default(""),
  targetUrl: z.string().trim().min(1).max(2048),
  ctaLabel: z.string().trim().min(1).max(60),
  isActive: z.boolean(),
  opensNewTab: z.boolean(),
});

export const saveAdPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => adInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = {
      slot_key: data.slotKey,
      name: data.name,
      headline: data.headline,
      body: data.body || null,
      image_url: data.imageUrl || null,
      target_url: data.targetUrl,
      cta_label: data.ctaLabel,
      is_active: data.isActive,
      opens_new_tab: data.opensNewTab,
      updated_at: new Date().toISOString(),
    };

    const query = data.id
      ? admin.from("ad_placements").update(row).eq("id", data.id)
      : admin.from("ad_placements").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("ad_placements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
