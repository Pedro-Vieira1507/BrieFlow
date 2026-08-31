import assert from "node:assert/strict";
import test from "node:test";

import { mergeDetectedBriefContext } from "../src/lib/discoveryContext.ts";

test("preserva marca, oferta e público extraídos mesmo quando o builder os omite", () => {
  const merged = mergeDetectedBriefContext(
    {
      detectedContext: "Assinatura mensal de cafés especiais.",
      missingInfo: "",
      proposedStrategy: "Origem como descoberta recorrente.",
    },
    {
      brandName: "Aurora Café",
      productName: "Assinatura de microlotes brasileiros",
      offer: "15% de desconto na primeira caixa",
      audience: "Pessoas que preparam café em casa",
      tone: "Premium, caloroso e sem elitismo",
      objective: "Conquistar novas assinaturas",
      productSku: null,
      productUrl: null,
    },
  );

  assert.equal(merged.brandName, "Aurora Café");
  assert.equal(merged.product, "Assinatura de microlotes brasileiros");
  assert.equal(merged.offer, "15% de desconto na primeira caixa");
  assert.equal(merged.audience, "Pessoas que preparam café em casa");
  assert.equal(merged.detectedContext, "Assinatura mensal de cafés especiais.");
});

test("cria resumo factual quando o modelo não devolve texto acumulado", () => {
  const merged = mergeDetectedBriefContext(undefined, {
    brandName: "Aurora Café",
    productName: "Clube de café",
    objective: "Novas assinaturas",
  });

  assert.match(merged.detectedContext, /Marca: Aurora Café/);
  assert.match(merged.detectedContext, /Produto\/serviço: Clube de café/);
  assert.match(merged.detectedContext, /Objetivo: Novas assinaturas/);
});

test("remove exclusividade inventada da estratégia de descoberta", () => {
  const merged = mergeDetectedBriefContext(
    {
      detectedContext: "Assinatura mensal de microlotes brasileiros.",
      missingInfo: "",
      proposedStrategy:
        "Promessa central: café em casa; ângulo: simplicidade e exclusividade; ação: assinar",
    },
    {
      brandName: "Aurora Café",
      productName: "Assinatura de microlotes brasileiros",
      tone: "Premium, caloroso e sem elitismo",
    },
  );

  assert.equal(
    merged.proposedStrategy,
    "Promessa central: café em casa; ângulo: simplicidade; ação: assinar",
  );
});

test("preserva exclusividade quando ela é um fato confirmado", () => {
  const merged = mergeDetectedBriefContext(
    {
      detectedContext: "Clube exclusivo para membros.",
      missingInfo: "",
      proposedStrategy: "Ângulo: acesso exclusivo",
      product: "Clube exclusivo para membros",
    },
    undefined,
  );

  assert.equal(merged.proposedStrategy, "Ângulo: acesso exclusivo");
});
