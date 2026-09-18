import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("manual chat upload is authoritative for the rendered banner hero", () => {
  const panel = source("../src/components/briefflow/ChatPanel.tsx");
  assert.match(panel, /productImageUrl: url/);
  assert.match(panel, /productImages: \[url\]/);
  assert.match(panel, /deliberate manual upload is authoritative/i);
});

test("real-product banners generate an empty environmental background plate", () => {
  const generator = source("../src/hooks/useGenerateMaterials.ts");
  assert.match(generator, /BACKGROUND PLATE ONLY for a premium commercial banner/);
  assert.match(generator, /absolutely no advertised product/);
  assert.match(generator, /reserved product zone/);
  assert.match(generator, /productSafeBackgroundPrompt/);
  assert.match(generator, /isUploadedProductAsset/);
});

test("image render globally hardens background-only prompts", () => {
  const renderer = source("../src/lib/imageRender.ts");
  assert.match(renderer, /isBackgroundPlate/);
  assert.match(renderer, /BACKGROUND PLATE ONLY/);
  assert.match(renderer, /no similar foreground product/);
  assert.match(renderer, /no pasted photo rectangles/);
});

test("premium product cleanup preserves photographed objects and blocks white-background bleed", () => {
  const product = source("../src/components/briefflow/PremiumProductImage.tsx");
  assert.match(product, /estimateEdgeBackground/);
  assert.match(product, /inlierRatio >= 0\.58/);
  assert.match(product, /localGradientMagnitude/);
  assert.match(product, /gradient <= 26/);
  assert.doesNotMatch(product, /isolatePrimaryObject/);
  assert.match(product, /preserves every object that was actually/i);
  assert.match(product, /cropTransparentMargins/);
});
