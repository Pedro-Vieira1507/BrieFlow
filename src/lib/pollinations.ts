// lib/pollinations.ts — Geração de Imagens Premium (Corrigido)

// Cache simples para evitar re-requests desnecessários
const urlCache = new Map<string, string>();

export function buildPollinationsUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): string {
  const { width = 1080, height = 1080, seed } = opts;

  // Direção de arte premium consistente para qualidade de agência
  const premiumSuffix =
    "premium commercial photography, cinematic dramatic lighting, high-end advertising aesthetic, editorial quality, ultra sharp focus, depth of field, professional color grading, 8k, award-winning brand campaign, no text, no watermark, no logo, no typography";

  const fullPrompt = `${prompt.trim()}, ${premiumSuffix}`;

  // Chave de cache
  const cacheKey = `${fullPrompt}|${width}|${height}|${seed ?? "none"}`;
  if (urlCache.has(cacheKey)) {
    return urlCache.get(cacheKey)!;
  }

  const encoded = encodeURIComponent(fullPrompt);
  const params = new URLSearchParams({
    model: "flux",
    enhance: "true",
    nologo: "true",
    private: "true",
    width: String(width),
    height: String(height),
  });
  if (seed !== undefined) params.set("seed", String(seed));

  const url = `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
  urlCache.set(cacheKey, url);
  return url;
}

// Função para gerar URL com modelo fallback (turbo) se flux falhar
export function buildFallbackUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): string {
  const { width = 1080, height = 1080, seed } = opts;
  const premiumSuffix =
    "premium commercial photography, cinematic lighting, high-end advertising, ultra sharp, 8k, no text, no watermark";
  const fullPrompt = `${prompt.trim()}, ${premiumSuffix}`;
  const encoded = encodeURIComponent(fullPrompt);
  const params = new URLSearchParams({
    model: "turbo",
    enhance: "true",
    nologo: "true",
    width: String(width),
    height: String(height),
  });
  if (seed !== undefined) params.set("seed", String(seed));
  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}