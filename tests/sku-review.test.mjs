import { test } from "node:test";
import assert from "node:assert/strict";
import { demoCampaign, demoProducts } from "../src/lib/skuDemo.ts";
import { parseCatalogCsv, productInput } from "../src/lib/productCatalog.ts";
import {
  affectsOutput,
  applySkuReview,
  formatPrice,
  parsePrice,
  reviewSku,
} from "../src/lib/skuReview.ts";
import { buildDeliveryEmail } from "../src/lib/emailDelivery.ts";
import { formatStructuredContentText } from "../src/lib/structuredContent.ts";

const catalog = demoProducts().map((p) => ({
  ...p,
  revision: "1",
  updatedAt: "2026-01-02T12:00:00Z",
}));
const [coffee] = catalog;
const current = { ...coffee, priceCents: 4490, revision: "2" };
function emailCampaign(body) {
  return {
    type: "campaign",
    skuLink: { approved: coffee },
    campaignAssets: [
      {
        id: "mail",
        type: "email",
        status: "approved",
        content: { type: "email", body },
      },
    ],
  };
}
const outputEmail = (state) =>
  buildDeliveryEmail(
    state.campaignAssets.find((a) => a.type === "email").content,
    "https://example.org/produto",
    "",
    state.discoveryPlan?.offer,
  );
const outputChat = (state) =>
  formatStructuredContentText(
    state.campaignAssets.find((a) => a.type === "whatsapp").content
      .structuredContent,
  );

test("pilot with ten SKUs and three independent catalog revisions finds exactly five affected pieces and delivers their approved text", () => {
  assert.equal(catalog.length, 10);
  const changes = new Map([
    [
      "DEMO-CAFE",
      {
        patch: { priceCents: 4490 },
        channels: ["whatsapp", "email"],
        old: "R$ 39,90",
        next: "R$ 44,90",
      },
    ],
    [
      "DEMO-CHA",
      {
        patch: { unit: "60 g" },
        channels: ["email"],
        old: "40 g",
        next: "60 g",
      },
    ],
    [
      "DEMO-MEL",
      {
        patch: { priceCents: 3650 },
        channels: ["whatsapp", "email"],
        old: "R$ 32,00",
        next: "R$ 36,50",
      },
    ],
  ]);
  let mentions = 0,
    preserved = 0;
  for (const item of catalog) {
    const state = demoCampaign(item),
      scenario = changes.get(item.sku);
    const next = scenario
      ? { ...item, ...scenario.patch, revision: "2" }
      : item;
    const issues = reviewSku(state, next);
    assert.deepEqual(
      issues.map((i) => i.channel),
      scenario?.channels ?? [],
    );
    mentions += issues.length;
    const corrected = applySkuReview(state, next, {});
    assert.deepEqual(reviewSku(corrected, next), []);
    for (const [index, asset] of state.campaignAssets.entries()) {
      if (!scenario?.channels.includes(asset.type)) {
        assert.equal(corrected.campaignAssets[index], asset);
        preserved++;
      }
    }
    if (scenario) {
      for (const channel of scenario.channels) {
        const render = channel === "email" ? outputEmail : outputChat;
        assert.ok(render(state).includes(scenario.old));
        assert.ok(render(corrected).includes(scenario.next));
        assert.ok(!render(corrected).includes(scenario.old));
      }
    }
  }
  assert.equal(mentions, 5);
  assert.equal(preserved, 25);
});

test("the reviewer can keep an independent freight price in the same field and reintroduced offers are caught", () => {
  const state = emailCampaign(
    "Texto que editei. Café por R$ 39,90 e frete de R$ 39,90.",
  );
  const issues = reviewSku(state, current);
  assert.equal(issues.length, 2);
  assert.equal(issues[1].needsChoice, true);
  assert.throws(() => applySkuReview(state, current, {}), /Escolha/);
  const decisions = { [issues[1].id]: "keep" };
  const approved = applySkuReview(state, current, decisions);
  assert.equal(
    approved.campaignAssets[0].content.body,
    "Texto que editei. Café por R$ 44,90 e frete de R$ 39,90.",
  );
  assert.deepEqual(
    reviewSku(JSON.parse(JSON.stringify(approved)), current),
    [],
  );
  approved.campaignAssets[0].content.body = "Texto novo, por R$ 39,90.";
  assert.deepEqual(
    reviewSku(approved, current).map((i) => i.before),
    ["R$ 39,90"],
  );
});

test("multiple offers, a source changed twice, a rebound price and out-of-date manual edits require per-mention decisions", () => {
  const state = emailCampaign("De R$ 49,90 por R$ 39,90.");
  const twice = { ...coffee, priceCents: 104490, revision: "3" };
  const issues = reviewSku(state, twice);
  assert.deepEqual(
    issues.map((i) => i.needsChoice),
    [true, false],
  );
  const approved = applySkuReview(state, twice, { [issues[0].id]: "keep" });
  assert.deepEqual(reviewSku(approved, twice), []);
  const rollback = applySkuReview(approved, coffee, {});
  assert.equal(
    rollback.campaignAssets[0].content.body,
    "De R$ 49,90 por R$ 39,90.",
  );
  assert.deepEqual(reviewSku(rollback, coffee), []);
});

