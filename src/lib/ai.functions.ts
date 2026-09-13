import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { blogContext, chatComplete, extractJson, generateImage, slugifyServer } from "./ai.server";
import { writeActivity } from "./operations.server";

function missingUsageRpc(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("consume_ai_") || message.includes("refund_ai_") || message.includes("schema cache") || message.includes("could not find the function");
}

function missingEntitlementSchema(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("user_subscriptions") || message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table");
}

function meta150(value?: string | null) {
  const text = value?.trim();
  if (!text) return null;
  if (text.length <= 150) return text;
  return `${text.slice(0, 147).trimEnd()}...`;
}

function deriveOutlineFromMarkdown(body?: string | null) {
  if (!body) return null;
  const headings = body
    .split(/\r?\n/)
    .map((line) => line.match(/^#{2,3}\s+(.+?)\s*#*$/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
  if (headings.length === 0) return null;
  return headings.slice(0, 8).join("\n");
}

function imageAspectInstruction(blog: any) {
  const ratio = blog.ai_image_aspect_ratio ?? "16:9";
  if (ratio === "custom") {
    const width = Number(blog.ai_image_custom_width ?? 0);
    const height = Number(blog.ai_image_custom_height ?? 0);
    if (width >= 320 && height >= 320) return `Use a ${width}x${height} canvas/composition (${width}:${height} aspect ratio).`;
    return "Use a wide 16:9 landscape composition.";
  }
  if (ratio === "4:3") return "Use a 4:3 landscape composition.";
  if (ratio === "1:1") return "Use a square 1:1 composition.";
  return "Use a wide 16:9 landscape composition.";
}

function imageStyleInstruction(blog: any) {
  switch (blog.ai_image_style ?? "auto") {
    case "realistic": return "Style: realistic, photorealistic editorial photography with natural lighting and believable detail.";
    case "2d": return "Style: polished 2D editorial illustration with clean shapes, depth and professional visual hierarchy.";
    case "3d": return "Style: premium 3D rendered editorial artwork with realistic materials, lighting and depth.";
    default: return "Style: automatically choose the most suitable professional visual treatment for the article topic.";
  }
}

async function consumeUsage(kind: "draft" | "image", userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const userResult = await admin.auth.admin.getUserById(userId);
  if (userResult.error) throw new Error(userResult.error.message);
  const user = userResult.data?.user;
  if (!user) throw new Error("User not found");
  const app = user.app_metadata ?? {};

  let dbPlan: string | null = null;
  let dbStatus: string | null = null;
  const subscription = await admin.from("user_subscriptions").select("plan,status").eq("user_id", userId).maybeSingle();
  if (subscription.error && !missingEntitlementSchema(subscription.error)) throw new Error(subscription.error.message);
  if (!subscription.error && subscription.data) { dbPlan = subscription.data.plan; dbStatus = subscription.data.status; }

  const roleResult = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (roleResult.error) throw new Error(roleResult.error.message);
  const isAdmin = (roleResult.data ?? []).some((row: any) => row.role === "admin");

  const metadataPlan = app.blogpilot_plan === "pro" || app.blogpilot_plan === "free" ? app.blogpilot_plan : null;
  const metadataStatus = ["active", "trialing", "past_due", "canceled", "suspended"].includes(app.blogpilot_subscription_status) ? app.blogpilot_subscription_status : null;
  const rawPlan = dbPlan ?? metadataPlan ?? (isAdmin ? "pro" : "free");
  const status = dbStatus ?? metadataStatus ?? "active";
  const entitled = rawPlan === "pro" && ["active", "trialing"].includes(status);

  if (kind === "image" && !entitled) throw new Error("AI cover images are available on the Pro plan.");

  const fn = kind === "draft" ? "consume_ai_draft_usage" : "consume_ai_image_usage";
  const rpc = await admin.rpc(fn, { p_user_id: userId });
  if (!rpc.error) return { storage: "database" as const };
  if (!missingUsageRpc(rpc.error)) throw new Error(rpc.error.message);

  const month = new Date().toISOString().slice(0, 7);
  const usageMonth = app.blogpilot_usage_month === month ? month : null;
  const drafts = usageMonth ? Number(app.blogpilot_ai_drafts ?? 0) : 0;
  const images = usageMonth ? Number(app.blogpilot_ai_images ?? 0) : 0;
  if (kind === "draft" && !entitled && drafts >= 5) throw new Error("Free plan limit reached: 5 AI drafts per month. Upgrade to Pro for unlimited drafts.");

  const updated = await admin.auth.admin.updateUserById(userId, { app_metadata: { ...app, blogpilot_usage_month: month, blogpilot_ai_drafts: kind === "draft" ? drafts + 1 : drafts, blogpilot_ai_images: kind === "image" ? images + 1 : images } });
  if (updated.error) throw new Error(updated.error.message);
  return { storage: "metadata" as const };
}

async function refundUsage(kind: "draft" | "image", userId: string, storage: "database" | "metadata") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  if (storage === "database") {
    const fn = kind === "draft" ? "refund_ai_draft_usage" : "refund_ai_image_usage";
    const refund = await admin.rpc(fn, { p_user_id: userId });
    if (!refund.error) return;
    if (!missingUsageRpc(refund.error)) { console.error("AI usage refund failed", refund.error); return; }
  }

  const userResult = await admin.auth.admin.getUserById(userId);
  if (userResult.error || !userResult.data?.user) { if (userResult.error) console.error("AI metadata refund lookup failed", userResult.error); return; }
  const user = userResult.data.user;
  const app = user.app_metadata ?? {};
  const month = new Date().toISOString().slice(0, 7);
  if (app.blogpilot_usage_month !== month) return;
  const drafts = Math.max(Number(app.blogpilot_ai_drafts ?? 0) - (kind === "draft" ? 1 : 0), 0);
  const images = Math.max(Number(app.blogpilot_ai_images ?? 0) - (kind === "image" ? 1 : 0), 0);
  const updated = await admin.auth.admin.updateUserById(userId, { app_metadata: { ...app, blogpilot_ai_drafts: drafts, blogpilot_ai_images: images } });
  if (updated.error) console.error("AI metadata refund failed", updated.error);
}

export const generateTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ blogId: z.string().uuid(), count: z.number().min(1).max(10).default(5) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: blog, error: blogError } = await supabase.from("blogs").select("*").eq("id", data.blogId).maybeSingle();
    if (blogError) throw new Error(blogError.message);
    if (!blog) throw new Error("Blog not found");
    const { data: existing } = await supabase.from("posts").select("title").eq("blog_id", data.blogId).limit(100);
    const taken = (existing ?? []).map((p) => p.title);
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    try {
      const raw = await chatComplete([
        { role: "system", content: "You are an SEO content strategist. Reply with JSON only — no prose, no markdown fences." },
        { role: "user", content: `${blogContext(blog)}\n\nPropose ${data.count} new blog post ideas with genuine search demand for this audience.\nAvoid these existing titles: ${taken.length ? taken.join(" | ") : "(none)"}.\nWrite everything in the blog's language.\n\nReturn a JSON array where each item is:\n{"title": string (max 65 chars), "outline": string (3-5 H2 sections separated by newlines), "seo_title": string (max 60 chars), "meta_description": string (max 150 chars), "keywords": string (comma separated, 3-6 terms)}` },
      ]);
      const ideas = extractJson<Array<{ title: string; outline?: string; seo_title?: string; meta_description?: string; keywords?: string }>>(raw);
      const lowerTaken = new Set(taken.map((t) => t.trim().toLowerCase()));
      const rows = ideas.filter((idea) => idea?.title && !lowerTaken.has(idea.title.trim().toLowerCase())).map((idea) => ({ user_id: userId, blog_id: data.blogId, title: idea.title.trim(), slug: slugifyServer(idea.title), outline: idea.outline ?? null, seo_title: idea.seo_title ?? null, meta_description: meta150(idea.meta_description), keywords: idea.keywords ?? null, status: "idea" }));
      if (rows.length === 0) {
        await writeActivity(admin,{userId,eventType:"ai.topics_generated",entityType:"blog",entityId:data.blogId,status:"info",message:"AI topic planning completed with no new topics",metadata:{requested:data.count,inserted:0}});
        return { inserted: 0 };
      }
      const { error } = await supabase.from("posts").insert(rows);
      if (error) throw new Error(error.message);
      await writeActivity(admin,{userId,eventType:"ai.topics_generated",entityType:"blog",entityId:data.blogId,message:`AI added ${rows.length} topic${rows.length===1?"":"s"}`,metadata:{requested:data.count,inserted:rows.length}});
      return { inserted: rows.length };
    } catch (error:any) {
      await writeActivity(admin,{userId,eventType:"ai.topics_failed",entityType:"blog",entityId:data.blogId,status:"failed",message:"AI topic planning failed",metadata:{error:String(error?.message??error).slice(0,500)}});
      throw error;
    }
  });

