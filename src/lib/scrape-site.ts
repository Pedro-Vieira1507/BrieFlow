import { invokeEdgeFunction } from "@/lib/supabase";
import type { SiteBrandData } from "@/types/builder";

const URL_REGEX =
  /https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|com\.br|io|net|org|app|ai|co|dev|store|shop|me|info|biz)(?:\/[^\s<>"')\]]*)?/gi;

interface ScrapeProxyResponse {
  url: string;
  brandName: string;
  description: string;
  logo: string | null;
  colors: string[];
  rawTitle?: string;
  headings?: string[];
  keywords?: string;
  bodySnippet?: string;
}

export interface ScrapedProductData {
  sku: string | null;
  name: string | null;
  price: string | null;
  availability: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  found: boolean;
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  const normalized = matches
    .map(normalizeUrl)
    .filter((url): url is string => Boolean(url));
  return [...new Set(normalized)];
}

export function normalizeUrl(raw: string): string | null {
  let value = raw.trim().replace(/[.,;:!?)]+$/, "");
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export async function scrapeWebsite(url: string): Promise<SiteBrandData> {
  const normalized = normalizeUrl(url);
  if (!normalized) throw new Error("Informe uma URL HTTP ou HTTPS válida.");

  const data = await invokeEdgeFunction<ScrapeProxyResponse>("scrape-proxy", {
    url: normalized,
  });

  return {
    url: data.url,
    title: data.rawTitle ?? data.brandName,
    description: data.description ?? "",
    brandName: data.brandName || new URL(data.url).hostname,
    headings: data.headings ?? [],
    bodySnippet: data.bodySnippet ?? data.description ?? "",
    ogImage: data.logo ?? undefined,
    keywords: data.keywords ?? "",
    colors: data.colors ?? [],
  };
}

export async function scrapeProductByUrlFn(
  url: string,
): Promise<ScrapedProductData> {
  const site = await scrapeWebsite(url);
  return {
    sku: null,
    name: site.title || site.brandName || null,
    price: null,
    availability: null,
    imageUrl: site.ogImage ?? null,
    productUrl: site.url,
    found: Boolean(site.title || site.ogImage || site.description),
  };
}

export async function scrapeProductBySkuFn(
  sku: string,
): Promise<ScrapedProductData | null> {
  const normalized = normalizeUrl(sku);
  if (!normalized) return null;
  try {
    return await scrapeProductByUrlFn(normalized);
  } catch {
    return null;
  }
}

export function formatSiteContextForAgent(
  site: SiteBrandData | null | undefined,
): string {
  if (!site) return "";
  const parts: string[] = [];
  if (site.brandName) parts.push(`Marca: ${site.brandName}`);
  if (site.description) parts.push(`Descrição: ${site.description}`);
  if (site.colors?.length) {
    parts.push(`Cores da marca: ${site.colors.join(", ")}`);
  }
  return parts.join("\n");
}
