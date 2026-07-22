// src/lib/product-image.ts
// Server Function que busca a imagem real de um produto pelo SKU/referência no site do cliente.

import { createServerFn } from "@tanstack/react-start";

export interface ProductImageResult {
  imageUrl: string | null;
  productName: string | null;
  productUrl: string | null;
  found: boolean;
  error?: string;
}

// Padrões de URL de produto para os principais e-commerces brasileiros.
// Quando não casa nenhum, tenta busca pelo campo de pesquisa do site.
function buildProductSearchUrls(baseUrl: string, sku: string): string[] {
  try {
    const origin = new URL(baseUrl).origin;
    const skuEncoded = encodeURIComponent(sku.trim());
    return [
      // Busca interna (funciona na maioria dos e-commerces)
      `${origin}/busca?q=${skuEncoded}`,
      `${origin}/search?q=${skuEncoded}`,
      `${origin}/pesquisa?q=${skuEncoded}`,
      `${origin}/?s=${skuEncoded}`,
      `${origin}/catalogsearch/result/?q=${skuEncoded}`, // Magento
      `${origin}/buscar/${skuEncoded}`,                   // Lojas personalizadas
      `${origin}/produto/${skuEncoded}`,                  // URL direta
      `${origin}/p/${skuEncoded}`,
    ];
  } catch {
    return [];
  }
}

// Extrai a primeira imagem relevante de um produto de uma página HTML.
function extractProductImage(html: string, baseUrl: string): { imageUrl: string | null; productName: string | null } {
  // 1. Open Graph image (mais confiável em páginas de produto)
  const ogImageMatch = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
  
  const ogImage = ogImageMatch?.[1]?.trim();

  // 2. Título do produto (og:title ou <title>)
  const ogTitleMatch = html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i);
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const productName = (ogTitleMatch?.[1] ?? titleTagMatch?.[1] ?? "").trim().replace(/\s+/g, " ");

  if (ogImage) {
    const resolved = resolveImageUrl(ogImage, baseUrl);
    if (resolved) return { imageUrl: resolved, productName };
  }

  // 3. Schema.org Product (JSON-LD) — muito comum em e-commerces modernos
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      const content = block.replace(/<script[^>]*>|<\/script>/gi, "");
      try {
        const data = JSON.parse(content) as Record<string, unknown>;
        const imageField = (data as { image?: unknown }).image;
        if (imageField) {
          const imageUrl = Array.isArray(imageField) ? String(imageField[0]) : String(imageField);
          const resolved = resolveImageUrl(imageUrl, baseUrl);
          if (resolved) return { imageUrl: resolved, productName };
        }
      } catch {
        // continua
      }
    }
  }

  // 4. Imagens com classes comuns de produto (fallback)
  const productImgPatterns = [
    /<img[^>]+class=["'][^"']*(?:product[_-]?image|main[_-]?image|hero[_-]?image|product[_-]?photo)[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+(?:data-zoom-image|data-src|src)=["']([^"']+\.(jpg|jpeg|png|webp))[^"']*["'][^>]+class=["'][^"']*product[^"']*["']/i,
    /<img[^>]+id=["'][^"']*(?:main[_-]?image|product[_-]?image)[^"']*["'][^>]+src=["']([^"']+)["']/i,
  ];

  for (const pattern of productImgPatterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      const resolved = resolveImageUrl(m[1], baseUrl);
      if (resolved) return { imageUrl: resolved, productName };
    }
  }

  return { imageUrl: null, productName };
}

// Resolve URLs relativas para absolutas.
function resolveImageUrl(url: string, baseUrl: string): string | null {
  if (!url || url.startsWith("data:")) return null;
  try {
    if (/^https?:\/\//i.test(url)) return url;
    const base = new URL(baseUrl);
    return new URL(url, base.origin).toString();
  } catch {
    return null;
  }
}

// Faz scraping de múltiplas URLs candidatas para encontrar a imagem do produto.
async function fetchProductImage(
  siteUrl: string,
  sku: string,
): Promise<ProductImageResult> {
  const candidates = buildProductSearchUrls(siteUrl, sku);

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(url, {
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

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) continue;

      const html = await res.text();
      if (!html || html.length < 100) continue;

      const { imageUrl, productName } = extractProductImage(html, url);

      if (imageUrl) {
        return {
          imageUrl,
          productName: productName || null,
          productUrl: url,
          found: true,
        };
      }
    } catch {
      // Tenta próxima URL candidata
    }
  }

  return {
    imageUrl: null,
    productName: null,
    productUrl: null,
    found: false,
    error: `Não foi possível encontrar uma imagem para o SKU "${sku}" no site ${siteUrl}. Verifique se o produto existe ou tente fornecer a URL direta da página do produto.`,
  };
}

// Server Function exportada — chamada pelo frontend quando o usuário fornece um SKU.
export const fetchProductImageBySku = createServerFn({ method: "POST" })
  .validator((data: { siteUrl: string; sku: string }) => {
    if (!data?.siteUrl || typeof data.siteUrl !== "string") {
      throw new Error("URL do site obrigatória.");
    }
    if (!data?.sku || typeof data.sku !== "string") {
      throw new Error("SKU/Referência do produto obrigatório.");
    }
    return { siteUrl: data.siteUrl.trim(), sku: data.sku.trim() };
  })
  .handler(async ({ data }): Promise<ProductImageResult> => {
    return fetchProductImage(data.siteUrl, data.sku);
  });