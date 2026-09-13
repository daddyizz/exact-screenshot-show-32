import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bloggerOAuthConfig, bloggerRedirectUri, buildAuthUrl, createBloggerPost, exchangeCode, isBloggerNotFound, listBlogs, markdownToHtml, refreshAccessToken, tokenExpiry, updateBloggerPost } from "./blogger.server";
import { createNotification } from "./notifications.server";
import { writeActivity } from "./operations.server";

function stripInternalMarkers(body: string) {
  return body.replace(/\s*<!--\s*blogpilot-owned-backlink:[^>]+-->\s*/gi, "\n").trim();
}

async function notifyReconnect(admin: any, userId: string, blogId: string, message: string) {
  await createNotification(admin, { userId, type: "blogger.expired", title: "Reconnect Blogger", message, severity: "warning", actionUrl: "/settings", actionLabel: "Reconnect", dedupeKey: `blogger-expired:${blogId}` });
}

async function refreshConnection(admin: any, connection: any, userId: string, blogId: string) {
  if (!connection.refresh_token) {
    await notifyReconnect(admin, userId, blogId, "Your Blogger connection expired and cannot refresh automatically.");
    await writeActivity(admin,{userId,eventType:"blogger.reconnect_required",entityType:"blog",entityId:blogId,status:"failed",message:"Blogger connection requires reconnect",metadata:{reason:"missing_refresh_token"}});
    throw new Error("Your Blogger connection expired. Reconnect the blog.");
  }
  try {
    const refreshed = await refreshAccessToken(connection.refresh_token);
    const expiresAt = tokenExpiry(refreshed.expires_in);
    const { error } = await admin.from("blogger_connections").update({ access_token: refreshed.access_token, token_expires_at: expiresAt }).eq("id", connection.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    await writeActivity(admin,{userId,eventType:"blogger.token_refreshed",entityType:"blog",entityId:blogId,message:"Blogger access refreshed automatically"});
    return { accessToken: refreshed.access_token, expiresAt };
  } catch {
    await notifyReconnect(admin, userId, blogId, "Google rejected the saved Blogger authorization. Reconnect Blogger to continue publishing.");
    await writeActivity(admin,{userId,eventType:"blogger.reconnect_required",entityType:"blog",entityId:blogId,status:"failed",message:"Google rejected the saved Blogger authorization",metadata:{reason:"refresh_rejected"}});
    throw new Error("Blogger authorization is no longer valid. Reconnect the blog.");
  }
}

function bloggerImageAspect(blog: any) {
  const ratio = blog?.ai_image_aspect_ratio ?? "16:9";
  if (ratio === "1:1") return "1 / 1";
  if (ratio === "4:3") return "4 / 3";
  if (ratio === "custom") {
    const width = Number(blog?.ai_image_custom_width ?? 0);
    const height = Number(blog?.ai_image_custom_height ?? 0);
    if (width >= 320 && height >= 320) return `${width} / ${height}`;
  }
  return "16 / 9";
}

function bloggerImagePaddingTop(blog: any) {
  const ratio = blog?.ai_image_aspect_ratio ?? "16:9";
  if (ratio === "1:1") return "100%";
  if (ratio === "4:3") return "75%";
  if (ratio === "custom") {
    const width = Number(blog?.ai_image_custom_width ?? 0);
    const height = Number(blog?.ai_image_custom_height ?? 0);
    if (width >= 320 && height >= 320) return `${(height / width) * 100}%`;
  }
  return "56.25%";
}

export const getBloggerOAuthConfig = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ redirectUri: z.string().url().optional() }).parse(data ?? {})).handler(async ({ data }) => bloggerOAuthConfig(data.redirectUri));

export const startBloggerAuth = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ blogId: z.string().uuid(), redirectUri: z.string().url().optional() }).parse(data)).handler(async ({ data, context }) => {
  const { data: blog, error } = await context.supabase.from("blogs").select("id").eq("id", data.blogId).maybeSingle();
  if (error) throw new Error(error.message); if (!blog) throw new Error("Blog not found");
  const redirectUri = bloggerRedirectUri(data.redirectUri); const state = btoa(JSON.stringify({ blogId: data.blogId, n: crypto.randomUUID() }));
  return { url: buildAuthUrl(redirectUri, state), redirectUri };
});

