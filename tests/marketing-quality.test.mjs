import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  findUnsupportedClaims,
  sanitizeGeneratedCopy,
} from "../src/lib/marketingQuality.ts";

const baseBrief = {
  brandName: "Aurora Café",
  product: "Assinatura mensal de cafés especiais brasileiros",
  audience: "Pessoas que preparam café em casa",
  objective: "Conquistar novas assinaturas",
  offer: "15% de desconto na primeira caixa",
  context: "Curadoria mensal, origem identificada e guia simples de preparo",
};

test("removes unsupported commercial mechanics from optional email fields", () => {
  const sanitized = sanitizeGeneratedCopy(
    "email",
    {
      subject: "Um novo café todo mês",
      preheader: "",
      headline: "Origem para descobrir em casa",
      subtitle: "",
      body: "Receba cafés brasileiros com origem identificada. A seleção é exclusiva para assinantes.",
      ctaText: "Assinar com 15% OFF",
      ctaVariant: "primary",
      keyBenefits: [],
      objectionsHandled: [],
      heroBadge: "",
      benefitTitle: "",
      secondaryCta: "",
      urgencyText: "",
      testimonials: [],
      footerInfo: "Desconto aplicado automaticamente na contratação.",
      imagePrompt: "editorial coffee subscription, no text",
      layoutStyle: "centered",
      backgroundShape: "square",
    },
    baseBrief,
  );

  assert.equal(sanitized.footerInfo, "");
  assert.equal(
    sanitized.body,
    "Receba cafés brasileiros com origem identificada.",
  );
});

test("blocks unconfirmed checkout, contracting and plan mechanics", () => {
  const sanitized = sanitizeGeneratedCopy(
    "email",
    {
      subject: "Um novo café todo mês",
      preheader: "",
      headline: "Origem para descobrir em casa",
      subtitle: "",
      body: "Conheça a curadoria. Escolha o plano no checkout para concluir a contratação.",
      ctaText: "Conhecer a assinatura",
      ctaVariant: "primary",
      keyBenefits: [],
      objectionsHandled: [],
      heroBadge: "",
      benefitTitle: "",
      secondaryCta: "",
      urgencyText: "",
      testimonials: [],
      footerInfo: "15% OFF no plano escolhido no checkout.",
      imagePrompt: "editorial coffee subscription, no text",
      layoutStyle: "centered",
      backgroundShape: "square",
    },
    baseBrief,
  );

  assert.equal(sanitized.body, "Conheça a curadoria.");
  assert.equal(sanitized.footerInfo, "");
});

test("repairs a headline split by a dangling prepositional fragment", () => {
  const sanitized = sanitizeGeneratedCopy(
    "banner",
    {
      headline: "O próximo café: de origem",
      subheadline: "Descobertas: para a sua xícara",
      body: "Cafés brasileiros com origem identificada.",
      ctaText: "Conhecer assinatura",
      ctaVariant: "primary",
      keyBenefits: [],
      objectionsHandled: [],
      layoutStyle: "split",
      backgroundShape: "curve",
      imagePrompt: "editorial coffee subscription, no text",
    },
    baseBrief,
  );

  assert.equal(sanitized.headline, "O próximo café de origem");
  assert.equal(sanitized.subheadline, "Descobertas para a sua xícara");
});

test("preserves a commercial mechanic when the briefing confirms it", () => {
  const brief = {
    ...baseBrief,
    offer: "15% de desconto aplicado automaticamente na primeira caixa",
  };

  assert.deepEqual(
    findUnsupportedClaims("Desconto aplicado automaticamente.", brief),
    [],
  );
});

test("removes a repeated social offer paragraph when CTA already carries it", () => {
  const sanitized = sanitizeGeneratedCopy(
    "social",
    {
      hook: "Origem nova para a sua xícara",
      body: "Conheça cafés brasileiros com torra recente e origem identificada.\n\nGaranta sua primeira caixa com 15% OFF.",
      cta: "Garanta a primeira caixa com 15% OFF no link da bio.",
      hashtags: ["#AuroraCafe"],
      imagePrompt: "editorial coffee ritual, no text",
    },
    baseBrief,
  );

  assert.equal(
    sanitized.body,
    "Conheça cafés brasileiros com torra recente e origem identificada.",
  );
});