export const generateArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: post, error: postError } = await supabase.from("posts").select("*, blogs(*)").eq("id", data.postId).maybeSingle();
    if (postError) throw new Error(postError.message);
    if (!post || !post.blogs) throw new Error("Post not found");
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const reservation = await consumeUsage("draft", userId);
    try {
      const blog = post.blogs;
      const raw = await chatComplete([
        { role: "system", content: "You are an expert SEO blog writer. Reply with JSON only — no prose, no markdown fences." },
        { role: "user", content: `${blogContext(blog)}\n\nWrite a complete, original blog article.\nTitle: ${post.title}\n${post.outline ? `Outline to follow:\\n${post.outline}` : ""}\nTarget length: about ${blog.article_length} words.\nUse clear H2/H3 markdown headings, short paragraphs, and a natural keyword spread. No fluff, no invented statistics.\n\nReturn JSON:\n{"body": string (markdown article), "seo_title": string (max 60 chars), "meta_description": string (max 150 chars), "keywords": string (comma separated)}` },
      ]);
      const article = extractJson<{ body: string; seo_title?: string; meta_description?: string; keywords?: string }>(raw);
      const generatedOutline = post.outline?.trim() ? post.outline : deriveOutlineFromMarkdown(article.body);
      const { error } = await supabase.from("posts").update({ body: article.body, outline: generatedOutline, seo_title: article.seo_title ?? post.seo_title, meta_description: meta150(article.meta_description) ?? meta150(post.meta_description), keywords: article.keywords ?? post.keywords, status: "drafted" }).eq("id", data.postId);
      if (error) throw new Error(error.message);
      await writeActivity(admin,{userId,eventType:post.body?"ai.article_rewritten":"ai.article_generated",entityType:"post",entityId:data.postId,message:post.body?"AI article rewritten":"AI article generated",metadata:{blogId:post.blog_id,title:post.title,usageStorage:reservation.storage}});
      return { ok: true };
    } catch (error:any) {
      await refundUsage("draft", userId, reservation.storage);
      await writeActivity(admin,{userId,eventType:"ai.article_failed",entityType:"post",entityId:data.postId,status:"failed",message:"AI article generation failed; usage refunded",metadata:{blogId:post.blog_id,title:post.title,usageStorage:reservation.storage,error:String(error?.message??error).slice(0,500)}});
      throw error;
    }
  });