export const completeBloggerAuth = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ code: z.string().min(1), state: z.string().min(1), redirectUri: z.string().url().optional() }).parse(data)).handler(async ({ data, context }) => {
  const { supabase, userId } = context; let blogId: string;
  try { blogId = z.object({ blogId: z.string().uuid() }).parse(JSON.parse(atob(data.state))).blogId; } catch { throw new Error("Invalid authorization state"); }
  const { data: blog, error: blogError } = await supabase.from("blogs").select("id").eq("id", blogId).maybeSingle();
  if (blogError) throw new Error(blogError.message); if (!blog) throw new Error("Blog not found");
  const redirectUri = bloggerRedirectUri(data.redirectUri); const tokens = await exchangeCode(data.code, redirectUri); const blogs = await listBlogs(tokens.access_token); const first = blogs[0];
  const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data: existing } = await admin.from("blogger_connections").select("refresh_token").eq("blog_id", blogId).eq("user_id", userId).maybeSingle();
  const { error } = await admin.from("blogger_connections").upsert({ user_id: userId, blog_id: blogId, access_token: tokens.access_token, refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null, token_expires_at: tokenExpiry(tokens.expires_in), blogger_blog_id: first?.id ?? null, blogger_blog_name: first?.name ?? null, blogger_blog_url: first?.url ?? null }, { onConflict: "blog_id" });
  if (error) throw new Error(error.message);
  await writeActivity(admin,{userId,eventType:existing?"blogger.reconnected":"blogger.connected",entityType:"blog",entityId:blogId,message:existing?"Blogger authorization reconnected":"Blogger authorization connected",metadata:{bloggerBlogName:first?.name??null}});
  return { blogId, blogs, redirectUri };
});

export const selectBloggerBlog = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ blogId: z.string().uuid(), bloggerBlogId: z.string().min(1), bloggerBlogName: z.string().min(1), bloggerBlogUrl: z.string().url() }).parse(data)).handler(async ({ data, context }) => {
  const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { error } = await admin.from("blogger_connections").update({ blogger_blog_id: data.bloggerBlogId, blogger_blog_name: data.bloggerBlogName, blogger_blog_url: data.bloggerBlogUrl }).eq("blog_id", data.blogId).eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  await writeActivity(admin,{userId:context.userId,eventType:"blogger.blog_selected",entityType:"blog",entityId:data.blogId,message:`Blogger destination selected: ${data.bloggerBlogName}`});
  return { ok: true };
});

export const disconnectBlogger = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ blogId: z.string().uuid() }).parse(data)).handler(async ({ data, context }) => {
  const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
  const { error } = await context.supabase.from("blogger_connections").delete().eq("blog_id", data.blogId); if (error) throw new Error(error.message);
  await writeActivity(admin,{userId:context.userId,eventType:"blogger.disconnected",entityType:"blog",entityId:data.blogId,message:"Blogger disconnected"});
  return { ok:true };
});

