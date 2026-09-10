import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const diagnosticInput = z.object({
  severity: z.enum(["info", "warning", "error"]).default("error"),
  eventType: z.string().min(1).max(80),
  pageUrl: z.string().max(2000).optional(),
  routePath: z.string().max(500).optional(),
  message: z.string().max(4000).optional(),
  stack: z.string().max(12000).optional(),
  element: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  userAgent: z.string().max(1000).optional(),
});

function missingDiagnosticsSchema(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("website_diagnostics") || message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table");
}

export const recordWebsiteDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => diagnosticInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const safeMetadata = data.metadata ?? {};
    const { error } = await admin.from("website_diagnostics").insert({
      user_id: context.userId,
      severity: data.severity,
      event_type: data.eventType,
      page_url: data.pageUrl ?? null,
      route_path: data.routePath ?? null,
      message: data.message ?? null,
      stack: data.stack ?? null,
      element: data.element ?? null,
      metadata: safeMetadata,
      user_agent: data.userAgent ?? null,
    });
    if (error) {
      if (missingDiagnosticsSchema(error)) return { recorded: false, reason: "schema_missing" as const };
      throw new Error(error.message);
    }
    return { recorded: true as const };
  });
