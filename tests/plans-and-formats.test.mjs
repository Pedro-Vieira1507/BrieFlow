import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CONTENT_FORMATS,
  PLAN_CATALOG,
  canUseMaterial,
  isMaterialAssisted,
  isMaterialOperational,
  planMeetsMinimum,
} from "../src/lib/plans.ts";
import { formatStructuredContentText } from "../src/lib/structuredContent.ts";
import { StructuredCopySchema } from "../src/types/generatedContent.ts";

test("plans unlock formats cumulatively without exposing premium formats for free", () => {
  assert.equal(canUseMaterial("free", "banner"), true);
  assert.equal(canUseMaterial("free", "podcast"), false);
  assert.equal(canUseMaterial("basic", "technical_sheet"), true);
  assert.equal(canUseMaterial("pro", "reel"), true);
  assert.equal(canUseMaterial("pro", "podcast"), false);
  assert.equal(canUseMaterial("agency", "podcast"), true);
  assert.equal(planMeetsMinimum("enterprise", "agency"), true);
});

test("long video remains paused while Reel uses the assisted free provider", () => {
  assert.equal(canUseMaterial("enterprise", "video"), true);
  assert.equal(canUseMaterial("enterprise", "reel"), true);
  assert.equal(isMaterialOperational("video"), false);
  assert.equal(isMaterialOperational("reel"), true);
  assert.equal(isMaterialAssisted("reel"), true);
  assert.equal(isMaterialAssisted("video"), false);
  assert.equal(isMaterialOperational("podcast"), true);
});

test("every plan and format has positive production limits", () => {
  for (const plan of Object.values(PLAN_CATALOG)) {
    assert.ok(plan.dailyCredits > 0);
    assert.ok(plan.maxMembers > 0);
    assert.ok(plan.maxSavedAssets > 0);
  }
  for (const format of Object.values(CONTENT_FORMATS)) {
    assert.ok(format.creditCost > 0);
    assert.ok(format.prompt.length > 10);
  }
});

test("advanced content schema normalizes a production-ready media plan", () => {
  const parsed = StructuredCopySchema.parse({
    title: "Da ideia ao primeiro corte",
    summary: "Plano objetivo para apresentar a proposta.",
    duration: "45 segundos",
    sections: [
      {
        title: "Abertura",
        body: "Apresente o problema confirmado no briefing.",
        timing: "0–5s",
        visualDirection: "Plano fechado do produto.",
      },
    ],
    cta: "Conheça a solução",
    keywords: ["produto", "demonstração"],
    imagePrompt: "editorial product close-up, no text",
  });

  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0].timing, "0–5s");
});

test("structured export preserves timing, direction and presenter notes", () => {
  const text = formatStructuredContentText({
    format: "slides",
    title: "Apresentação comercial",
    sections: [
      {
        id: "slide-1",
        title: "Contexto",
        body: "O desafio atual.",
        timing: "2 min",
        visualDirection: "Gráfico do cenário.",
        speakerNotes: "Conectar com a realidade do público.",
      },
    ],
  });

  assert.match(text, /Timing: 2 min/);
  assert.match(text, /Direção visual: Gráfico do cenário/);
  assert.match(text, /Notas: Conectar/);
});

test("slides export as PowerPoint and technical sheets export as factual PDF", async () => {
  assert.match(CONTENT_FORMATS.slides.description, /PowerPoint/);
  assert.match(CONTENT_FORMATS.technical_sheet.description, /PDF/);

  const exporter = await readFile(
    new URL("../src/lib/documentExport.ts", import.meta.url),
    "utf8",
  );
  const prompts = await readFile(
    new URL("../src/lib/marketingPrompts.ts", import.meta.url),
    "utf8",
  );

  assert.match(exporter, /import\("pptxgenjs"\)/);
  assert.match(exporter, /exportFilename\("slides"[\s\S]*"pptx"\)/);
  assert.match(exporter, /import\("jspdf"\)/);
  assert.match(exporter, /exportFilename\("technical_sheet"[\s\S]*"pdf"\)/);
  assert.match(prompts, /Não informado — validar com o fabricante/);
  assert.match(prompts, /Nunca complete especificações ausentes/);
});