export const publishToBlogger = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ postId: z.string().uuid(), origin: z.string().url().optional() }).parse(data)).handler(async ({ data, context }) => {
  const { supabase, userId } = context; const { data: post, error: postError } = await supabase.from("posts").select("*, blogs(ai_image_aspect_ratio,ai_image_custom_width,ai_image_custom_height)").eq("id", data.postId).maybeSingle();
  if (postError) throw new Error(postError.message); if (!post) throw new Error("Post not found"); if (!post.body) throw new Error("Write the article before publishing.");
  const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin; const { data: connection, error: connError } = await admin.from("blogger_connections").select("*").eq("blog_id", post.blog_id).eq("user_id", userId).maybeSingle();
  if (connError) throw new Error(connError.message); if (!connection?.blogger_blog_id) throw new Error("Connect this blog to Blogger first.");
  let accessToken = connection.access_token ?? ""; const expired = !connection.token_expires_at || new Date(connection.token_expires_at) <= new Date();
  if (expired) accessToken = (await refreshConnection(admin, connection, userId, post.blog_id)).accessToken;
  const imageVersion = Date.now();
  const imageSrc = post.image_url && data.origin ? `${data.origin}${post.image_url}${post.image_url.includes("?") ? "&" : "?"}v=${imageVersion}` : null;
  const aspect = bloggerImageAspect((post as any).blogs);
  const paddingTop = bloggerImagePaddingTop((post as any).blogs);
  const imageHtml = imageSrc ? `<div style="position:relative;width:100%;max-width:100%;padding-top:${paddingTop};overflow:hidden;margin:0 0 1.5em"><img src="${imageSrc}" alt="${(post.seo_title || post.title).replace(/"/g, "&quot;")}" style="position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:cover!important;margin:0!important" /></div>\n` : "";
  const publicBody = stripInternalMarkers(post.body);
  const input = { title: post.seo_title || post.title, content: imageHtml + markdownToHtml(publicBody), labels: (post.keywords ?? "").split(",").map((k: string) => k.trim()).filter(Boolean).slice(0, 10) };
  const hadExistingPost = Boolean(post.blogger_post_id); let recoveredMissingPost = false; let published: { id: string; url: string };
  try {
    if (post.blogger_post_id) {
      try { published = await updateBloggerPost(accessToken, connection.blogger_blog_id, post.blogger_post_id, input); }
      catch (error) { if (!isBloggerNotFound(error)) throw error; published = await createBloggerPost(accessToken, connection.blogger_blog_id, input); recoveredMissingPost = true; }
    } else published = await createBloggerPost(accessToken, connection.blogger_blog_id, input);
    const { error } = await supabase.from("posts").update({ status: "published", published_at: new Date().toISOString(), blogger_post_id: published.id, blogger_url: published.url }).eq("id", data.postId); if (error) throw new Error(error.message);
    await createNotification(admin, { userId, type: recoveredMissingPost ? "blogger.recovered" : "blogger.published", title: recoveredMissingPost ? "Blogger post restored" : hadExistingPost ? "Article republished" : "Article published", message: recoveredMissingPost ? `${post.title} was missing from Blogger, so BlogPilot created a replacement post.` : post.title, severity: "success", actionUrl: "/articles", actionLabel: "View articles" });
    await writeActivity(admin,{userId,eventType:recoveredMissingPost?"blogger.post_recovered":hadExistingPost?"blogger.post_republished":"blogger.post_published",entityType:"post",entityId:data.postId,message:recoveredMissingPost?"Missing Blogger post restored":hadExistingPost?"Article republished to Blogger":"Article published to Blogger",metadata:{blogId:post.blog_id,bloggerPostId:published.id,title:post.title,imageVersion,imageAspect:aspect}});
    return { url: published.url, republished: hadExistingPost && !recoveredMissingPost, recoveredMissingPost };
  } catch(error:any) {
    await writeActivity(admin,{userId,eventType:"blogger.publish_failed",entityType:"post",entityId:data.postId,status:"failed",message:"Blogger publish failed",metadata:{blogId:post.blog_id,title:post.title,error:String(error?.message??error).slice(0,500)}});
    throw error;
  }
});

export const getBloggerStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ blogId: z.string().uuid() }).parse(data)).handler(async ({ data, context }) => {
  const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data: row, error } = await admin.from("blogger_connections").select("*").eq("blog_id", data.blogId).eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { connected: false, healthy: false, needsReconnect: false, tokenExpired: false, tokenExpiresAt: null, bloggerBlogId: null, bloggerBlogName: null, bloggerBlogUrl: null };
  let expiresAt = row.token_expires_at ?? null; let expired = !expiresAt || new Date(expiresAt) <= new Date(); let needsReconnect = false;
  if (expired) {
    if (!row.refresh_token) { needsReconnect = true; await notifyReconnect(admin, context.userId, data.blogId, "Your Blogger connection expired and cannot refresh automatically."); await writeActivity(admin,{userId:context.userId,eventType:"blogger.reconnect_required",entityType:"blog",entityId:data.blogId,status:"failed",message:"Blogger connection requires reconnect",metadata:{reason:"missing_refresh_token"}}); }
    else { try { const refreshed = await refreshConnection(admin, row, context.userId, data.blogId); expiresAt = refreshed.expiresAt; expired = false; } catch { needsReconnect = true; } }
  }
  return { connected: true, healthy: !needsReconnect, needsReconnect, tokenExpired: expired, tokenExpiresAt: expiresAt, bloggerBlogId: row.blogger_blog_id ?? null, bloggerBlogName: row.blogger_blog_name ?? null, bloggerBlogUrl: row.blogger_blog_url ?? null };
});
