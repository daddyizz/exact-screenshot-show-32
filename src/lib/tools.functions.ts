import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { chatComplete, extractJson } from "./ai.server";

const inputSchema = z.object({
  topic: z.string().trim().min(3).max(120),
  audience: z.string().trim().max(120).optional(),
});

export type TitleIdea = { title: string; metaDescription: string; angle: string };

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_PER_WINDOW) {
    throw new Error("You have reached the free hourly limit. Create a free account to keep generating.");
  }
}

export const generateBlogTitles = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    let clientKey = "anonymous";
    try {
      const request = getRequest();
      clientKey =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "anonymous";
    } catch {
      clientKey = "anonymous";
    }
    rateLimit(clientKey);

    const audience = data.audience?.trim();
    const raw = await chatComplete([
      {
        role: "system",
        content:
          "You are an experienced SEO editor. You write specific, non-clickbait blog titles that match real search intent, and meta descriptions that accurately summarise the promised article. Reply with JSON only.",
      },
      {
        role: "user",
        content: `Topic or niche: ${data.topic}
${audience ? `Target reader: ${audience}` : "Target reader: not specified, infer a sensible one."}

Return JSON: {"ideas":[{"title":"...","metaDescription":"...","angle":"..."}]}
Rules:
- Exactly 8 ideas, each a clearly different search intent (how-to, comparison, checklist, mistakes, beginner guide, tools, case-style, FAQ).
- Titles under 60 characters where possible, natural language, no ALL CAPS, no emoji, no year unless genuinely useful.
- metaDescription: 140-155 characters, describes what the article actually delivers, no hype.
- angle: a short phrase (max 10 words) describing who the post is for and why it wins.`,
      },
    ]);

    const parsed = extractJson<{ ideas?: TitleIdea[] }>(raw);
    const ideas = (parsed.ideas ?? [])
      .filter((idea) => idea && typeof idea.title === "string")
      .slice(0, 8)
      .map((idea) => ({
        title: String(idea.title).trim(),
        metaDescription: String(idea.metaDescription ?? "").trim(),
        angle: String(idea.angle ?? "").trim(),
      }));
    if (!ideas.length) throw new Error("The generator could not produce titles for that topic. Try a more specific niche.");
    return { ideas };
  });
