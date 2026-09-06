import { blogContext, chatComplete, extractJson, slugifyServer } from "./ai.server";
import {
  createBloggerPost,
  markdownToHtml,
  refreshAccessToken,
  tokenExpiry,
} from "./blogger.server";

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

/** Runs one autopilot cycle for a single blog: pick/create a topic, write it, optionally publish. */
export async function runAutopilotForBlog(
  admin: Admin,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blog: any,
  origin?: string,
): Promise<AutopilotOutcome> {
  const base = { blogId: blog.id as string, blogName: blog.name as string };

  try {
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

      const raw = await chatComplete([
        {
          role: "system",
          content:
            "You are an SEO content strategist. Reply with JSON only — no prose, no markdown fences.",
        },
        {
          role: "user",
          content: `${blogContext(blog)}

Propose 3 new blog post ideas with genuine search demand for this audience.
Avoid these existing titles: ${taken.length ? taken.join(" | ") : "(none)"}.
Write everything in the blog's language.

Return a JSON array where each item is:
{"title": string (max 65 chars), "outline": string (3-5 H2 sections separated by newlines), "seo_title": string (max 60 chars), "meta_description": string (max 155 chars), "keywords": string (comma separated, 3-6 terms)}`,
        },
      ]);

      const ideas = extractJson<
        Array<{
          title: string;
          outline?: string;
          seo_title?: string;
          meta_description?: string;
          keywords?: string;
        }>
      >(raw);

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
          meta_description: idea.meta_description ?? null,
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

    // 2. Write the article.
    const raw = await chatComplete([
      {
        role: "system",
        content:
          "You are an expert SEO blog writer. Reply with JSON only — no prose, no markdown fences.",
      },
      {
        role: "user",
        content: `${blogContext(blog)}

Write a complete, original blog article.
Title: ${post.title}
${post.outline ? `Outline to follow:\n${post.outline}` : ""}
Target length: about ${blog.article_length} words.
Use clear H2/H3 markdown headings, short paragraphs, and a natural keyword spread. No fluff, no invented statistics.

Return JSON:
{"body": string (markdown article), "seo_title": string (max 60 chars), "meta_description": string (max 155 chars), "keywords": string (comma separated)}`,
      },
    ]);

    const article = extractJson<{
      body: string;
      seo_title?: string;
      meta_description?: string;
      keywords?: string;
    }>(raw);

    const { error: updateError } = await admin
      .from("posts")
      .update({
        body: article.body,
        seo_title: article.seo_title ?? post.seo_title,
        meta_description: article.meta_description ?? post.meta_description,
        keywords: article.keywords ?? post.keywords,
        status: "drafted",
      })
      .eq("id", post.id);
    if (updateError) throw new Error(updateError.message);

    // 3. Publish when enabled and Blogger is connected.
    if (!blog.autopilot_auto_publish) {
      return { ...base, status: "drafted", detail: post.title, postId: post.id };
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
        detail: `${post.title} (Blogger not connected)`,
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

    const imageHtml =
      fresh?.image_url && origin
        ? `<p><img src="${origin}${fresh.image_url}" alt="${(fresh.seo_title || fresh.title).replace(/"/g, "&quot;")}" style="max-width:100%;height:auto" /></p>\n`
        : "";

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
  }
}
