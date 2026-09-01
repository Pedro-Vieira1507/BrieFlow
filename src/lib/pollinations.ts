// src/lib/pollinations.ts
const urlCache = new Map<string, string>();

export function buildPollinationsUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): string {
  const { width = 1080, height = 1080, seed } = opts;

  let cleanPrompt = (prompt || "").replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  if (cleanPrompt.length > 140) cleanPrompt = cleanPrompt.substring(0, 140);

  if (!cleanPrompt || cleanPrompt.length < 3) {
    cleanPrompt =
      "luxury commercial product photography cosmetic bottle studio lighting";
  }

  // UX & Design: Injeção de estúdio comercial profissional para evitar fotos amadoras
  const commercialKeywords =
    "high end commercial advertising photography, professional studio lighting, luxury editorial style, rim light, ultra detailed 8k, soft bokeh background, depth of field";
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
  const { width = 1080, height = 1080, seed = 0 } = opts;
  const source = `${prompt}|${seed}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const palettes = [
    ["#111827", "#7c3aed", "#f59e0b"],
    ["#1c1917", "#92400e", "#f5e7d0"],
    ["#082f49", "#0e7490", "#f0f9ff"],
    ["#172554", "#2563eb", "#f8fafc"],
    ["#052e2b", "#0f766e", "#fde68a"],
  ];
  const [base, accent, light] = palettes[(hash >>> 0) % palettes.length];
  const radius = Math.round(Math.min(width, height) * 0.42);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${base}"/>
        <stop offset="0.58" stop-color="${accent}"/>
        <stop offset="1" stop-color="${base}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${light}" stop-opacity=".72"/>
        <stop offset="1" stop-color="${light}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.28)}" r="${radius}" fill="url(#glow)"/>
    <circle cx="${Math.round(width * 0.18)}" cy="${Math.round(height * 0.82)}" r="${Math.round(radius * 0.72)}" fill="${accent}" opacity=".42"/>
    <path d="M0 ${Math.round(height * 0.68)} C ${Math.round(width * 0.3)} ${Math.round(height * 0.5)}, ${Math.round(width * 0.62)} ${Math.round(height * 0.86)}, ${width} ${Math.round(height * 0.58)} L ${width} ${height} L0 ${height}Z" fill="${base}" opacity=".7"/>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
