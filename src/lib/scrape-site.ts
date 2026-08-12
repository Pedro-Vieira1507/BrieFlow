// src/lib/scrape-site.ts
//
// Scraping seguro: todas as chamadas de rede passam pelo edge function scrape-proxy.
// O proxy valida URLs contra SSRF, aplica cache de 4h, e exige autenticação.
// O código do browser não faz fetch direto para sites de terceiros.

import type { SiteBrandData } from "@/types/builder";
import { supabase } from "@/lib/supabase";

const SCRAPE_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-proxy`;

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

async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

export async function scrapeWebsite(url: string): Promise<SiteBrandData> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Faça login para analisar sites.");
  }

  const response = await fetch(SCRAPE_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Client-Info": "brieflow/1.0",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    let errBody: Record<string, unknown> = {};
    try { errBody = await response.json(); } catch { /* ignore */ }
    const reason = String(errBody.error ?? `http_${response.status}`);
    if (reason === "blocked_host" || reason === "private_ip" || reason === "invalid_protocol") {
      throw new Error("URL inválida ou não permitida.");
    }
    if (reason === "unauthorized") {
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    throw new Error(`Não foi possível analisar o site (${reason}).`);
  }

  const data = await response.json() as SiteBrandData & { _cached?: boolean };
  return data;
}

// Kept for backward compatibility with useBriefflowAgent — delegates to scrapeWebsite
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
  // SKU scraping delegates to general URL scraping if sku looks like a URL
  const normalized = normalizeUrl(sku);
  if (!normalized) return null;
  try {
    const data = await scrapeWebsite(normalized);
    return {
      url: normalized,
      brandName: data.brandName ?? "",
      description: data.description ?? "",
      logo: data.logo ?? null,
      colors: data.colors ?? [],
    };
  } catch {
    return null;
  }
}

// Re-export formatSiteContextForAgent so ollama.ts imports still work
export function formatSiteContextForAgent(site: SiteBrandData | null | undefined): string {
  if (!site) return "";
  const parts: string[] = [];
  if (site.brandName) parts.push(`Marca: ${site.brandName}`);
  if (site.description) parts.push(`Descrição: ${site.description}`);
  if (site.colors?.length) parts.push(`Cores da marca: ${site.colors.join(", ")}`);
  return parts.join("\n");
}
