type AffiliateLink = {
  id: string;
  name: string;
  destination_url: string;
  platform: string;
  link_type: "product" | "category";
  category: string | null;
  keywords: string;
  cta_text: string;
  short_code: string;
  priority: number;
  enabled: boolean;
};

type AffiliatePromptSettings = {
  enabled: boolean;
  delay_seconds: number;
  close_snooze_minutes: number;
  clicked_cooldown_hours: number;
};

function tokens(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length >= 3);
}

function containsToken(haystack: string, token: string) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

export async function selectAffiliateForPost(post: any): Promise<AffiliateLink | null> {
  if (!post?.blogs?.affiliate_recommendations_enabled) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const result = await admin
    .from("affiliate_links")
    .select("id,name,destination_url,platform,link_type,category,keywords,cta_text,short_code,priority,enabled")
    .eq("enabled", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  if (result.error) throw new Error(result.error.message);

  const haystack = [post.title, post.seo_title, post.keywords, post.outline, post.body]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let best: { link: AffiliateLink; score: number } | null = null;
  for (const raw of result.data ?? []) {
    const link = raw as AffiliateLink;
    let score = 0;
    for (const token of tokens(link.keywords)) {
      if (containsToken(haystack, token)) score += link.link_type === "product" ? 4 : 2;
    }
    const category = link.category?.trim().toLowerCase();
    if (category && containsToken(haystack, category)) score += link.link_type === "product" ? 2 : 3;
    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && link.priority < best.link.priority)) best = { link, score };
  }
  return best?.link ?? null;
}

export async function getAffiliatePromptSettings(): Promise<AffiliatePromptSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const result = await admin
    .from("affiliate_prompt_settings")
    .select("enabled,delay_seconds,close_snooze_minutes,clicked_cooldown_hours")
    .eq("singleton", true)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return {
    enabled: Boolean(result.data?.enabled),
    delay_seconds: Number(result.data?.delay_seconds ?? 8),
    close_snooze_minutes: Number(result.data?.close_snooze_minutes ?? 30),
    clicked_cooldown_hours: Number(result.data?.clicked_cooldown_hours ?? 24),
  };
}

export function affiliateMarkdown(link: AffiliateLink, origin: string) {
  const base = origin.replace(/\/$/, "");
  return `\n\n---\n\n**Recommended deal:** [${link.cta_text}](${base}/go/${link.short_code})`;
}

export function affiliateWidgetScript(link: AffiliateLink, origin: string) {
  const base = origin.replace(/\/$/, "");
  return `<script async src="${base}/api/public/affiliate-widget?code=${encodeURIComponent(link.short_code)}"></script>`;
}