test("removes unsupported personalization disguised as curation", () => {
  const sanitized = sanitizeGeneratedCopy(
    "banner",
    {
      headline: "Seu café, da fazenda pra casa",
      subheadline: "Microlotes brasileiros escolhidos para você",
      body: "Assinatura mensal para preparar café em casa.",
      ctaText: "Conhecer assinatura",
      ctaVariant: "primary",
      keyBenefits: [],
      objectionsHandled: [],
      layoutStyle: "split",
      backgroundShape: "curve",
      imagePrompt: "coffee served in a cup, no text",
    },
    { ...baseBrief, context: "Assinatura mensal de microlotes brasileiros" },
  );

  assert.equal(sanitized.subheadline, "");
});

test("banner quality guardrail reserves the scene for a real product image", () => {
  const sanitized = sanitizeGeneratedCopy(
    "banner",
    {
      headline: "Precisão na rotina",
      subheadline: "",
      body: "",
      ctaText: "Conhecer equipamento",
      ctaVariant: "primary",
      keyBenefits: [],
      objectionsHandled: [],
      layoutStyle: "centered",
      backgroundShape: "blob",
      badgePrimary: "15% OFF",
      badgeSecondary: "esta semana",
      imagePrompt: "clean laboratory scene",
    },
    {
      ...baseBrief,
      brandName: "Forlab Express",
      product: "Centrífuga de laboratório",
      productTitle: "Centrífuga de laboratório",
      productImageUrl: "https://example.com/centrifuga.png",
    },
  );

  assert.equal(sanitized.layoutStyle, "split");
  assert.equal(sanitized.backgroundShape, "minimalist");
  assert.match(sanitized.imagePrompt, /real product cutout/i);
  assert.match(sanitized.imagePrompt, /Centrífuga de laboratório/i);
  assert.match(sanitized.imagePrompt, /no abstract-only gradient background/i);
  assert.match(sanitized.imagePrompt, /no visible watermark/i);
});

test("banner quality guardrail clears promotional badges without a confirmed offer", () => {
  const sanitized = sanitizeGeneratedCopy(
    "banner",
    {
      headline: "Menos retrabalho",
      subheadline: "Mais clareza operacional",
      body: "",
      ctaText: "Conhecer plataforma",
      ctaVariant: "primary",
      keyBenefits: [],
      objectionsHandled: [],
      layoutStyle: "split",
      backgroundShape: "wave",
      badgePrimary: "20% OFF",
      badgeSecondary: "só hoje",
      imagePrompt: "operations team visual",
    },
    {
      ...baseBrief,
      brandName: "Fluxo",
      product: "Software B2B de gestão operacional",
      offer: "",
    },
  );

  assert.equal(sanitized.badgePrimary, "");
  assert.equal(sanitized.badgeSecondary, "");
  assert.equal(sanitized.backgroundShape, "minimalist");
});

test("banner quality guardrail prevents the brand name from becoming the whole headline", () => {
  const sanitized = sanitizeGeneratedCopy(
    "banner",
    {
      headline: "Forlab Express",
      subheadline: "",
      body: "",
      ctaText: "Conhecer equipamento",
      ctaVariant: "primary",
      keyBenefits: [],
      objectionsHandled: [],
      layoutStyle: "split",
      backgroundShape: "minimalist",
      imagePrompt: "laboratory equipment campaign",
    },
    {
      ...baseBrief,
      brandName: "Forlab Express",
      product: "Centrífuga de laboratório",
      productTitle: "Centrífuga de laboratório",
      offer: "",
    },
  );

  assert.equal(sanitized.headline, "Centrífuga de laboratório");
});

