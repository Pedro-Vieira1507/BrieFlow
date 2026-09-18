interface Env {
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: { segment?: "foreground" }): {
        output(options: {
          format: "image/webp";
          quality?: number;
        }): Promise<{
          response(options?: {
            headers?: Record<string, string>;
          }): Response;
        }>;
      };
    };
  };
  BRIEFLOW_SEGMENT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const suppliedSecret = request.headers.get("X-BrieFlow-Segment-Secret");
    if (
      !env.BRIEFLOW_SEGMENT_SECRET ||
      suppliedSecret !== env.BRIEFLOW_SEGMENT_SECRET
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!/^image\/(?:jpeg|jpg|png|webp)(?:;|$)/i.test(contentType)) {
      return new Response("Unsupported image type", { status: 415 });
    }

    if (!request.body) {
      return new Response("Missing image body", { status: 400 });
    }

    try {
      const transformed = await env.IMAGES
        .input(request.body)
        .transform({ segment: "foreground" })
        .output({ format: "image/webp", quality: 96 });

      return transformed.response({
        headers: {
          "Cache-Control": "private, max-age=86400",
          "X-BrieFlow-Segment-Provider": "cloudflare-images-birefnet",
        },
      });
    } catch (error) {
      console.error("product_segment_failed", error);
      return new Response("Segmentation failed", { status: 502 });
    }
  },
};
