// src/lib/pollinations.ts
const urlCache = new Map<string, string>();

export function buildPollinationsUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): string {
  const { width = 1080, height = 1080, seed } = opts;
  
  let cleanPrompt = (prompt || "").replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  if (cleanPrompt.length > 140) cleanPrompt = cleanPrompt.substring(0, 140);
  
  if (!cleanPrompt || cleanPrompt.length < 3) {
    cleanPrompt = "luxury commercial product photography cosmetic bottle studio lighting";
  }

  // UX & Design: Injeção de estúdio comercial profissional para evitar fotos amadoras
  const commercialKeywords = "high end commercial advertising photography, professional studio lighting, luxury editorial style, rim light, ultra detailed 8k, soft bokeh background, depth of field";
  const fullPrompt = `${cleanPrompt}, ${commercialKeywords}`;

  const cacheKey = `${fullPrompt}|${width}|${height}|${seed ?? "none"}`;
  if (urlCache.has(cacheKey)) return urlCache.get(cacheKey)!;

  const encoded = encodeURIComponent(fullPrompt);
  let url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true`;
  if (seed) url += `&seed=${seed}`;

  urlCache.set(cacheKey, url);
  return url;
}

export function buildFallbackUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): string {
  const { width = 1080, height = 1080 } = opts;
  return `https://placehold.co/${width}x${height}/0f172a/f8fafc?text=Arte+em+Geracao`;
}