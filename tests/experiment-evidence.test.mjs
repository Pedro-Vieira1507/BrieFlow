import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExperimentCsvTemplate,
  parseExperimentCsv,
} from "../src/lib/experimentCsv.ts";
import {
  analyzeExperimentEvidence,
  compareExperimentProportions,
} from "../src/lib/experimentStatistics.ts";

test("CSV parser aggregates repeated A/B rows and understands Brazilian revenue", () => {
  const parsed = parseExperimentCsv([
    "variante;impressoes;cliques;conversoes;receita;observacoes",
    "A;1000;80;10;1.250,50;dia 1",
    "A;500;40;5;750,25;dia 2",
    "B;1500;150;25;2.500,75;teste B",
  ].join("\n"));

  assert.equal(parsed.sourceRowCount, 3);
  assert.deepEqual(parsed.rows[0], {
    variant: "A",
    impressions: 1500,
    clicks: 120,
    conversions: 15,
    revenue: 2000.75,
    notes: "dia 1 · dia 2",
  });
  assert.deepEqual(parsed.rows[1], {
    variant: "B",
    impressions: 1500,
    clicks: 150,
    conversions: 25,
    revenue: 2500.75,
    notes: "teste B",
  });
});

test("CSV template includes both variants and required headers", () => {
  const template = buildExperimentCsvTemplate();
  assert.match(template, /variante;impressoes;cliques;conversoes/);
  assert.match(template, /\nA;/);
  assert.match(template, /\nB;/);
});

test("two-proportion evidence identifies a strong conversion lift", () => {
  const result = compareExperimentProportions({
    label: "Conversão",
    aSuccesses: 20,
    aTotal: 2000,
    bSuccesses: 60,
    bTotal: 2000,
  });

  assert.equal(result.sampleReady, true);
  assert.equal(result.status, "significant");
  assert.equal(result.significantWinner, "B");
  assert.ok(result.pValue !== null && result.pValue < 0.05);
  assert.ok(result.ciLowPercentagePoints !== null && result.ciLowPercentagePoints > 0);
});

test("small experiments stay explicitly insufficient", () => {
  const result = compareExperimentProportions({
    label: "Conversão",
    aSuccesses: 2,
    aTotal: 80,
    bSuccesses: 5,
    bTotal: 80,
  });
  assert.equal(result.status, "insufficient");
  assert.equal(result.significantWinner, null);
});

test("CTR signal alone never becomes a suggested business winner", () => {
  const summary = analyzeExperimentEvidence(
    { impressions: 5000, clicks: 200, conversions: 100 },
    { impressions: 5000, clicks: 350, conversions: 105 },
  );

  assert.equal(summary.conversion.status, "inconclusive");
  assert.equal(summary.ctr.status, "significant");
  assert.equal(summary.recommendation, "ctr_only_signal");
  assert.equal(summary.suggestedWinner, null);
});
