// lib/scrape-site.ts
import { createServerFn } from "@tanstack/react-start";
import type { SiteBrandData } from "@/types/builder";

const URL_REGEX =
  /https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|com\.br|io|net|org|app|ai|co|dev|store|shop|me|info|biz)(?:\/[^\s<>"')\]]*)?/gi;

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  const normalized = matches
    .map(normalizeUrl)
    .filter((u): u is string => Boolean(u));
  return [...new Set(normalized)];
}

export function normalizeUrl(raw: string): string | null {
  let value = raw.trim().replace(/[.,;:!?)]+$/, "");
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
        "i",
      ),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return decodeHtml(m[1]);
    }
  }
  return "";
}

function extractTitle(html: string): string {
  const og = metaContent(html, ["og:title", "twitter:title"]);
  if (og) return og;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? decodeHtml(m[1]) : "";
}

function extractHeadings(html: string, limit = 8): string[] {
  const headings: string[] = [];
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null && headings.length < limit) {
    const text = decodeHtml(match[1].replace(/<[^>]+>/g, " "));
    if (text && text.length > 2 && text.length < 160) headings.push(text);
  }
  return [...new Set(headings)];
}

function extractBodySnippet(html: string, maxLen = 1800): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const mainMatch =
    cleaned.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i) ||
    cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i) ||
    cleaned.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);

  const source = mainMatch?.[1] ?? cleaned;
  const text = decodeHtml(source.replace(/<[^>]+>/g, " "));
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

function inferBrandName(title: string, url: string): string {
  if (title) {
    const parts = title.split(/[|\-–—·:]/).map((p) => p.trim()).filter(Boolean);
    if (parts[0] && parts[0].length < 60) return parts[0];
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0] ?? host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return "Marca";
  }
}

export function parseWebsiteHtml(html: string, url: string): SiteBrandData {
  const title = extractTitle(html);
  const description = metaContent(html, [
    "description",
    "og:description",
    "twitter:description",
  ]);
  const keywords = metaContent(html, ["keywords"]);
  const ogImage = metaContent(html, ["og:image", "twitter:image"]);
  const headings = extractHeadings(html);
  const bodySnippet = extractBodySnippet(html);
  const brandName = inferBrandName(title, url);

  return {
    url,
    title,
    description,
    brandName,
    headings,
    bodySnippet,
    ogImage: ogImage || undefined,
    keywords: keywords || undefined,
  };
}

export function formatSiteContextForAgent(site: SiteBrandData): string {
  const lines = [
    `URL: ${site.url}`,
    `Marca: ${site.brandName}`,
    site.title ? `Título: ${site.title}` : null,
    site.description ? `Descrição: ${site.description}` : null,
    site.keywords ? `Keywords: ${site.keywords}` : null,
    site.headings.length
      ? `Headings: ${site.headings.slice(0, 6).join(" | ")}`
      : null,
    site.bodySnippet
      ? `Conteúdo extraído:\n${site.bodySnippet.slice(0, 1200)}`
      : null,
  ].filter(Boolean);
  return lines.join("\n");
}

async function fetchWebsite(url: string): Promise<SiteBrandData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BrieFlowBot/1.0; +https://brieflow.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Site retornou HTTP ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      throw new Error("A URL não aponta para uma página HTML.");
    }

    const html = await res.text();
    if (!html || html.length < 40) {
      throw new Error("Página vazia ou inacessível.");
    }

    return parseWebsiteHtml(html, url);
  } finally {
    clearTimeout(timeout);
  }
}

export const scrapeWebsite = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => {
    if (!data?.url || typeof data.url !== "string") {
      throw new Error("URL obrigatória.");
    }
    const normalized = normalizeUrl(data.url);
    if (!normalized) throw new Error("URL inválida.");
    return { url: normalized };
  })
  .handler(async ({ data }): Promise<SiteBrandData> => {
    return fetchWebsite(data.url);
  });
