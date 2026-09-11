import { blogContext, chatCompleteJson, generateImage, slugifyServer } from "./ai.server";
import {
  createBloggerPost,
  markdownToHtml,
  refreshAccessToken,
  tokenExpiry,
} from "./blogger.server";

export const AUTOPILOT_LOCKED_DETAIL = "Another Autopilot run is already in progress for this blog.";

export type AutopilotOutcome = {
  blogId: string;
  blogName: string;
  status: "skipped" | "drafted" | "published" | "error";
  detail: string;
  postId?: string;
  url?: string;
};

function intervalMs(postsPerWeek: number) {
  const perWeek = Math.max(1, Math.min(14, postsPerWeek || 1));
  return (7 / perWeek) * 24 * 60 * 60 * 1000;
}

export function isBlogDue(blog: {
  autopilot: boolean;
  posts_per_week: number;
  autopilot_last_run_at: string | null;
}) {
  if (!blog.autopilot) return false;
  if (!blog.autopilot_last_run_at) return true;
  return Date.now() - new Date(blog.autopilot_last_run_at).getTime() >= intervalMs(blog.posts_per_week);
}

type Admin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

function missingLockRpc(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("acquire_autopilot_run_lock") || message.includes("release_autopilot_run_lock") || message.includes("schema cache") || message.includes("could not find the function");
}

async function acquireRunLock(admin: Admin, blogId: string): Promise<{ token: string | null; supported: boolean }> {
  const result = await (admin as any).rpc("acquire_autopilot_run_lock", { p_blog_id: blogId, p_stale_after_minutes: 20 });
  if (result.error) {
    if (missingLockRpc(result.error)) return { token: null, supported: false };
    throw new Error(result.error.message);
  }
  return { token: result.data ?? null, supported: true };
}

async function releaseRunLock(admin: Admin, blogId: string, token: string | null, supported: boolean) {
  if (!supported || !token) return;
  const result = await (admin as any).rpc("release_autopilot_run_lock", { p_blog_id: blogId, p_lock_token: token });
  if (result.error && !missingLockRpc(result.error)) console.error("Autopilot lock release failed", result.error);
}

function meta150(value?: string | null) {
  const text = value?.trim();
  if (!text) return null;
  if (text.length <= 150) return text;
  return `${text.slice(0, 147).trimEnd()}...`;
}

function imageAspectInstruction(blog: any) {
  const ratio = blog.ai_image_aspect_ratio ?? "16:9";
  if (ratio === "custom") {
    const width = Number(blog.ai_image_custom_width ?? 0);
    const height = Number(blog.ai_image_custom_height ?? 0);
    if (width >= 320 && height >= 320) {
      return `Use a ${width}x${height} canvas/composition (${width}:${height} aspect ratio).`;
    }
    return "Use a wide 16:9 landscape composition.";
  }
  if (ratio === "4:3") return "Use a 4:3 landscape composition.";
  if (ratio === "1:1") return "Use a square 1:1 composition.";
  return "Use a wide 16:9 landscape composition.";
}

function imageStyleInstruction(blog: any) {
  switch (blog.ai_image_style ?? "auto") {
    case "realistic":
      return "Style: realistic, photorealistic editorial photography with natural lighting and believable detail.";
    case "2d":
      return "Style: polished 2D editorial illustration with clean shapes, depth and professional visual hierarchy.";
    case "3d":
      return "Style: premium 3D rendered editorial artwork with realistic materials, lighting and depth.";
    default:
      return "Style: automatically choose the most suitable professional visual treatment for the article topic.";
  }
}