test("banner renderer no longer relies on Pollinations or the generic black headline card", () => {
  const source = readFileSync(
    new URL("../src/components/briefflow/BannerPreview.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /buildPollinationsUrl/);
  assert.match(source, /backgroundImageUrl/);
  assert.match(source, /renderCampaignImage/);
  assert.match(source, /value=\{cta\}/);
  assert.doesNotMatch(source, /ArrowUpRight/);
});

test("social fallback omits CORS mode for local data images", () => {
  const source = readFileSync(
    new URL("../src/components/briefflow/SocialPreview.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /url\.startsWith\("data:"\)/);
  assert.doesNotMatch(source, /src=\{url\}\s+crossOrigin="anonymous"/);
});

test("replaces a wholly unsupported production story with confirmed product context", () => {
  const sanitized = sanitizeGeneratedCopy(
    "email",
    {
      subject: "Conheça o Café Aurora",
      preheader: "",
      headline: "Qualidade e origem",
      subtitle: "",
      body: "Cada xícara carrega a história de quem cultivou, colheu e torrou com dedicação.",
      ctaText: "Conhecer",
      ctaVariant: "primary",
      keyBenefits: [],
      objectionsHandled: [],
      heroBadge: "",
      benefitTitle: "",
      secondaryCta: "",
      urgencyText: "",
      testimonials: [],
      footerInfo: "",
      imagePrompt: "coffee cup, no text",
      layoutStyle: "centered",
      backgroundShape: "square",
    },
    {
      ...baseBrief,
      product: "Café especial brasileiro",
      context: "Qualidade e origem",
      offer: "",
    },
  );

  assert.equal(sanitized.body, "Café especial brasileiro");
});

test("removes unsupported packaging and conscious-choice claims from slides", () => {
  const sanitized = sanitizeGeneratedCopy(
    "slides",
    {
      title: "Café Aurora",
      subtitle: "",
      summary: "Apresentação da marca.",
      duration: "",
      sections: [
        {
          title: "Produto",
          body: "Conheça o Café Aurora. Uma escolha consciente em cada xícara.",
          items: ["Café especial brasileiro", "Torrefação artesanal"],
          timing: "",
          visualDirection: "Mostrar a embalagem do Café Aurora.",
          speakerNotes: "",
        },
      ],
      cta: "Conhecer",
      keywords: [],
      disclaimer: "",
      imagePrompt: "coffee campaign, no text",
      themeColor: "#0f172a",
      secondaryColor: "#475569",
    },
    {
      ...baseBrief,
      product: "Café especial brasileiro",
      context: "Qualidade e origem",
      offer: "",
    },
  );

  assert.equal(sanitized.sections[0].body, "Conheça o Café Aurora.");
  assert.deepEqual(sanitized.sections[0].items, ["Café especial brasileiro"]);
  assert.equal(sanitized.sections[0].visualDirection, "");
});

test("unbranded visual guardrail forbids invented labels without a product image", () => {
  const sanitized = sanitizeGeneratedCopy(
    "banner",
    {
      headline: "Conheça o Café Aurora",
      subheadline: "",
      body: "Café especial brasileiro.",
      ctaText: "Conhecer",
      ctaVariant: "primary",
      keyBenefits: [],
      objectionsHandled: [],
      layoutStyle: "split",
      backgroundShape: "minimalist",
      imagePrompt:
        "coffee cup on a table, premium commercial advertising key visual, no text",
    },
    {
      ...baseBrief,
      product: "Café especial brasileiro",
      productImageUrl: undefined,
      offer: "",
    },
  );

  assert.match(
    sanitized.imagePrompt,
    /unbranded with completely blank surfaces/i,
  );
  assert.match(sanitized.imagePrompt, /never invent a brand mark or label/i);
});

test("social offer visibility uses the shared semantic-empty guard", () => {
  const source = readFileSync(
    new URL("../src/components/briefflow/SocialPreview.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const hasOffer = !isEmptyLike\(offerStr\)/);
});
