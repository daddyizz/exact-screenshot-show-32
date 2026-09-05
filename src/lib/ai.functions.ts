import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { blogContext, chatComplete, extractJson, generateImage, slugifyServer } from "./ai.server";

export const generateTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ blogId: z.string().uuid(), count: z.number().min(1).max(10).default(5) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: blog, error: blogError } = await supabase
      .from("blogs")
      .select("*")
      .eq("id", data.blogId)
      .maybeSingle();
    if (blogError) throw new Error(blogError.message);
    if (!blog) throw new Error("Blog not found");

    const { data: existing } = await supabase
      .from("posts")
      .select("title")
      .eq("blog_id", data.blogId)
      .limit(100);
    const taken = (existing ?? []).map((p) => p.title);

    const raw = await chatComplete([
      {
        role: "system",
        content:
          "You are an SEO content strategist. Reply with JSON only — no prose, no markdown fences.",
      },
      {
        role: "user",
        content: `${blogContext(blog)}

Propose ${data.count} new blog post ideas with genuine search demand for this audience.
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

    const lowerTaken = new Set(taken.map((t) => t.trim().toLowerCase()));
    const rows = ideas
      .filter((idea) => idea?.title && !lowerTaken.has(idea.title.trim().toLowerCase()))
      .map((idea) => ({
        user_id: userId,
        blog_id: data.blogId,
        title: idea.title.trim(),
        slug: slugifyServer(idea.title),
        outline: idea.outline ?? null,
        seo_title: idea.seo_title ?? null,
        meta_description: idea.meta_description ?? null,
        keywords: idea.keywords ?? null,
        status: "idea",
      }));

    if (rows.length === 0) return { inserted: 0 };

    const { error } = await supabase.from("posts").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const generateArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*, blogs(*)")
      .eq("id", data.postId)
      .maybeSingle();
    if (postError) throw new Error(postError.message);
    if (!post || !post.blogs) throw new Error("Post not found");

    const blog = post.blogs;

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

    const { error } = await supabase
      .from("posts")
      .update({
        body: article.body,
        seo_title: article.seo_title ?? post.seo_title,
        meta_description: article.meta_description ?? post.meta_description,
        keywords: article.keywords ?? post.keywords,
        status: "drafted",
      })
      .eq("id", data.postId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