async function generateAndStoreAutopilotImage(admin: Admin, blog: any, post: any, keywords?: string | null) {
  const prompt = [
    `Create a professional, eye-catching featured image for the blog article titled "${post.title}".`,
    `Blog: ${blog.name}. Niche: ${blog.niche}.`,
    keywords ? `Related keywords: ${keywords}.` : null,
    imageAspectInstruction(blog),
    imageStyleInstruction(blog),
    "No text, captions, logos, UI, borders or watermarks. Make the main subject immediately understandable on mobile and suitable for a professional blog cover.",
  ].filter(Boolean).join(" ");

  const dataUrl = await generateImage(prompt);
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("AI image data was invalid.");
  const base64 = dataUrl.slice(comma + 1);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const path = `${post.id}.png`;
  const { error: uploadError } = await admin.storage
    .from("post-images")
    .upload(path, bytes, { contentType: "image/png", upsert: true });
  if (uploadError) throw new Error(`AI image upload failed: ${uploadError.message}`);

  const imageUrl = `/api/public/post-image/${post.id}`;
  const { error: imageUpdateError } = await admin
    .from("posts")
    .update({ image_url: imageUrl })
    .eq("id", post.id);
  if (imageUpdateError) throw new Error(imageUpdateError.message);
  return imageUrl;
}

