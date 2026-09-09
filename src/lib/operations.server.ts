type AdminClient = any;

function missingObservabilitySchema(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("activity_logs") ||
    message.includes("autopilot_runs") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

export async function writeActivity(
  admin: AdminClient,
  input: {
    userId?: string | null;
    actorUserId?: string | null;
    eventType: string;
    entityType?: string | null;
    entityId?: string | null;
    status?: "success" | "failed" | "info";
    message?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const result = await admin.from("activity_logs").insert({
    user_id: input.userId ?? null,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    status: input.status ?? "success",
    message: input.message ?? null,
    metadata: input.metadata ?? {},
  });
  if (result.error && !missingObservabilitySchema(result.error)) {
    console.error("Activity log write failed", result.error);
  }
}

export async function writeAutopilotRun(
  admin: AdminClient,
  input: {
    userId?: string | null;
    blogId: string;
    postId?: string | null;
    triggerSource: "scheduled" | "manual" | "dashboard";
    status: "skipped" | "drafted" | "published" | "error";
    detail?: string | null;
    publishedUrl?: string | null;
    startedAt?: string;
  },
) {
  const result = await admin.from("autopilot_runs").insert({
    user_id: input.userId ?? null,
    blog_id: input.blogId,
    post_id: input.postId ?? null,
    trigger_source: input.triggerSource,
    status: input.status,
    detail: input.detail ?? null,
    published_url: input.publishedUrl ?? null,
    started_at: input.startedAt ?? new Date().toISOString(),
    finished_at: new Date().toISOString(),
  });
  if (result.error && !missingObservabilitySchema(result.error)) {
    console.error("Autopilot run log write failed", result.error);
  }
}

export { missingObservabilitySchema };
