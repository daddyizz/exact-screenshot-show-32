import { PNG } from "pngjs";
import * as jpeg from "jpeg-js";

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

function inferTargetAspect(prompt: string): number | undefined {
  const custom = /\b(\d{3,4})\s*x\s*(\d{3,4})\b/i.exec(prompt);
  if (custom) {
    const width = Number(custom[1]);
    const height = Number(custom[2]);
    if (width > 0 && height > 0) return width / height;
  }
  if (/\b16\s*:\s*9\b/i.test(prompt)) return 16 / 9;
  if (/\b4\s*:\s*3\b/i.test(prompt)) return 4 / 3;
  if (/\b1\s*:\s*1\b/i.test(prompt) || /\bsquare\b/i.test(prompt)) return 1;
  return undefined;
}

function cropRgbaToAspect(data: Uint8Array, width: number, height: number, targetAspect: number) {
  const sourceAspect = width / height;
  if (Math.abs(sourceAspect - targetAspect) < 0.002) {
    return { data: Buffer.from(data), width, height };
  }

  let cropWidth = width;
  let cropHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (sourceAspect > targetAspect) {
    cropWidth = Math.max(1, Math.floor(height * targetAspect));
    offsetX = Math.floor((width - cropWidth) / 2);
  } else {
    cropHeight = Math.max(1, Math.floor(width / targetAspect));
    offsetY = Math.floor((height - cropHeight) / 2);
  }

  const source = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const output = Buffer.alloc(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y += 1) {
    const sourceStart = ((offsetY + y) * width + offsetX) * 4;
    const sourceEnd = sourceStart + cropWidth * 4;
    const targetStart = y * cropWidth * 4;
    source.copy(output, targetStart, sourceStart, sourceEnd);
  }

  return { data: output, width: cropWidth, height: cropHeight };
}

function normalizeGeneratedImageToPng(dataUrl: string, targetAspect?: number): string {
  if (!targetAspect) return dataUrl;

  try {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return dataUrl;
    const mime = dataUrl.slice(5, dataUrl.indexOf(";", 5)).toLowerCase();
    const bytes = Buffer.from(dataUrl.slice(comma + 1), "base64");

    let rgba: Uint8Array;
    let width: number;
    let height: number;

    if (mime === "image/png") {
      const decoded = PNG.sync.read(bytes);
      rgba = decoded.data;
      width = decoded.width;
      height = decoded.height;
    } else if (mime === "image/jpeg" || mime === "image/jpg") {
      const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
      rgba = decoded.data;
      width = decoded.width;
      height = decoded.height;
    } else {
      console.error(`Unsupported AI image mime type for ratio enforcement: ${mime}`);
      return dataUrl;
    }

    const cropped = cropRgbaToAspect(rgba, width, height, targetAspect);
    const output = new PNG({ width: cropped.width, height: cropped.height });
    cropped.data.copy(output.data);
    const encoded = PNG.sync.write(output);
    return `data:image/png;base64,${encoded.toString("base64")}`;
  } catch (error) {
    console.error("AI image ratio enforcement failed; returning original image", error);
    return dataUrl;
  }
}

/** Generate an image via the Lovable AI gateway. Returns a base64 data URL. */
export async function generateImage(
  prompt: string,
  options?: { aspectRatio?: ImageAspectRatio },
): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project yet.");

  const explicitAspect = options?.aspectRatio === "16:9"
    ? 16 / 9
    : options?.aspectRatio === "4:3"
      ? 4 / 3
      : options?.aspectRatio === "1:1"
        ? 1
        : undefined;
  const targetAspect = explicitAspect ?? inferTargetAspect(prompt);

  // This gateway's chat/completions image-model route rejects response_format.
  // Generate normally, then enforce BlogPilot's requested geometry before storage.
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
  return normalizeGeneratedImageToPng(dataUrl, targetAspect);
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

function firstCompleteJsonValue(input: string) {
  const start = input.search(/[[{]/);
  if (start === -1) throw new Error("Could not parse the AI response.");

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      const open = stack.pop();
      const matches = (open === "{" && ch === "}") || (open === "[" && ch === "]");
      if (!matches) throw new Error("Could not parse the AI response.");
      if (stack.length === 0) return input.slice(start, i + 1);
    }
  }

  throw new Error("Could not parse the AI response.");
}

export function extractJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  // Models occasionally append a second JSON object, a note, or other text after
  // the valid answer. Parse only the first complete top-level JSON value instead
  // of slicing through the final closing brace/bracket in the whole response.
  const candidate = firstCompleteJsonValue(cleaned);
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