/** Runs one autopilot cycle for a single blog: pick/create a topic, write it, generate its AI image, optionally publish. */
export async function runAutopilotForBlog(
  admin: Admin,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blog: any,
  origin?: string,
): Promise<AutopilotOutcome> {
  const base = { blogId: blog.id as string, blogName: blog.name as string };
  let lockToken: string | null = null;
  let lockSupported = false;

  try {
    const lock = await acquireRunLock(admin, blog.id);
    lockToken = lock.token;
    lockSupported = lock.supported;
    if (lockSupported && !lockToken) {
      return { ...base, status: "skipped", detail: AUTOPILOT_LOCKED_DETAIL };
    }

    // 1. Find a pending idea, or generate fresh ones.
    let { data: candidates } = await admin
      .from("posts")
      .select("id, title, outline, seo_title, meta_description, keywords, body")
      .eq("blog_id", blog.id)
      .eq("status", "idea")
      .order("created_at", { ascending: true })
      .limit(1);

    if (!candidates || candidates.length === 0) {
      const { data: existing } = await admin
        .from("posts")
        .select("title")
        .eq("blog_id", blog.id)
        .limit(100);
      const taken = (existing ?? []).map((p: { title: string }) => p.title);

      const ideas = await chatCompleteJson<
        Array<{
          title: string;
          outline?: string;
          seo_title?: string;
          meta_description?: string;
          keywords?: string;
        }>
      >([
        {
          role: "system",
          content:
            "You are an SEO content strategist. Reply with JSON only — no prose, no markdown fences.",
        },
        {
          role: "user",
          content: `${blogContext(blog)}\n\nPropose 3 new blog post ideas with genuine search demand for this audience.\nAvoid these existing titles: ${taken.length ? taken.join(" | ") : "(none)"}.\nWrite everything in the blog's language.\n\nReturn a JSON array where each item is:\n{"title": string (max 65 chars), "outline": string (3-5 H2 sections separated by newlines), "seo_title": string (max 60 chars), "meta_description": string (max 150 chars), "keywords": string (comma separated, 3-6 terms)}`,
        },
      ]);

      const lowerTaken = new Set(taken.map((t: string) => t.trim().toLowerCase()));
      const rows = ideas
        .filter((idea) => idea?.title && !lowerTaken.has(idea.title.trim().toLowerCase()))
        .map((idea) => ({
          user_id: blog.user_id,
          blog_id: blog.id,
          title: idea.title.trim(),
          slug: slugifyServer(idea.title),
          outline: idea.outline ?? null,
          seo_title: idea.seo_title ?? null,
          meta_description: meta150(idea.meta_description),
          keywords: idea.keywords ?? null,
          status: "idea",
        }));

      if (rows.length === 0) return { ...base, status: "skipped", detail: "No new topics found." };

      const { data: inserted, error } = await admin
        .from("posts")
        .insert(rows)
        .select("id, title, outline, seo_title, meta_description, keywords, body");
      if (error) throw new Error(error.message);
      candidates = inserted;
    }

    const post = candidates?.[0];
    if (!post) return { ...base, status: "skipped", detail: "Nothing to write." };

    // 2. Write the article. Malformed model JSON is automatically regenerated once.
    const article = await chatCompleteJson<{
      body: string;
      seo_title?: string;
      meta_description?: string;
      keywords?: string;
    }>([
      {
        role: "system",
        content:
          "You are an expert SEO blog writer. Reply with JSON only — no prose, no markdown fences.",
      },
      {
        role: "user",
        content: `${blogContext(blog)}\n\nWrite a complete, original blog article.\nTitle: ${post.title}\n${post.outline ? `Outline to follow:\n${post.outline}` : ""}\nTarget length: about ${blog.article_length} words.\nUse clear H2/H3 markdown headings, short paragraphs, and a natural keyword spread. No fluff, no invented statistics.\n\nReturn JSON:\n{"body": string (markdown article), "seo_title": string (max 60 chars), "meta_description": string (max 150 chars), "keywords": string (comma separated)}`,
      },
    ]);

    const finalMeta = meta150(article.meta_description) ?? meta150(post.meta_description);
    const { error: updateError } = await admin
      .from("posts")
      .update({
        body: article.body,
        seo_title: article.seo_title ?? post.seo_title,
        meta_description: finalMeta,
        keywords: article.keywords ?? post.keywords,
        status: "drafted",
      })
      .eq("id", post.id);
    if (updateError) throw new Error(updateError.message);

    // 3. Every Autopilot article gets an AI featured image before it is eligible to publish.
    const imageUrl = await generateAndStoreAutopilotImage(
      admin,
      blog,
      post,
      article.keywords ?? post.keywords,
    );
    if (!imageUrl) throw new Error("Autopilot could not create the required AI featured image.");

    // 4. Publish when enabled and Blogger is connected.
    if (!blog.autopilot_auto_publish) {
      return { ...base, status: "drafted", detail: `${post.title} (AI image ready)`, postId: post.id };
    }

    if (!origin) {
      throw new Error("Autopilot cannot publish without a public site origin for the required AI image.");
    }

    const { data: connection } = await admin
      .from("blogger_connections")
      .select("*")
      .eq("blog_id", blog.id)
      .maybeSingle();

    if (!connection?.blogger_blog_id) {
      return {
        ...base,
        status: "drafted",
        detail: `${post.title} (AI image ready; Blogger not connected)`,
        postId: post.id,
      };
    }

    let accessToken = connection.access_token ?? "";
    const expired =
      !connection.token_expires_at || new Date(connection.token_expires_at) <= new Date();
    if (expired) {
      if (!connection.refresh_token) throw new Error("Blogger connection expired. Reconnect.");
      const refreshed = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshed.access_token;
      await admin
        .from("blogger_connections")
        .update({ access_token: accessToken, token_expires_at: tokenExpiry(refreshed.expires_in) })
        .eq("id", connection.id);
    }

    const { data: fresh } = await admin
      .from("posts")
      .select("image_url, seo_title, title, keywords")
      .eq("id", post.id)
      .maybeSingle();

    if (!fresh?.image_url) {
      throw new Error("Autopilot blocked publishing because the required AI featured image is missing.");
    }

    const imageHtml = `<p><img src="${origin}${fresh.image_url}" alt="${(fresh.seo_title || fresh.title).replace(/"/g, "&quot;")}" style="max-width:100%;height:auto" /></p>\n`;

    const published = await createBloggerPost(accessToken, connection.blogger_blog_id, {
      title: article.seo_title || post.title,
      content: imageHtml + markdownToHtml(article.body),
      labels: (article.keywords ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10),
    });

    await admin
      .from("posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        blogger_post_id: published.id,
        blogger_url: published.url,
      })
      .eq("id", post.id);

    return { ...base, status: "published", detail: post.title, postId: post.id, url: published.url };
  } catch (error) {
    return {
      ...base,
      status: "error",
      detail: error instanceof Error ? error.message : "Autopilot failed.",
    };
  } finally {
    await releaseRunLock(admin, blog.id, lockToken, lockSupported);
  }
}
