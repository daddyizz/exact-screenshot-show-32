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

export type ImageAspectRatio = "16:9" | "4:3" | "1:1";

/** Generate an image via the AI gateway. Returns a base64 data URL. */
export async function generateImage(
  prompt: string,
  options?: { aspectRatio?: ImageAspectRatio },
): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project yet.");

  const body: Record<string, unknown> = {
    model: IMAGE_MODEL,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
  };

  // Do not rely on prompt wording alone for image geometry. Gemini image models
  // support an explicit output aspect-ratio request, so pass it through the
  // gateway for the preset ratios BlogPilot exposes.
  if (options?.aspectRatio) {
    body.response_format = {
      type: "image",
      aspect_ratio: options.aspectRatio,
    };
  }

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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

function normalizeJsonControlCharacters(input: string) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (const ch of input) {
    if (inString) {
      if (escaped) {
        output += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        output += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        output += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") { output += "\\n"; continue; }
      if (ch === "\r") { output += "\\r"; continue; }
      if (ch === "\t") { output += "\\t"; continue; }
      output += ch;
      continue;
    }

    if (ch === '"') inString = true;
    output += ch;
  }

  return output;
}

export function extractJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  if (start === -1 || end === -1) throw new Error("Could not parse the AI response.");

  const candidate = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch (firstError) {
    const repaired = normalizeJsonControlCharacters(candidate)
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(repaired) as T;
    } catch {
      throw firstError;
    }
  }
}

/**
 * Requests JSON from the model and automatically retries once if the first
 * response is malformed. The retry regenerates the answer instead of trying
 * to persist partially broken JSON.
 */
export async function chatCompleteJson<T>(messages: ChatMessage[]): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const requestMessages = attempt === 0
      ? messages
      : [
          ...messages,
          {
            role: "user" as const,
            content:
              "Regenerate the answer from scratch. Your previous response was invalid JSON. Return exactly one valid JSON value only, with double-quoted keys/strings, escaped newlines inside strings, no trailing commas, no comments, and no markdown fences.",
          },
        ];

    const raw = await chatComplete(requestMessages);
    try {
      return extractJson<T>(raw);
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : "unknown parse error";
  throw new Error(`AI returned malformed JSON after an automatic retry: ${detail}`);
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
