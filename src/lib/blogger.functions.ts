import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAuthUrl,
  createBloggerPost,
  exchangeCode,
  listBlogs,
  markdownToHtml,
  refreshAccessToken,
  tokenExpiry,
} from "./blogger.server";

export const startBloggerAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ blogId: z.string().uuid(), redirectUri: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: blog, error } = await context.supabase
      .from("blogs")
      .select("id")
      .eq("id", data.blogId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!blog) throw new Error("Blog not found");

    const state = btoa(JSON.stringify({ blogId: data.blogId, n: crypto.randomUUID() }));
    return { url: buildAuthUrl(data.redirectUri, state) };
  });

export const completeBloggerAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ code: z.string().min(1), state: z.string().min(1), redirectUri: z.string().url() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let blogId: string;
    try {
      blogId = z.object({ blogId: z.string().uuid() }).parse(JSON.parse(atob(data.state))).blogId;
    } catch {
      throw new Error("Invalid authorization state");
    }

    const { data: blog, error: blogError } = await supabase
      .from("blogs")
      .select("id")
      .eq("id", blogId)
      .maybeSingle();
    if (blogError) throw new Error(blogError.message);
    if (!blog) throw new Error("Blog not found");

    const tokens = await exchangeCode(data.code, data.redirectUri);
    const blogs = await listBlogs(tokens.access_token);
    const first = blogs[0];

    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { error } = await admin.from("blogger_connections").upsert(
      {
        user_id: userId,
        blog_id: blogId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: tokenExpiry(tokens.expires_in),
        blogger_blog_id: first?.id ?? null,
        blogger_blog_name: first?.name ?? null,
        blogger_blog_url: first?.url ?? null,
      },
      { onConflict: "blog_id" },
    );
    if (error) throw new Error(error.message);

    return { blogId, blogs };
  });

export const selectBloggerBlog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        blogId: z.string().uuid(),
        bloggerBlogId: z.string().min(1),
        bloggerBlogName: z.string().min(1),
        bloggerBlogUrl: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { error } = await admin
      .from("blogger_connections")
      .update({
        blogger_blog_id: data.bloggerBlogId,
        blogger_blog_name: data.bloggerBlogName,
        blogger_blog_url: data.bloggerBlogUrl,
      })
      .eq("blog_id", data.blogId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectBlogger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ blogId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("blogger_connections")
      .delete()
      .eq("blog_id", data.blogId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishToBlogger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", data.postId)
      .maybeSingle();
    if (postError) throw new Error(postError.message);
    if (!post) throw new Error("Post not found");
    if (!post.body) throw new Error("Write the article before publishing.");

    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: connection, error: connError } = await admin
      .from("blogger_connections")
      .select("*")
      .eq("blog_id", post.blog_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (connError) throw new Error(connError.message);
    if (!connection?.blogger_blog_id) throw new Error("Connect this blog to Blogger first.");

    let accessToken = connection.access_token ?? "";
    const expired =
      !connection.token_expires_at || new Date(connection.token_expires_at) <= new Date();
    if (expired) {
      if (!connection.refresh_token)
        throw new Error("Your Blogger connection expired. Reconnect the blog.");
      const refreshed = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshed.access_token;
      await admin
        .from("blogger_connections")
        .update({
          access_token: accessToken,
          token_expires_at: tokenExpiry(refreshed.expires_in),
        })
        .eq("id", connection.id);
    }

    const published = await createBloggerPost(accessToken, connection.blogger_blog_id, {
      title: post.seo_title || post.title,
      content: markdownToHtml(post.body),
      labels: (post.keywords ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10),
    });

    const { error } = await supabase
      .from("posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        blogger_post_id: published.id,
        blogger_url: published.url,
      })
      .eq("id", data.postId);
    if (error) throw new Error(error.message);

    return { url: published.url };
  });
