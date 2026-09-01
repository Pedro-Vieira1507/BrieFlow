import { authorizationStatus, authorize, refund } from "../_shared/credits.ts";
import {
  authenticate,
  json,
  preflight,
  readJson,
  requirePost,
} from "../_shared/http.ts";
import { fetchPublicResource } from "../_shared/urls.ts";

interface ImageSearchRequest {
  query?: string;
  request_id?: string;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

Deno.serve(async (req: Request) => {
  const optionsResponse = preflight(req);
  if (optionsResponse) return optionsResponse;
  const methodResponse = requirePost(req);
  if (methodResponse) return methodResponse;

  const context = await authenticate(req).catch(() => null);
  if (!context) return json(req, 401, { error: "unauthorized" });

  let requestId = "";
  let charged = false;
  try {
    const body = await readJson<ImageSearchRequest>(req, 8_192);
    const query = body.query
      ? Array.from(body.query)
          .map((character) => (character.charCodeAt(0) < 32 ? " " : character))
          .join("")
          .trim()
          .slice(0, 180)
      : "";
    if (!query || query.length < 2)
      return json(req, 400, { error: "query_required" });
    requestId = body.request_id?.trim() || crypto.randomUUID();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) {
      return json(req, 400, { error: "invalid_request_id" });
    }

    const access = await authorize(context, "image_search", requestId, {});
    if (!access.ok) {
      return json(req, authorizationStatus(access.code), {
        error: access.code,
        remaining: access.credits_remaining,
      });
    }
    charged = true;

    const apiKey = Deno.env.get("GOOGLE_SEARCH_API_KEY")?.trim();
    const searchEngineId = Deno.env.get("GOOGLE_SEARCH_CX")?.trim();
    if (!apiKey || !searchEngineId)
      throw new Error("image_search_not_configured");

    const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("cx", searchEngineId);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("searchType", "image");
    searchUrl.searchParams.set("safe", "active");
    searchUrl.searchParams.set("num", "5");
    searchUrl.searchParams.set("imgSize", "large");

    const searchResponse = await fetch(searchUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!searchResponse.ok)
      throw new Error(`image_search_http_${searchResponse.status}`);
    const searchPayload = (await searchResponse.json()) as {
      items?: Array<{ link?: string; image?: { contextLink?: string } }>;
    };

    let selected: {
      bytes: Uint8Array;
      mime: string;
      sourceUrl: string;
    } | null = null;
    for (const item of searchPayload.items ?? []) {
      if (!item.link) continue;
      try {
        const resource = await fetchPublicResource(item.link, {
          accept: "image/jpeg,image/png,image/webp,image/gif",
          maxBytes: 10 * 1024 * 1024,
          timeoutMs: 12_000,
          maxRedirects: 3,
        });
        if (!resource.response.ok) continue;
        const mime = (resource.response.headers.get("Content-Type") ?? "")
          .split(";")[0]
          .toLowerCase();
        if (!MIME_EXTENSIONS[mime] || resource.bytes.byteLength < 1_024)
          continue;
        selected = {
          bytes: resource.bytes,
          mime,
          sourceUrl: resource.finalUrl.toString(),
        };
        break;
      } catch {
        // Search results are third-party resources; try the next safe candidate.
      }
    }
    if (!selected) throw new Error("image_not_found");

    const filePath = `${context.user.id}/search/${crypto.randomUUID()}.${MIME_EXTENSIONS[selected.mime]}`;
    const { error: uploadError } = await context.service.storage
      .from("campaign-assets")
      .upload(filePath, selected.bytes, {
        contentType: selected.mime,
        cacheControl: "86400",
        upsert: false,
      });
    if (uploadError) throw new Error("image_upload_failed");

    const { data: signed, error: signError } = await context.service.storage
      .from("campaign-assets")
      .createSignedUrl(filePath, 60 * 60);
    if (signError || !signed?.signedUrl) throw new Error("image_sign_failed");

    return json(req, 200, {
      found: true,
      imageUrl: signed.signedUrl,
      sourceUrl: selected.sourceUrl,
      _meta: {
        request_id: requestId,
        credits_remaining: access.credits_remaining,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "image_search_failed";
    if (charged && requestId) await refund(context, requestId, code);
    const status = code === "image_search_not_configured" ? 503 : 502;
    return json(req, status, {
      found: false,
      imageUrl: null,
      error:
        code === "image_not_found" ? "image_not_found" : "image_search_failed",
    });
  }
});