test("BRL amounts preserve typography and boundaries and do not rewrite URLs, measurements, non-BRL currency or IDs", () => {
  assert.equal(parsePrice("R$ 1.234,56"), 123456);
  assert.equal(parsePrice("39.900,00"), 3990000);
  assert.equal(parsePrice("39,900"), null);
  const prose =
    "R$\u00a039,90 / 39,90 reais / por 39,90. R$ 39,900; 139,900; 39,90 kg; SKU39,90; https://example.org/39,90; US$ 39,90; € 39,90.";
  const state = emailCampaign(prose);
  const issues = reviewSku(state, current);
  assert.deepEqual(
    issues.map((i) => i.before),
    ["R$\u00a039,90", "39,90 reais", "39,90"],
  );
  const actual = applySkuReview(state, current, {}).campaignAssets[0].content
    .body;
  assert.ok(actual.endsWith("https://example.org/39,90; US$ 39,90; € 39,90."));
});

test("explicit BRL with a decimal point or international thousands separator is also validated", () => {
  const state = emailCampaign("BRL 39.90. Antes R$ 1,239.90.");
  const issues = reviewSku(state, current);
  assert.deepEqual(
    issues.map((i) => [i.before, i.after]),
    [
      ["BRL 39.90", "BRL 44.90"],
      ["R$ 1,239.90", "R$ 44.90"],
    ],
  );
});

test("nested structures, shared offer, compact units and standalone saved pieces are checked without changing references, approvals and creative assets", () => {
  const state = demoCampaign(coffee);
  state.discoveryPlan.offer = "Agora por R$ 39,90.";
  state.discoveryPlan.productUrl = "https://example.org/39,90";
  const banner = state.campaignAssets[2];
  banner.content.productImageUrl = "https://example.org/250g.png";
  banner.content.imagePrompt = "Etiqueta R$ 39,90";
  state.campaignAssets[0].content.structuredContent.sections[0].items = [
    "Embalagem 250g",
  ];
  state.campaignAssets[1].content.keyBenefits = ["Pacote 250 g"];
  const version = { ...current, unit: "300 g" };
  const issues = reviewSku(state, version);
  assert.equal(issues.length, 6);
  const offer = issues.find((i) => i.sharedOffer);
  assert.equal(affectsOutput(offer, "email"), true);
  assert.equal(affectsOutput(offer, "social"), true);
  assert.equal(affectsOutput(offer, "banner"), false);
  const approved = applySkuReview(state, version, {});
  assert.equal(approved.campaignAssets[2], banner);
  assert.equal(
    approved.discoveryPlan.productUrl,
    state.discoveryPlan.productUrl,
  );
  assert.ok(outputEmail(approved).includes("300 g"));
  assert.ok(outputChat(approved).includes("300 g"));
  const standalone = {
    type: "social",
    skuLink: { approved: coffee },
    caption: "R$ 39,90",
  };
  assert.equal(applySkuReview(standalone, current, {}).caption, "R$ 44,90");
  assert.deepEqual(reviewSku({ type: "email", body: "R$ 39,90" }, current), []);
});

test("a newly linked campaign can recognize an intermediate package size from catalog history", () => {
  const state = emailCampaign("Uma embalagem de 300 g por 41,90.");
  const last = {
    ...current,
    unit: "400 g",
    priorUnits: ["250 g", "300 g"],
    priorPrices: [3990, 4190],
  };
  state.skuLink = { approved: last };
  assert.deepEqual(
    reviewSku(state, last).map((i) => i.before),
    ["300 g", "41,90"],
  );
  assert.equal(
    applySkuReview(state, last, {}).campaignAssets[0].content.body,
    "Uma embalagem de 400 g por 44,90.",
  );
});

test("CSV handles quoted separators, decimal commas, BOM, accents and conflicting offers atomically", () => {
  const [item] = parseCatalogCsv(
    '\uFEFFsku;nome;preço;unidade;fonte;foto\r\nq1;"Café; especial";1.234,56;250 g;"Loja ""Central""";',
  );
  assert.equal(item.name, "Café; especial");
  assert.equal(item.source, 'Loja "Central"');
  assert.equal(formatPrice(item.priceCents), "R$ 1.234,56");
  assert.equal(
    parseCatalogCsv(
      'sku,nome,preco,unidade,fonte\nq1,Café,"12,90",1 kg,Loja',
    )[0].priceCents,
    1290,
  );
  assert.throws(
    () =>
      parseCatalogCsv(
        "sku;nome;preco;unidade;fonte\nq1;Item;1;kg;X\nQ1;Item;2;kg;Y",
      ),
    /mais de uma linha/,
  );
  assert.throws(
    () => parseCatalogCsv("sku;nome;preco;unidade;fonte\nX;Item;inválido;kg;X"),
    /Linha 2/,
  );
  assert.throws(
    () =>
      productInput({
        sku: "X",
        name: "A",
        price: "2,00",
        unit: "1 kg",
        source: "X",
        imageUrl: "file:///foto",
      }),
    /HTTPS/,
  );
});
