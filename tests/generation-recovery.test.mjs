import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getBuilderCampaignBrandName,
  getCampaignBrandName,
  getGenerationErrorMessage,
} from "../src/lib/campaignGeneration.ts";

test("uses the real provider error and keeps legacy failures recoverable", () => {
  assert.equal(
    getGenerationErrorMessage({
      type: "email",
      brandName: "Aurora Café",
      generationError:
        "Os provedores de IA estão temporariamente indisponíveis.",
    }),
    "Os provedores de IA estão temporariamente indisponíveis.",
  );

  assert.equal(
    getGenerationErrorMessage({
      type: "email",
      title: "Não consegui gerar este e-mail",
      body: "Falha temporária.",
    }),
    "Falha temporária.",
  );

  assert.equal(
    getGenerationErrorMessage({
      type: "email",
      title: "Cafés brasileiros na sua porta",
      body: "Conteúdo válido.",
    }),
    undefined,
  );
});

test("discovery keeps typed AI errors and omits the empty UI placeholder", () => {
  const source = readFileSync(
    new URL("../src/lib/ollama.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const compactHistory = history\.filter/);
  assert.match(source, /message\.content\.trim\(\)\.length > 0/);
  assert.match(source, /if \(error instanceof AiClientError\) throw error/);
});

test("failed legacy asset inherits the brand from the same campaign", () => {
  assert.equal(
    getCampaignBrandName([
      { content: { type: "email", title: "Não consegui gerar este e-mail" } },
      { content: { type: "banner", brandName: "Aurora Café" } },
    ]),
    "Aurora Café",
  );
});

test("saved campaigns recover their brand from the approved discovery plan", () => {
  assert.equal(
    getBuilderCampaignBrandName({
      type: "campaign",
      discoveryPlan: { brandName: "Aurora Café" },
      campaignAssets: [],
    }),
    "Aurora Café",
  );
});

test("retry regenerates only the failed channel without another discovery call", () => {
  const source = readFileSync(
    new URL("../src/hooks/useBriefflowAgent.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const regenerateChannel = useCallback/);
  assert.match(
    source,
    /currentChatHistory\(\),\s*channel,\s*\["all"\],\s*"omniroute"/,
  );
  assert.doesNotMatch(source, /A requisição excedeu o tempo limite/);
});

test("campaign approval starts content generation without a second discovery credit", () => {
  const agent = readFileSync(
    new URL("../src/hooks/useBriefflowAgent.ts", import.meta.url),
    "utf8",
  );
  const builder = readFileSync(
    new URL("../src/components/briefflow/PageBuilder.tsx", import.meta.url),
    "utf8",
  );

  assert.match(agent, /const generateCampaign = useCallback/);
  assert.match(
    agent,
    /currentChatHistory\(\),\s*undefined,\s*\["all"\],\s*"omniroute"/,
  );
  assert.match(builder, /onApprove=\{\(\) => void onGenerateCampaign\(\)\}/);
  assert.doesNotMatch(builder, /Aprovado\. Gere os materiais/);
});

test("retry keeps the campaign plan and saved image references after library load", () => {
  const source = readFileSync(
    new URL("../src/hooks/useBriefflowAgent.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /discoveryPlanRef\.current \?\? builderRef\.current\.discoveryPlan/,
  );
  assert.match(source, /savedCampaignImages/);
  assert.match(source, /builder\.type === "none"/);
});

test("retry filters legacy empty image references before rendering the campaign", () => {
  const agent = readFileSync(
    new URL("../src/hooks/useBriefflowAgent.ts", import.meta.url),
    "utf8",
  );
  const draggableImage = readFileSync(
    new URL("../src/components/briefflow/DraggableImage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    agent,
    /typeof image === "string" && image\.trim\(\)\.length > 0/,
  );
  assert.match(
    draggableImage,
    /const safeSrc = typeof src === "string" \? src : ""/,
  );
});

test("social preview does not fabricate engagement", () => {
  const source = readFileSync(
    new URL("../src/components/briefflow/SocialPreview.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /Curtido por milhares de pessoas/);
  assert.match(source, /Prévia da publicação patrocinada/);
});
