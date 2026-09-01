import { authorizationStatus, authorize, refund } from "../_shared/credits.ts";
import {
  authenticate,
  json,
  preflight,
  readJson,
  requirePost,
  runInBackground,
} from "../_shared/http.ts";
import { fetchPublicResource, validatePublicUrl } from "../_shared/urls.ts";

interface ScrapeRequest {
  url?: string;
  request_id?: string;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const pattern of [
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`,
        "i",
      ),
    ]) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeEntities(match[1]);
    }
  }
  return "";
}

function absolutize(value: string, pageUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, pageUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function collectColors(html: string): string[] {
  const frequency = new Map<string, number>();
  for (const match of html.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const color = `#${match[1].toUpperCase()}`;
    if (["#FFFFFF", "#000000", "#F5F5F5"].includes(color)) continue;
    frequency.set(color, (frequency.get(color) ?? 0) + 1);
  }
  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([color]) => color);
}

function extractPage(html: string, pageUrl: string) {
  const title =
    metaContent(html, ["og:title", "twitter:title"]) ||
    stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = metaContent(html, [
    "og:description",
    "twitter:description",
    "description",
  ]).slice(0, 800);
  const image = metaContent(html, [
    "og:image:secure_url",
    "og:image",
    "twitter:image",
  ]);
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .slice(0, 12);
  const bodySnippet = stripTags(
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html,
  ).slice(0, 3000);
  const hostname = new URL(pageUrl).hostname.replace(/^www\./, "");
  const brandName = (title.split(/\s+[|–—]\s+|\s+-\s+/)[0] || hostname)
    .trim()
    .slice(0, 120);

  return {
    url: pageUrl,
    brandName,
    description,
    logo: absolutize(image, pageUrl),
    colors: collectColors(html),
    rawTitle: title.slice(0, 300),
    headings,
    bodySnippet,
    keywords: metaContent(html, ["keywords"]).slice(0, 500),
  };
}

async function hashUrl(url: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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
    const body = await readJson<ScrapeRequest>(req, 8_192);
    if (typeof body.url !== "string" || body.url.length > 2_048) {
      return json(req, 400, { error: "invalid_url" });
    }
    requestId = body.request_id?.trim() || crypto.randomUUID();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) {
      return json(req, 400, { error: "invalid_request_id" });
    }

    const access = await authorize(context, "website_analysis", requestId, {});
    if (!access.ok) {
      return json(req, authorizationStatus(access.code), {
        error: access.code,
        remaining: access.credits_remaining,
      });
    }
    charged = true;

    const normalized = (await validatePublicUrl(body.url)).toString();
    const urlHash = await hashUrl(normalized);
    const { data: cached } = await context.service
      .from("scrape_cache")
      .select("data,expires_at")
      .eq("url_hash", urlHash)
      .maybeSingle();
    if (cached && Date.parse(cached.expires_at) > Date.now()) {
      return json(req, 200, {
        ...(cached.data as Record<string, unknown>),
        _cached: true,
        _meta: {
          request_id: requestId,
          credits_remaining: access.credits_remaining,
        },
      });
    }

    const { response, bytes, finalUrl } = await fetchPublicResource(
      normalized,
      {
        accept: "text/html,application/xhtml+xml;q=0.9",
        maxBytes: 1_000_000,
        timeoutMs: 15_000,
        maxRedirects: 4,
      },
    );
    if (!response.ok) throw new Error(`upstream_http_${response.status}`);
    const contentType =
      response.headers.get("Content-Type")?.toLowerCase() ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error("unsupported_content_type");
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const page = extractPage(html, finalUrl.toString());
    const cacheWrite = context.service.from("scrape_cache").upsert({
      url_hash: urlHash,
      url: normalized,
      data: page,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    });
    runInBackground("scrape_cache", cacheWrite);

    return json(req, 200, {
      ...page,
      _cached: false,
      _meta: {
        request_id: requestId,
        credits_remaining: access.credits_remaining,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "scrape_failed";
    if (charged && requestId) await refund(context, requestId, code);
    const status = [
      "invalid_url",
      "invalid_protocol",
      "url_credentials_not_allowed",
      "port_not_allowed",
      "private_address_blocked",
      "dns_resolution_failed",
    ].includes(code)
      ? 400
      : code === "resource_too_large"
        ? 413
        : 502;
    return json(req, status, {
      error: status < 500 ? code : "scrape_failed",
      message:
        status < 500
          ? "A URL não pode ser analisada."
          : "Não foi possível analisar este site.",
    });
  }
});
