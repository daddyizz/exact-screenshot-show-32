import { createFileRoute } from "@tanstack/react-router";
import { PNG } from "pngjs";
import * as jpeg from "jpeg-js";

function requestedAspect(blog: any) {
  const ratio = blog?.ai_image_aspect_ratio ?? "16:9";
  if (ratio === "1:1") return 1;
  if (ratio === "4:3") return 4 / 3;
  if (ratio === "custom") {
    const width = Number(blog?.ai_image_custom_width ?? 0);
    const height = Number(blog?.ai_image_custom_height ?? 0);
    if (width >= 320 && height >= 320) return width / height;
  }
  return 16 / 9;
}

function cropRgba(data: Uint8Array, width: number, height: number, targetAspect: number) {
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

function processImage(bytes: Buffer, targetAspect: number) {
  const isPng = bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47;
  const isJpeg = bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff;

  if (isPng) {
    const decoded = PNG.sync.read(bytes);
    const cropped = cropRgba(decoded.data, decoded.width, decoded.height, targetAspect);
    const output = new PNG({ width: cropped.width, height: cropped.height });
    cropped.data.copy(output.data);
    return {
      bytes: PNG.sync.write(output),
      contentType: "image/png",
      width: cropped.width,
      height: cropped.height,
    };
  }

  if (isJpeg) {
    const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    const cropped = cropRgba(decoded.data, decoded.width, decoded.height, targetAspect);
    const encoded = jpeg.encode({
      data: cropped.data,
      width: cropped.width,
      height: cropped.height,
    }, 90);
    return {
      bytes: Buffer.from(encoded.data),
      contentType: "image/jpeg",
      width: cropped.width,
      height: cropped.height,
    };
  }

  return { bytes, contentType: "application/octet-stream", width: null, height: null };
}

export const Route = createFileRoute("/api/public/post-image/$postId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const postId = params.postId;
        if (!/^[0-9a-f-]{36}$/i.test(postId)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: post } = await admin
          .from("posts")
          .select("blog_id")
          .eq("id", postId)
          .maybeSingle();

        let aspect = 16 / 9;
        if (post?.blog_id) {
          const { data: blog } = await admin
            .from("blogs")
            .select("ai_image_aspect_ratio,ai_image_custom_width,ai_image_custom_height")
            .eq("id", post.blog_id)
            .maybeSingle();
          aspect = requestedAspect(blog);
        }

        const { data, error } = await admin.storage
          .from("post-images")
          .download(`${postId}.png`);
        if (error || !data) return new Response("Not found", { status: 404 });

        try {
          const input = Buffer.from(await data.arrayBuffer());
          const processed = processImage(input, aspect);
          return new Response(processed.bytes, {
            headers: {
              "Content-Type": processed.contentType,
              "Cache-Control": "no-store, max-age=0",
              "X-BlogPilot-Image-Size": processed.width && processed.height
                ? `${processed.width}x${processed.height}`
                : "unknown",
            },
          });
        } catch (processingError) {
          console.error("Post image ratio processing failed", processingError);
          return new Response(data, {
            headers: {
              "Content-Type": data.type || "application/octet-stream",
              "Cache-Control": "no-store, max-age=0",
            },
          });
        }
      },
    },
  },
});
