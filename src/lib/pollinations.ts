// src/lib/pollinations.ts
const urlCache = new Map<string, string>();

export function buildPollinationsUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): string {
  const { width = 1080, height = 1080, seed } = opts;
  let cleanPrompt = (prompt || "").replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  if (cleanPrompt.length > 100) cleanPrompt = cleanPrompt.substring(0, 100);
  if (!cleanPrompt || cleanPrompt.length < 3) cleanPrompt = "beautiful aesthetic commercial photography";

  const fullPrompt = `${cleanPrompt} highly detailed photorealistic`;
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
  // Fallback alterado: removemos o picsum.photos (que trazia imagens aleatórias) 
  // e colocamos um placeholder neutro corporativo.
  return `https://placehold.co/${width}x${height}/f1f5f9/94a3b8?text=Arte+em+Geracao`;
}