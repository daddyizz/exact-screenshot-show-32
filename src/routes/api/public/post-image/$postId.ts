import { createFileRoute } from "@tanstack/react-router";
import sharp from "sharp";

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

async function cropToAspect(bytes: Buffer, targetAspect: number) {
  const probe = sharp(bytes, { failOn: "none" }).rotate();
  const meta = await probe.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("Could not determine image dimensions.");

  const sourceAspect = width / height;
  let outWidth = width;
  let outHeight = height;

  if (Math.abs(sourceAspect - targetAspect) >= 0.002) {
    if (sourceAspect > targetAspect) {
      outWidth = Math.max(1, Math.floor(height * targetAspect));
    } else {
      outHeight = Math.max(1, Math.floor(width / targetAspect));
    }
  }

  const processed = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize(outWidth, outHeight, { fit: "cover", position: "centre" })
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: processed.data,
    width: processed.info.width,
    height: processed.info.height,
  };
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
          const processed = await cropToAspect(input, aspect);
          return new Response(processed.bytes, {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "no-store, max-age=0, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
              "X-BlogPilot-Image-Size": `${processed.width}x${processed.height}`,
              "X-BlogPilot-Image-Aspect": aspect.toFixed(6),
            },
          });
        } catch (processingError) {
          console.error("Post image ratio processing failed", processingError);
          return new Response("Image processing failed", { status: 500 });
        }
      },
    },
  },
});
