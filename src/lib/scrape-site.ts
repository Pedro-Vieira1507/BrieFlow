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
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i"),
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
  return `${text.slice(0, maxLen)}...`;
}

function inferBrandName(title: string, url: string): string {
  if (title) {
    const parts = title.split(/[|\- :]/).map((p) => p.trim()).filter(Boolean);
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

function extractColors(html: string): string[] {
  const colors = new Set<string>();
  
  const themeMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,6})["']/i);
  if (themeMatch) colors.add(themeMatch[1].toUpperCase());

  const hexRegex = /#([0-9a-fA-F]{6})\b/g;
  let match;
  while ((match = hexRegex.exec(html)) !== null && colors.size < 15) {
    colors.add(match[0].toUpperCase());
  }

  const ignoreList = ['#FFFFFF', '#000000', '#111111', '#222222', '#333333', '#EEEEEE', '#DDDDDD', '#CCCCCC', '#F5F5F5', '#FAFAFA'];
  const brandColors = Array.from(colors).filter(c => !ignoreList.includes(c));
  
  return brandColors.slice(0, 5);
}

export function parseWebsiteHtml(html: string, url: string): SiteBrandData {
  const title = extractTitle(html);
  const description = metaContent(html, ["description", "og:description", "twitter:description"]);
  const keywords = metaContent(html, ["keywords"]);
  const ogImage = metaContent(html, ["og:image", "twitter:image"]);
  const headings = extractHeadings(html);
  const bodySnippet = extractBodySnippet(html);
  const brandName = inferBrandName(title, url);
  const colors = extractColors(html);

  return {
    url, title, description, brandName, headings, bodySnippet, 
    ogImage: ogImage || undefined, keywords: keywords || undefined, colors,
  };
}

export function formatSiteContextForAgent(site: SiteBrandData): string {
  const lines = [
    `URL: ${site.url}`,
    `Marca: ${site.brandName}`,
    site.title ? `Título: ${site.title}` : null,
    site.description ? `Descrição: ${site.description}` : null,
    site.colors?.length ? `Paleta de Cores Extraída: ${site.colors.join(", ")}` : null,
    site.headings.length ? `Headings: ${site.headings.slice(0, 6).join(" | ")}` : null,
    site.bodySnippet ? `Conteúdo extraído:\n${site.bodySnippet.slice(0, 1200)}` : null,
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!res.ok) throw new Error(`Site retornou HTTP ${res.status}`);
    
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("A URL não aponta para uma página HTML.");
    }

    const html = await res.text();
    if (!html || html.length < 40) throw new Error("Página vazia ou inacessível.");

    return parseWebsiteHtml(html, url);
  } finally {
    clearTimeout(timeout);
  }
}

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

function buildProductSearchUrls(siteUrl: string, sku: string): string[] {
  try {
    const origin = new URL(siteUrl).origin;
    const cleanSku = sku.split(',')[0].trim();
    const enc = encodeURIComponent(cleanSku);
    return [
      `${origin}/busca?q=${enc}`, `${origin}/search?q=${enc}`, `${origin}/pesquisa?q=${enc}`,
      `${origin}/?s=${enc}`, `${origin}/catalogsearch/result/?q=${enc}`, `${origin}/buscar/${enc}`,
      `${origin}/buscar?q=${enc}`, `${origin}/busca?busca=${enc}`, `${origin}/search/?q=${enc}`,
      `${origin}/produto/${enc}`, `${origin}/p/${enc}`, `${origin}/${enc}`,
    ];
  } catch { return []; }
}

