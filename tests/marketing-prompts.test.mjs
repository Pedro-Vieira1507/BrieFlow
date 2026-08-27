import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  clipPromptValue,
  extractMaterialBriefing,
  selectFallbackPalette,
} from "../src/lib/marketingPromptCore.ts";
import {
  EmailCopySchema,
  SocialCopySchema,
} from "../src/types/generatedContent.ts";

test("extractMaterialBriefing isolates each channel without losing global context", () => {
  const briefing = `Campanha para lançamento, com tom confiante.

BANNER:
Use a frase exata "Menos atrito, mais vendas".

E-MAIL MARKETING:
Explique como o produto reduz retrabalho.

POST SOCIAL:
Abra com uma pergunta sobre tarefas repetitivas.

=== CONTEÚDO ATUAL DA PEÇA ===
{"cta":"Ver demonstração"}`;

  const email = extractMaterialBriefing(briefing, "email");

  assert.match(email, /Campanha para lançamento/);
  assert.match(email, /reduz retrabalho/);
  assert.match(email, /CONTEÚDO ATUAL DA PEÇA/);
  assert.doesNotMatch(email, /Menos atrito/);
  assert.doesNotMatch(email, /tarefas repetitivas/);
});

test("extractMaterialBriefing preserves an unstructured briefing verbatim", () => {
  const briefing = "Mude somente o CTA para uma ação mais específica.";
  assert.equal(extractMaterialBriefing(briefing, "banner"), briefing);
});

test("fallback palettes are varied but reproducible", () => {
  const first = selectFallbackPalette("Marca|Produto|banner");
  const second = selectFallbackPalette("Marca|Produto|banner");

  assert.deepEqual(first, second);
  assert.match(first.theme, /^#[0-9a-f]{6}$/i);
  assert.match(first.secondary, /^#[0-9a-f]{6}$/i);
});

test("clipPromptValue limits scraped context without corrupting short text", () => {
  assert.equal(clipPromptValue("  texto curto  ", 30), "texto curto");
  assert.equal(clipPromptValue("abcdefghij", 5), "abcde…");
});

test("editorial prompt forbids fabricated proof and removes random directives", () => {
  const source = readFileSync(
    new URL("../src/lib/marketingPrompts.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /Nunca invente preço, desconto/);
  assert.match(source, /três ângulos realmente diferentes/);
  assert.match(source, /testimonials como \[\]/);
  assert.doesNotMatch(source, /Inclua agressivamente/);
  assert.doesNotMatch(source, /Crie 2 a 3 cards realistas/);
  assert.doesNotMatch(source, /Math\.random/);
});

test("content schemas reject empty core copy instead of showing generic filler", () => {
  assert.equal(
    SocialCopySchema.safeParse({
      hook: "",
      body: "",
      cta: "",
      hashtags: [],
      imagePrompt: "",
    }).success,
    false,
  );

  assert.equal(
    EmailCopySchema.safeParse({
      subject: "",
      body: "",
      ctaText: "",
      imagePrompt: "",
    }).success,
    false,
  );
});

test("social schema caps hashtag stuffing", () => {
  const parsed = SocialCopySchema.parse({
    hook: "O retrabalho está drenando sua equipe",
    body: "Uma mensagem clara, específica e útil para o público certo.",
    cta: "Ver demonstração",
    hashtags: Array.from({ length: 12 }, (_, index) => `#tag${index}`),
    imagePrompt: "focused editorial product composition, no text",
  });

  assert.equal(parsed.hashtags.length, 8);
});
