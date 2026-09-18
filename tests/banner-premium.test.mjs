import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bannerSource = readFileSync(
  new URL("../src/components/briefflow/BannerPreview.tsx", import.meta.url),
  "utf8",
);
const productSource = readFileSync(
  new URL("../src/components/briefflow/PremiumProductImage.tsx", import.meta.url),
  "utf8",
);

test("premium banner defaults to a single hero product", () => {
  assert.match(bannerSource, /productDisplayMode === "gallery"/);
  assert.match(bannerSource, /productImages\.slice\(0, 1\)/);
  assert.match(bannerSource, /productDisplayMode: "hero"/);
});

test("premium banner keeps gallery as an explicit composition mode", () => {
  assert.match(bannerSource, /Hero único/);
  assert.match(bannerSource, /Vitrine/);
  assert.match(bannerSource, /productImages\.slice\(0, 3\)/);
});

test("manual product uploads become the primary product image", () => {
  assert.match(bannerSource, /productImageUrl: urls\[0\]/);
  assert.match(bannerSource, /productImages: \[\.\.\.urls, \.\.\.existing\]/);
});

test("visual regeneration explicitly rejects collage-style backgrounds", () => {
  assert.match(bannerSource, /no collage, no thumbnail grid/);
  assert.match(bannerSource, /do not redraw or duplicate the real product/);
});

test("product integration removes only edge-connected light backgrounds", () => {
  assert.match(productSource, /estimateEdgeBackground/);
  assert.match(productSource, /removedRatio < 0\.08/);
  assert.match(productSource, /pixelDistance\(data, offset, background\) <= 30/);
  assert.match(productSource, /data\[index \* 4 \+ 3\] = 0/);
  assert.match(productSource, /refineCutoutEdge/);
  assert.match(productSource, /alpha = Math\.round\(210/);
  assert.match(productSource, /cleanedImageCache/);
});

test("product cleanup preserves every photographed product view", () => {
  assert.doesNotMatch(productSource, /isolatePrimaryObject/);
  assert.doesNotMatch(productSource, /dominant object/);
  assert.match(productSource, /preserves every object that was actually/);
});

test("white-product cutouts use a gradient barrier instead of a raw-image fallback", () => {
  assert.match(productSource, /localGradientMagnitude/);
  assert.match(productSource, /gradient <= 26/);
  assert.match(productSource, /imageSmoothingQuality = "high"/);
  assert.doesNotMatch(productSource, /riskyPixels \/ edgePixels > 0\.72/);
});