function extractProductData(html: string, baseUrl: string, sku: string): Omit<ScrapedProductData, "sku" | "found" | "productUrl"> {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null;
  const ogTitleMatch = html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i);
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawName = (ogTitleMatch?.[1] ?? titleTagMatch?.[1] ?? "").trim().replace(/\s+/g, " ");

  let nameFallback = h1Text;
  if (nameFallback && /resultados|busca|search|encontrado|não encontrado/i.test(nameFallback)) nameFallback = null;
  if (!nameFallback && rawName) nameFallback = rawName.split(/[-|]/)[0].trim();

  const ogImageMatch = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
  let imageUrl = resolveUrl(ogImageMatch?.[1]?.trim() ?? null, baseUrl);

  let price: string | null = null;
  let availability: string | null = null;
  let jsonLdName: string | null = null;

  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      const content = block.replace(/<script[^>]*>|<\/script>/gi, "");
      try {
        const data = JSON.parse(content) as Record<string, unknown>;
        const candidates: Record<string, unknown>[] = Array.isArray(data) ? data : Array.isArray(data["@graph"]) ? (data["@graph"] as Record<string, unknown>[]) : [data];
        for (const item of candidates) {
          const type = String(item["@type"] ?? "").toLowerCase();
          if (!type.includes("product")) continue;
          if (!jsonLdName && item.name) jsonLdName = String(item.name).trim();
          if (!imageUrl) {
            const imgField = item.image;
            const imgRaw = Array.isArray(imgField) ? String(imgField[0]) : String(imgField ?? "");
            if (imgRaw && typeof imgRaw === "string" && imgRaw.startsWith("http")) imageUrl = resolveUrl(imgRaw, baseUrl);
          }
          const offers = item.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
          if (offers && !price) {
            const offerList = Array.isArray(offers) ? offers : [offers];
            for (const offer of offerList) {
              const rawPrice = offer.price ?? offer.lowPrice;
              if (rawPrice !== undefined) {
                const numPrice = parseFloat(String(rawPrice));
                if (!isNaN(numPrice) && numPrice > 0) {
                  price = `R$ ${numPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
                  const avail = String(offer.availability ?? "").toLowerCase();
                  if (avail.includes("instock") || avail.includes("preorder")) availability = "Disponível";
                  else if (avail.includes("outofstock")) availability = "Indisponível";
                  break;
                }
              }
            }
          }
        }
      } catch { /* ignore */ }
    }
  }

  if (!price) {
    const metaPriceMatch = html.match(/<meta[^>]+(?:property|name|itemprop)=["'](?:product:price:amount|price)["'][^>]+content=["']([\d.,]+)["']/i) ?? html.match(/<meta[^>]+content=["']([\d.,]+)["'][^>]+(?:property|name|itemprop)=["'](?:product:price:amount|price)["']/i);
    if (metaPriceMatch) {
      const val = parseFloat(metaPriceMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) price = `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }
  }
  if (!price) {
    const priceRegex = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
    let match; const prices = [];
    while ((match = priceRegex.exec(html)) !== null) prices.push(match[1]);
    if (prices.length > 0) price = `R$ ${prices.length > 1 ? prices[1] : prices[0]}`;
  }
  if (!availability) {
    if (/em estoque|disponível|add to cart|comprar|adicionar ao carrinho/i.test(html)) availability = "Disponível";
    else if (/sem estoque|esgotado|indisponível|out of stock/i.test(html)) availability = "Indisponível";
  }
  const name = jsonLdName || nameFallback || null;
  return { name, price, availability, imageUrl };
}

function resolveUrl(url: string | null, base: string): string | null {
  if (!url || url.startsWith("data:")) return null;
  try { return /^https?:\/\//i.test(url) ? url : new URL(url, new URL(base).origin).toString(); } 
  catch { return null; }
}

async function scrapeProductBySku(siteUrl: string, sku: string): Promise<ScrapedProductData> {
  const cleanSku = sku.split(',')[0].trim(); 
  const candidates = buildProductSearchUrls(siteUrl, cleanSku);
  
  for (const candidateUrl of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(candidateUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) continue;
      
      let html = await res.text();
      let currentUrl = res.url; 
      if (!html || html.length < 100) continue;

      const skuRegex = new RegExp(cleanSku.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
      const aTags = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
      let foundLink = null;
      for (const aTag of aTags) {
        const hrefMatch = aTag.match(/href=["']([^"']+)["']/i);
        const href = hrefMatch ? hrefMatch[1] : null;
        if (href && href.length > 2 && !href.startsWith('#') && !href.startsWith('javascript') && !href.includes('?q=')) {
          if (skuRegex.test(href) || skuRegex.test(aTag)) {
            foundLink = resolveUrl(href, currentUrl);
            break;
          }
        }
      }

      if (foundLink && foundLink !== currentUrl) {
        const prodController = new AbortController();
        const prodTimeout = setTimeout(() => prodController.abort(), 10_000);
        const prodRes = await fetch(foundLink, {
            signal: prodController.signal, headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, redirect: "follow",
        });
        clearTimeout(prodTimeout);
        if (prodRes.ok && (prodRes.headers.get("content-type") ?? "").includes("text/html")) {
            html = await prodRes.text(); currentUrl = prodRes.url;
        }
      }

      const extracted = extractProductData(html, currentUrl, cleanSku);
      
      const lowerName = extracted.name?.toLowerCase() || "";
      const isInvalidName = !extracted.name || 
        lowerName.includes("melhor loja") || 
        lowerName.includes("resultados para") || 
        lowerName === "home" ||
        lowerName === "forlabexpress" ||
        lowerName.includes("forlab") || 
        lowerName.length < 3;

      const isLikelyProduct = !isInvalidName && (extracted.price || extracted.imageUrl);

      if (isLikelyProduct) {
        return { sku: cleanSku, ...extracted, productUrl: currentUrl, found: true };
      }
    } catch { }
  }
  return { sku: sku.split(',')[0].trim(), name: null, price: null, availability: null, imageUrl: null, productUrl: null, found: false, error: `Produto não localizado. Certifique-se de enviar o link direto ou revisar o SKU.` };
}

// NOVO: Busca diretamente na URL (Com proteção para não escanear a homepage inteira como se fosse produto)
async function scrapeProductByUrl(productUrl: string): Promise<ScrapedProductData> {
  try {
    const parsedUrl = new URL(productUrl);
    // TRAVA DE SEGURANÇA: Se a URL for apenas o domínio principal, rejeita imediatamente.
    if (parsedUrl.pathname === "/" || parsedUrl.pathname === "") {
      return { sku: productUrl, name: null, price: null, availability: null, imageUrl: null, productUrl: null, found: false, error: `A URL informada é a página inicial da loja, não um produto.` };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(productUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      redirect: "follow",
    });
    clearTimeout(timeout);
    
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) {
        throw new Error("Página não é HTML válido.");
    }
    
    const html = await res.text();
    const extracted = extractProductData(html, res.url, "");
    
    const lowerName = extracted.name?.toLowerCase() || "";
    const isInvalidName = !extracted.name || lowerName.includes("melhor loja") || lowerName.includes("resultados para") || lowerName.length < 3;
    const isLikelyProduct = !isInvalidName && (extracted.price || extracted.imageUrl || extracted.name);

    if (isLikelyProduct) {
      return { sku: productUrl, ...extracted, productUrl: res.url, found: true };
    }
  } catch { }
  return { sku: productUrl, name: null, price: null, availability: null, imageUrl: null, productUrl: null, found: false, error: `Falha ao extrair dados do link fornecido.` };
}

export const scrapeWebsite = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => {
    if (!data?.url) throw new Error("URL obrigatória.");
    const normalized = normalizeUrl(data.url);
    if (!normalized) throw new Error("URL inválida.");
    return { url: normalized };
  })
  .handler(async ({ data }) => fetchWebsite(data.url));

export const scrapeProductBySkuFn = createServerFn({ method: "POST" })
  .validator((data: { siteUrl: string; sku: string }) => {
    if (!data?.siteUrl || !data?.sku) throw new Error("URL e SKU obrigatórios.");
    const normalized = normalizeUrl(data.siteUrl);
    return { siteUrl: normalized!, sku: data.sku.trim() };
  })
  .handler(async ({ data }) => scrapeProductBySku(data.siteUrl, data.sku));

export const scrapeProductByUrlFn = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => {
    const normalized = normalizeUrl(data.url);
    if (!normalized) throw new Error("URL inválida.");
    return { url: normalized };
  })
  .handler(async ({ data }) => scrapeProductByUrl(data.url));