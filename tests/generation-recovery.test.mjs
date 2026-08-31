import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getGenerationErrorMessage } from "../src/lib/campaignGeneration.ts";

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

test("retry regenerates only the failed channel without another discovery call", () => {
  const source = readFileSync(
    new URL("../src/hooks/useBriefflowAgent.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const regenerateChannel = useCallback/);
  assert.match(
    source,
    /generateCampaignSafely\(history, channel, \["all"\], "omniroute"\)/,
  );
  assert.doesNotMatch(source, /A requisição excedeu o tempo limite/);
});

test("social preview does not fabricate engagement", () => {
  const source = readFileSync(
    new URL("../src/components/briefflow/SocialPreview.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /Curtido por milhares de pessoas/);
  assert.match(source, /Prévia da publicação patrocinada/);
});