export const generateFeaturedImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: post, error: postError } = await supabase.from("posts").select("id, title, keywords, blog_id, image_url, blogs(*)").eq("id", data.postId).maybeSingle();
    if (postError) throw new Error(postError.message);
    if (!post || !post.blogs) throw new Error("Post not found");
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const reservation = await consumeUsage("image", userId);
    try {
      const blog = post.blogs as any;
      const prompt = [
        `Create a professional, eye-catching featured image for an article titled "${post.title}".`,
        `Blog: ${blog.name}. Niche: ${blog.niche}.`,
        post.keywords ? `Related keywords: ${post.keywords}.` : null,
        imageAspectInstruction(blog),
        imageStyleInstruction(blog),
        "No text, captions, logos, UI, borders or watermarks. Make the main subject clear on mobile and suitable for a professional blog cover.",
      ].filter(Boolean).join(" ");
      const dataUrl = await generateImage(prompt);
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const path = `${data.postId}.png`;
      const { error: uploadError } = await admin.storage.from("post-images").upload(path, bytes, { contentType: "image/png", upsert: true });
      if (uploadError) throw new Error(uploadError.message);
      const imageUrl = `/api/public/post-image/${data.postId}`;
      const { error } = await supabase.from("posts").update({ image_url: imageUrl }).eq("id", data.postId);
      if (error) throw new Error(error.message);
      await writeActivity(admin,{userId,eventType:post.image_url?"ai.image_regenerated":"ai.image_generated",entityType:"post",entityId:data.postId,message:post.image_url?"AI featured image regenerated":"AI featured image generated",metadata:{blogId:post.blog_id,title:post.title,usageStorage:reservation.storage,aspectRatio:blog.ai_image_aspect_ratio??"16:9",imageStyle:blog.ai_image_style??"auto"}});
      return { imageUrl };
    } catch (error:any) {
      await refundUsage("image", userId, reservation.storage);
      await writeActivity(admin,{userId,eventType:"ai.image_failed",entityType:"post",entityId:data.postId,status:"failed",message:"AI featured image generation failed; usage refunded",metadata:{blogId:post.blog_id,title:post.title,usageStorage:reservation.storage,error:String(error?.message??error).slice(0,500)}});
      throw error;
    }
  });

export const probeAiActivityLogging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    await writeActivity(admin, {
      userId: context.userId,
      eventType: "ai.logging_probe",
      entityType: "system",
      status: "success",
      message: "AI activity logging probe succeeded",
      metadata: { version: "ai-log-v1", quotaUsed: false, providerCalled: false },
    });
    return { ok: true, version: "ai-log-v1" };
  });
