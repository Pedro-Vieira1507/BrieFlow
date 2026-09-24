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
  assert.match(
    input,
    /Use a imagem anexada como foto real principal do produto/,
  );
});

test("chat uploads become the authoritative campaign product image", () => {
  const panel = source("../src/components/briefflow/ChatPanel.tsx");

  assert.match(panel, /uploadCampaignAsset\(file, "products"\)/);
  assert.match(panel, /setUploadedImage\(url\)/);
  assert.match(panel, /productImageUrl: url/);
  assert.match(panel, /productImages: \[url\]/);
  assert.match(panel, /withAttachedProductImage/);
});

test("attached product image resolves broad image-request wording", () => {
  const context = source("../src/lib/productImageContext.ts");

  assert.match(context, /PRODUCT_IMAGE_REQUEST_PATTERN/);
  assert.match(context, /microcentr/);
  assert.match(context, /receber/);
  assert.match(context, /missingInfo: asksForProductImage/);
  assert.match(context, /Foto real do produto anexada pelo usuário/);
});

test("product image upload continues automatically when assistant requested it", () => {
  const panel = source("../src/components/briefflow/ChatPanel.tsx");

  assert.match(panel, /asksForProductImage\(lastAssistantMessage\.content\)/);
  assert.match(panel, /Considere esse requisito atendido/);
  assert.match(panel, /onSend\(IMAGE_ATTACHED_CONTINUE_MESSAGE\)/);
});

test("discovery agent reads live uploaded image instead of a stale render closure", () => {
  const agent = source("../src/hooks/useBriefflowAgent.ts");

  assert.match(
    agent,
    /const liveBeforeRequest = useBriefflowStore\.getState\(\)/,
  );
  assert.match(
    agent,
    /const liveUploadedImage = liveBeforeRequest\.uploadedImage/,
  );
  assert.match(agent, /withAttachedProductImage\([\s\S]*mergedPlanForRequest/);
  assert.match(agent, /liveImageAfterResponse/);
});

test("discovery model cannot reopen an already satisfied image requirement", () => {
  const ollama = source("../src/lib/ollama.ts");

  assert.match(ollama, /A FOTO REAL JÁ FOI RECEBIDA/);
  assert.match(ollama, /NÃO peça foto, imagem, anexo ou reenvio/);
  assert.match(ollama, /withAttachedProductImage/);
});

test("campaign generation prioritizes the live image attached in chat", () => {
  const agent = source("../src/hooks/useBriefflowAgent.ts");
  const live = agent.indexOf("const liveUploadedImageForGeneration");
  const uploaded = agent.indexOf("[liveUploadedImageForGeneration]");
  const scraped = agent.indexOf("...scrapedProductsRef.current");

  assert.ok(
    live >= 0,
    "generation must read uploadedImage from live store state",
  );
  assert.ok(
    uploaded >= 0,
    "live uploaded image must enter the campaign image list",
  );
  assert.ok(scraped >= 0, "scraped images must remain available as references");
  assert.ok(
    uploaded < scraped,
    "the deliberate chat upload must outrank scraped product images",
  );
});
