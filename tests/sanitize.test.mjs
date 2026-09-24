import assert from "node:assert/strict";
import test from "node:test";

import { cleanOffer, isEmptyLike } from "../src/lib/sanitize.ts";
import { toMarketingBrief } from "../src/types/brief.ts";

test("recognizes feminine and UI placeholder variants as semantic empty values", () => {
  for (const value of [
    "Não informada",
    "nao informada",
    "Sem oferta definida",
    "Oferta não informada",
  ]) {
    assert.equal(isEmptyLike(value), true, value);
    assert.equal(cleanOffer(value), null, value);
  }
});

test("typed marketing brief never promotes an empty-like offer", () => {
  const brief = toMarketingBrief({
    brandContext: {
      brandName: "Café Aurora",
      offer: "Sem oferta definida",
    },
    plan: {
      detectedContext: "Café especial brasileiro.",
      missingInfo: "",
      proposedStrategy: "Apresentar a marca.",
      offer: "Não informada",
    },
  });

  assert.equal(brief.offer, null);
});
