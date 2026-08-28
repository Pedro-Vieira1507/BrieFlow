import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  clipPromptValue,
  extractMaterialBriefing,
  selectFallbackPalette,
} from "../src/lib/marketingPromptCore.ts";
import { buildFallbackUrl } from "../src/lib/pollinations.ts";
import {
  LandingCopySchema,
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
  assert.match(source, /cinco territórios realmente diferentes/);
  assert.match(source, /UMA IDEIA DE CAMPANHA/);
  assert.match(source, /teste do outdoor/i);
  assert.match(source, /no máximo três zonas textuais/i);
  assert.match(source, /RÉGUA CRIATIVA/);
  assert.match(source, /Ideias que continuam depois do palco/);
  assert.match(source, /Não use roxo, neon ou gradiente “de IA”/);
  assert.match(source, /evite banco de imagem literal/);
  assert.match(source, /Nunca reutilize vocabulário laboratorial/);
  assert.match(source, /testimonials como \[\]/);
  assert.match(source, /CONTRATO FACTUAL DESTA GERAÇÃO/);
  assert.match(source, /ALEGAÇÕES FACTUAIS BLOQUEADAS/);
  assert.match(source, /PLATAFORMA CRIATIVA DA CAMPANHA/);
  assert.match(source, /em outro nível/);
  assert.match(source, /teste de substituição/);
  assert.match(source, /fragmento preposicional/);
  assert.match(source, /aplicado automaticamente/);
  assert.match(source, /O body constrói desejo/);
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

  assert.equal(parsed.hashtags.length, 6);
});

test("banner schema suppresses oversized promotional badges", () => {
  const parsed = LandingCopySchema.parse({
    headline: "Resultados começam na escolha certa",
    subheadline: "",
    body: "",
    ctaText: "Conheça os modelos",
    keyBenefits: ["Benefício um", "Benefício dois", "Benefício três"],
    badgePrimary: "Tecnologia que protege todas as vidas",
    badgeSecondary: "Condição complementar excessivamente longa para um selo",
    imagePrompt: "editorial product hero, no text",
  });

  assert.equal(parsed.badgePrimary, "");
  assert.equal(parsed.badgeSecondary, "");
  assert.equal(parsed.keyBenefits.length, 2);
});

test("banner schema keeps the numeric offer compact enough for the circular badge", () => {
  const parsed = LandingCopySchema.parse({
    headline: "Um novo Brasil na xícara",
    subheadline: "",
    body: "",
    ctaText: "Assinar seleção",
    keyBenefits: [],
    badgePrimary: "15% OFF",
    badgeSecondary: "na primeira caixa",
    imagePrompt: "editorial coffee subscription still life, no text",
  });

  assert.equal(parsed.badgePrimary, "15% OFF");
  assert.equal(parsed.badgeSecondary, "na primeira caixa");
});

test("material prompt adapts the agency method without leaking the reference brand", () => {
  const source = readFileSync(
    new URL("../src/lib/marketingPrompts.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /brieflow-creative-director-2026-08\.5/);
  assert.match(source, /produto-herói/);
  assert.match(source, /Prefira omitir a preencher/);
  assert.match(source, /B2B técnico\/regulado/);
  assert.match(source, /Varejo\/e-commerce/);
  assert.match(source, /SaaS\/tecnologia/);
  assert.doesNotMatch(source, /Forlab/i);
});


test("visual fallback is local, deterministic and never exposes a placeholder label", () => {
  const first = buildFallbackUrl("editorial coffee subscription", {
    width: 1080,
    height: 1350,
    seed: 42,
  });
  const second = buildFallbackUrl("editorial coffee subscription", {
    width: 1080,
    height: 1350,
    seed: 42,
  });

  assert.equal(first, second);
  assert.match(first, /^data:image\/svg\+xml/);
  assert.doesNotMatch(first, /placehold\.co|Arte\+em\+Geracao/i);
});
