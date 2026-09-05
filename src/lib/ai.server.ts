const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "google/gemini-2.5-flash-image-preview";

export type ChatMessage = { role: "system" | "user"; content: string };

export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project yet.");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (response.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
  if (response.status === 402) throw new Error("AI credits exhausted. Top up to keep generating.");
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI request failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The AI returned an empty response.");
  return content;
}

/** Generate an image via the AI gateway. Returns a base64 data URL. */
export async function generateImage(prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project yet.");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (response.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
  if (response.status === 402) throw new Error("AI credits exhausted. Top up to keep generating.");
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI image request failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: { images?: Array<{ image_url?: { url?: string } }> };
    }>;
  };
  const dataUrl = payload.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl?.startsWith("data:image/")) throw new Error("The AI returned no image.");
  return dataUrl;
}

export function extractJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  if (start === -1 || end === -1) throw new Error("Could not parse the AI response.");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export function slugifyServer(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export type BlogProfile = {
  name: string;
  niche: string;
  target_country: string;
  language: string;
  tone: string;
  article_length: number;
  keyword_focus: string | null;
};

export function blogContext(blog: BlogProfile) {
  return [
    `Blog name: ${blog.name}`,
    `Niche: ${blog.niche}`,
    `Target country: ${blog.target_country}`,
    `Language: ${blog.language}`,
    `Tone of voice: ${blog.tone}`,
    blog.keyword_focus ? `Keyword focus: ${blog.keyword_focus}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
