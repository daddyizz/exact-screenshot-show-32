export async function createNotification(admin: any, input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  severity?: "info" | "success" | "warning" | "error";
  actionUrl?: string | null;
  actionLabel?: string | null;
  dedupeKey?: string | null;
}) {
  const { error } = await admin.from("user_notifications").upsert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    severity: input.severity ?? "info",
    action_url: input.actionUrl ?? null,
    action_label: input.actionLabel ?? null,
    dedupe_key: input.dedupeKey ?? null,
    read_at: null,
    created_at: new Date().toISOString(),
  }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: false });
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (!msg.includes("user_notifications") && !msg.includes("schema cache") && !msg.includes("does not exist")) console.error("Notification write failed", error);
  }
}
