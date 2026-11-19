import test from "node:test";
import assert from "node:assert/strict";
import {
  pilotFragment,
  parsePilotFragment,
  targetAsset,
} from "../src/lib/pilotNavigation.ts";
import { demoCampaign, demoProducts } from "../src/lib/skuDemo.ts";
import { applySkuReview } from "../src/lib/skuReview.ts";
import {
  applyPilotEvent,
  campaignKey,
  copySkuCampaign,
  factRevision,
  pilotCsv,
  pilotFinishedAt,
  pilotStatus,
  startPilotRun,
  withPilotIdentity,
} from "../src/lib/skuPilot.ts";

const start = Date.parse("2026-11-18T14:00:00Z");
const coffee = {
  ...demoProducts()[0],
  revision: "original",
  updatedAt: new Date(start - 1000).toISOString(),
};
const next = {
  ...coffee,
  priceCents: 4490,
  revision: "alterada",
  updatedAt: new Date(start).toISOString(),
};
const draft = demoCampaign(coffee);
function run(state = draft, scope = "library", product = next) {
  return startPilotRun("loja", coffee, product, {
    scope,
    campaigns: [{ id: "a", name: "Empório", state }],
  });
}
const file = (channel, format, ms, extra = {}) => ({
  type: "file",
  format,
  channel,
  at: start + ms,
  campaignId: "a",
  assetId: "demo-" + channel,
  ...extra,
});

test("a catalog change ends at the first valid release of its last distinct piece", () => {
  let r = run();
  assert.equal(r.examined, 3);
  assert.deepEqual(
    r.pieces.map((p) => p.channel),
    ["whatsapp", "email"],
  );
  assert.equal(r.demonstration, true);
  for (const event of [
    file("banner", "PNG", 5),
    file("email", "TXT", 10),
    file("whatsapp", "TXT", -10),
    file("whatsapp", "TXT", 10, { campaignId: "b" }),
  ])
    assert.equal(applyPilotEvent(r, event), r);
  r = applyPilotEvent(r, { type: "review", campaignId: "a", at: start + 2000 });
  assert.ok(r.pieces.every((p) => p.reviewedAt === start + 2000));
  assert.equal(pilotFinishedAt(r), undefined);
  r = applyPilotEvent(r, file("whatsapp", "TXT", 3000));
  assert.equal(applyPilotEvent(r, file("whatsapp", "TXT", 6000)), r);
  assert.equal(pilotStatus(r), "Em andamento");
  r = applyPilotEvent(r, file("email", "HTML", 9000));
  assert.equal(pilotFinishedAt(r), start + 9000);
  assert.equal(pilotStatus(r), "Concluída");
  assert.equal(applyPilotEvent(r, { type: "supersede", at: start + 11000 }), r);
  assert.equal(applyPilotEvent(r, file("email", "HTML", 12000)), r);
  assert.ok(pilotCsv([r]).split("\r\n")[1].endsWith(';"9";"";""'));
  r = applyPilotEvent(r, { type: "manual", seconds: 7 });
  assert.ok(pilotCsv([r]).split("\r\n")[1].endsWith(';"9";"7";"-2"'));
  assert.throws(() => applyPilotEvent(r, { type: "manual", seconds: 0 }));
  assert.equal(applyPilotEvent(r, { type: "manual" }).manualSeconds, undefined);
});

test("partial, empty and replaced samples never establish a total duration", () => {
  let r = run(draft, "partial");
  r = applyPilotEvent(
    applyPilotEvent(r, file("whatsapp", "TXT", 200)),
    file("email", "HTML", 500),
  );
  assert.equal(pilotFinishedAt(r), undefined);
  assert.equal(pilotStatus(r), "Amostra parcial");
  const empty = run({ ...draft, campaignAssets: [] });
  assert.equal(pilotStatus(empty), "Sem peças afetadas");
  assert.equal(pilotFinishedAt(empty), undefined);
  const replaced = applyPilotEvent(run(), {
    type: "supersede",
    at: start + 500,
  });
  assert.equal(applyPilotEvent(replaced, file("email", "HTML", 800)), replaced);
  assert.equal(pilotStatus(replaced), "Substituída");
  assert.equal(pilotFinishedAt(replaced), undefined);
});

