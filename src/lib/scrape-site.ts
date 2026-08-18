// src/lib/scrape-site.ts
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

export async function scrapeWebsite(url: string): Promise<SiteBrandData> {
  // Substituindo a Edge Function bloqueada por um CORS proxy simples para contornar problemas locais
  const corsProxy = "https://api.allorigins.win/get?url=";
  
  try {
    const response = await fetch(`${corsProxy}${encodeURIComponent(url)}`);
    if (!response.ok) {
        throw new Error("Falha ao acessar o site fornecido.");
    }
    const data = await response.json();
    const html = data.contents;

    if (!html) throw new Error("Conteúdo vazio retornado.");

    // Extração básica via Regex (rodando puramente no cliente/servidor Node local)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);

    const title = titleMatch ? titleMatch[1].trim() : "";
    const description = descMatch ? descMatch[1].trim() : "";
    
    // Tentar deduzir o nome da marca a partir do title (Pega a primeira parte antes de - ou |)
    const brandName = title.split(/[-|]/)[0].trim() || "Sua Marca";

    return {
        url,
        title,
        description,
        brandName,
        headings: [], // Simplificado
        bodySnippet: description, // Simplificado
        ogImage: ogImageMatch ? ogImageMatch[1].trim() : undefined,
        keywords: "",
        colors: [], // Simplificado
    };

  } catch (error) {
     throw new Error(`Não foi possível analisar o site: ${String(error)}`);
  }
}

export async function scrapeProductByUrlFn(url: string): Promise<SiteBrandData> {
  return scrapeWebsite(url);
}

export type ScrapedProductData = {
  url: string;
  brandName: string;
  description: string;
  logo: string | null;
  colors: string[];
};

export async function scrapeProductBySkuFn(sku: string): Promise<ScrapedProductData | null> {
  const normalized = normalizeUrl(sku);
  if (!normalized) return null;
  try {
    const data = await scrapeWebsite(normalized);
    return {
      url: normalized,
      brandName: data.brandName ?? "",
      description: data.description ?? "",
      logo: data.ogImage ?? null,
      colors: data.colors ?? [],
    };
  } catch {
    return null;
  }
}

export function formatSiteContextForAgent(site: SiteBrandData | null | undefined): string {
  if (!site) return "";
  const parts: string[] = [];
  if (site.brandName) parts.push(`Marca: ${site.brandName}`);
  if (site.description) parts.push(`Descrição: ${site.description}`);
  if (site.colors?.length) parts.push(`Cores da marca: ${site.colors.join(", ")}`);
  return parts.join("\n");
}