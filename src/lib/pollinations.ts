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
  const { width = 1080, height = 1080, seed } = opts;
  
  // Geração Determinística: Transforma o texto num número fixo para manter a arte sempre idêntica
  const textHash = Math.abs(prompt.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0));
  const safeSeed = seed ?? (textHash % 10000 || 42);

  return `https://picsum.photos/seed/${safeSeed}/${width}/${height}`;
}