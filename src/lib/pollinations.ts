// Builds a premium Pollinations image URL (Flux model, enhanced, 1080x1080).
export function buildPollinationsUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): string {
  const { width = 1080, height = 1080, seed } = opts;
  const encoded = encodeURIComponent(prompt.trim());
  const params = new URLSearchParams({
    model: "flux",
    enhance: "true",
    nologo: "true",
    width: String(width),
    height: String(height),
  });
  if (seed !== undefined) params.set("seed", String(seed));
  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}
