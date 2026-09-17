import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("chat composer exposes a real product image attachment control", () => {
  const input = source("../src/components/briefflow/chat/ChatInput.tsx");

  assert.match(input, /type="file"/);
  assert.match(input, /image\/png,image\/jpeg,image\/webp/);
  assert.match(input, /Foto real do produto anexada/);
  assert.match(input, /Use a imagem anexada como foto real principal do produto/);
});

test("chat uploads become the primary campaign product image", () => {
  const panel = source("../src/components/briefflow/ChatPanel.tsx");

  assert.match(panel, /uploadCampaignAsset\(file, "products"\)/);
  assert.match(panel, /setUploadedImage\(url\)/);
  assert.match(panel, /productImageUrl: url/);
  assert.match(panel, /new Set\(\[\s*url,/);
});

test("product image upload resolves image-related discovery gaps and continues automatically", () => {
  const panel = source("../src/components/briefflow/ChatPanel.tsx");

  assert.match(panel, /PRODUCT_IMAGE_REQUEST_PATTERN/);
  assert.match(panel, /missingInfo = PRODUCT_IMAGE_REQUEST_PATTERN\.test/);
  assert.match(panel, /IMAGE_CONTEXT_MARKER/);
  assert.match(panel, /Considere esse requisito atendido/);
  assert.match(panel, /onSend\(IMAGE_ATTACHED_CONTINUE_MESSAGE\)/);
});

test("campaign generation prioritizes the image attached in chat", () => {
  const agent = source("../src/hooks/useBriefflowAgent.ts");
  const uploaded = agent.indexOf("...(uploadedImage ? [uploadedImage] : [])");
  const scraped = agent.indexOf("...scrapedProductsRef.current");

  assert.ok(uploaded >= 0, "uploadedImage must be part of the campaign image list");
  assert.ok(scraped >= 0, "scraped images must remain available as references");
  assert.ok(
    uploaded < scraped,
    "the deliberate chat upload must outrank scraped product images",
  );
});
