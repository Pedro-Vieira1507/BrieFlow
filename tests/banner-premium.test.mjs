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
  assert.match(productSource, /removed \/ total < 0\.12/);
  assert.match(productSource, /data\[index \* 4 \+ 3\] = 0/);
  assert.match(productSource, /cleanedImageCache/);
});