test("only customer-facing output changed by this revision is included", () => {
  const state = structuredClone(draft);
  const doc = state.campaignAssets[0].content.structuredContent;
  doc.sections = [
    { id: "cliente", title: "Mensagem", body: "Consulte a oferta." },
    { id: "notas", title: "Notas internas", body: "Valor R$ 39,90" },
  ];
  doc.keywords = ["R$ 39,90"];
  state.discoveryPlan.offer = "Por R$ 39,90";
  state.campaignAssets.push({
    id: "social",
    type: "social",
    content: { type: "social", caption: "Confira a seleção!" },
  });
  assert.deepEqual(
    run(state).pieces.map((p) => p.channel),
    ["email"],
  );
  state.campaignAssets.at(-1).content.caption = "Oferta de R$ 39,90 agora.";
  assert.deepEqual(
    run(state).pieces.map((p) => p.channel),
    ["email", "social"],
  );
  assert.deepEqual(
    run(state, "canvas", {
      ...coffee,
      unit: "500 g",
      revision: "embalagem",
    }).pieces.map((p) => p.channel),
    ["email"],
  );
  const nextPack = {
    ...next,
    unit: "500 g",
    revision: "posterior",
    priorPrices: [coffee.priceCents],
  };
  const r = startPilotRun("loja", next, nextPack, {
    scope: "canvas",
    campaigns: [{ id: "a", name: "Loja", state: draft }],
  });
  assert.deepEqual(
    r.pieces.map((p) => p.channel),
    ["email"],
  );
  const reverted = startPilotRun(
    "loja",
    next,
    { ...nextPack, unit: coffee.unit, priceCents: coffee.priceCents },
    { scope: "canvas", campaigns: [{ id: "a", name: "Loja", state: draft }] },
  );
  assert.deepEqual(reverted.pieces, []);
});

test("legacy and copied campaigns have stable independent identities and CSV treats user text as data", () => {
  const legacy = { ...draft, skuLink: { approved: coffee } };
  const loaded = withPilotIdentity(legacy, "row-1");
  assert.equal(campaignKey(loaded), "saved:row-1");
  assert.equal(withPilotIdentity(loaded, "row-1"), loaded);
  assert.equal(
    campaignKey(applySkuReview(loaded, next, {})),
    campaignKey(loaded),
  );
  assert.notEqual(campaignKey(copySkuCampaign(loaded)), campaignKey(loaded));
  assert.equal(
    factRevision({ ...next, factRevision: "commercial" }),
    "commercial",
  );
  assert.equal(factRevision(coffee), coffee.revision);
  const r = { ...run(), sku: '=SKU("1")' };
  assert.ok(pilotCsv([r]).startsWith("\uFEFF"));
  assert.ok(pilotCsv([r]).includes('"\u0027=SKU(""1"")"'));
});
test("a review link resolves the exact piece across saved copies, older entries and standalone materials", () => {
  const addr = { revision: "demo-123", index: 7 };
  assert.deepEqual(
    parsePilotFragment(pilotFragment(addr.revision, addr.index)),
    addr,
  );
  for (const hash of [
    "#creative-canvas",
    "#revisar-peca=demo-123.-1",
    "#revisar-peca=demo-123.97+1",
    "#revisar-peca=demo-123.3/x",
    "",
  ])
    assert.equal(parsePilotFragment(hash), undefined);
  const other = copySkuCampaign(draft);
  const target = {
    owner: "loja",
    sku: coffee.sku,
    revision: "2",
    piece: {
      campaignId: campaignKey(draft),
      assetId: "demo-email",
      channel: "email",
    },
  };
  assert.equal(targetAsset(target, draft), draft.campaignAssets[1]);
  assert.equal(targetAsset(target, other), undefined);
  assert.equal(targetAsset({ ...target, sku: "OUTRO" }, draft), undefined);
  assert.equal(
    targetAsset(
      { ...target, piece: { ...target.piece, channel: "banner" } },
      draft,
    ),
    undefined,
  );
  assert.equal(
    targetAsset(target, {
      ...draft,
      campaignAssets: [draft.campaignAssets[0]],
    }),
    undefined,
  );
  const older = {
    type: "email",
    skuLink: { approved: coffee },
    body: "Oferta da semana",
  };
  const legacy = {
    ...target,
    piece: {
      ...target.piece,
      assetId: "standalone",
      campaignId: "saved:row-1",
    },
  };
  assert.equal(targetAsset(legacy, older, "row-1").content, older);
  assert.equal(targetAsset(legacy, older, "row-2"), undefined);
  assert.equal(
    targetAsset(legacy, { ...older, generationError: "Falha" }, "row-1"),
    undefined,
  );
  const r = startPilotRun("loja", coffee, next, {
    scope: "library",
    campaigns: [
      {
        id: campaignKey(draft),
        libraryAssetId: "row-1",
        name: "Loja",
        state: draft,
      },
    ],
  });
  assert.ok(r.pieces.every((p) => p.libraryAssetId === "row-1"));
});
