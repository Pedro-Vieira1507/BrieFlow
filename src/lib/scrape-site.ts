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

// ─── TIPOS DO SCRAPER DE PRODUTO ──────────────────────────────────────────────

export interface ScrapedProductData {
  sku: string;
  name: string | null;
  price: string | null;
  availability: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  found: boolean;
  error?: string;
}

// Gera URLs candidatas para buscar o produto pelo SKU no e-commerce.
function buildProductSearchUrls(siteUrl: string, sku: string): string[] {
  try {
    const origin = new URL(siteUrl).origin;
    const enc = encodeURIComponent(sku.trim());
    return [
      `${origin}/busca?q=${enc}`,
      `${origin}/search?q=${enc}`,
      `${origin}/pesquisa?q=${enc}`,
      `${origin}/?s=${enc}`,
      `${origin}/catalogsearch/result/?q=${enc}`,
      `${origin}/buscar/${enc}`,
      `${origin}/produto/${enc}`,
      `${origin}/p/${enc}`,
    ];
  } catch {
    return [];
  }
}

// Extrai dados do produto de uma página HTML usando Open Graph, JSON-LD e padrões comuns.
function extractProductData(
  html: string,
  baseUrl: string,
  sku: string,
): Omit<ScrapedProductData, "sku" | "found" | "productUrl"> {
  // ── Nome ──────────────────────────────────────────────────────────────
  const ogTitleMatch =
    html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i);
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawName = (ogTitleMatch?.[1] ?? titleTagMatch?.[1] ?? "").trim().replace(/\s+/g, " ");

  // ── Imagem ────────────────────────────────────────────────────────────
  const ogImageMatch =
    html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
  let imageUrl = resolveUrl(ogImageMatch?.[1]?.trim() ?? null, baseUrl);

  // ── JSON-LD (Schema.org Product) ──────────────────────────────────────
  let price: string | null = null;
  let availability: string | null = null;
  let jsonLdName: string | null = null;

  const jsonLdBlocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      const content = block.replace(/<script[^>]*>|<\/script>/gi, "");
      try {
        const data = JSON.parse(content) as Record<string, unknown>;

        // Suporta @graph (array de schemas)
        const candidates: Record<string, unknown>[] = Array.isArray(data["@graph"])
          ? (data["@graph"] as Record<string, unknown>[])
          : [data];

        for (const item of candidates) {
          const type = String(item["@type"] ?? "").toLowerCase();
          if (!type.includes("product")) continue;

          if (!jsonLdName && item.name) {
            jsonLdName = String(item.name).trim();
          }

          if (!imageUrl) {
            const imgField = item.image;
            const imgRaw = Array.isArray(imgField) ? String(imgField[0]) : String(imgField ?? "");
            if (imgRaw) imageUrl = resolveUrl(imgRaw, baseUrl);
          }

          // Preço via offers
          const offers = item.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
          if (offers && !price) {
            const firstOffer = Array.isArray(offers) ? offers[0] : offers;
            if (firstOffer) {
              const rawPrice = firstOffer.price ?? firstOffer.lowPrice;
              if (rawPrice !== undefined) {
                const numPrice = parseFloat(String(rawPrice));
                price = isNaN(numPrice)
                  ? null
                  : `R$ ${numPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
              }

              // Disponibilidade
              const avail = String(firstOffer.availability ?? "").toLowerCase();
              if (avail.includes("instock") || avail.includes("preorder")) {
                availability = "Disponível";
              } else if (avail.includes("outofstock")) {
                availability = "Indisponível";
              }
            }
          }

          break;
        }
      } catch {
        // segue para o próximo bloco
      }
    }
  }

  // Fallback de preço via padrão de texto "R$ 999,00" na página
  if (!price) {
    const priceMatch = html.match(
      /R\$\s*[\d.,]+(?:\s*\/\s*(?:un|pc|peça|kit|cx))?/i,
    );
    if (priceMatch) price = priceMatch[0].replace(/\s+/g, " ").trim();
  }

  // Fallback de disponibilidade
  if (!availability) {
    if (/em estoque|disponível|add to cart|comprar/i.test(html)) {
      availability = "Disponível";
    } else if (/sem estoque|esgotado|indisponível|out of stock/i.test(html)) {
      availability = "Indisponível";
    }
  }

  const name = jsonLdName || rawName || null;

  return { name, price, availability, imageUrl };
}

function resolveUrl(url: string | null, base: string): string | null {
  if (!url || url.startsWith("data:")) return null;
  try {
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, new URL(base).origin).toString();
  } catch {
    return null;
  }
}

// Faz scraping de múltiplas URLs candidatas para encontrar dados do produto.
async function scrapeProductBySku(
  siteUrl: string,
  sku: string,
): Promise<ScrapedProductData> {
  const candidates = buildProductSearchUrls(siteUrl, sku);

  for (const candidateUrl of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(candidateUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BrieFlowBot/1.0; +https://brieflow.app)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (!res.ok) continue;
      if (!(res.headers.get("content-type") ?? "").includes("text/html")) continue;

      const html = await res.text();
      if (!html || html.length < 100) continue;

      // Verifica se o SKU aparece na página (evita resultados irrelevantes)
      if (!html.toLowerCase().includes(sku.toLowerCase())) continue;

      const extracted = extractProductData(html, candidateUrl, sku);

      if (extracted.name || extracted.imageUrl) {
        return {
          sku,
          ...extracted,
          productUrl: candidateUrl,
          found: true,
        };
      }
    } catch {
      // Tenta próxima URL
    }
  }

  return {
    sku,
    name: null,
    price: null,
    availability: null,
    imageUrl: null,
    productUrl: null,
    found: false,
    error: `Produto com SKU "${sku}" não foi encontrado no site. Verifique a referência ou forneça a URL direta da página do produto.`,
  };
}

// ─── SERVER FUNCTIONS ─────────────────────────────────────────────────────────

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

// Nova Server Function — busca produto por SKU e retorna dados estruturados.
export const scrapeProductBySkuFn = createServerFn({ method: "POST" })
  .validator((data: { siteUrl: string; sku: string }) => {
    if (!data?.siteUrl || typeof data.siteUrl !== "string") {
      throw new Error("URL do site obrigatória.");
    }
    if (!data?.sku || typeof data.sku !== "string") {
      throw new Error("SKU obrigatório.");
    }
    const normalized = normalizeUrl(data.siteUrl);
    if (!normalized) throw new Error("URL do site inválida.");
    return { siteUrl: normalized, sku: data.sku.trim() };
  })
  .handler(async ({ data }): Promise<ScrapedProductData> => {
    return scrapeProductBySku(data.siteUrl, data.sku);
  });
