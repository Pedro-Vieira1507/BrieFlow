// src/types/generatedContent.ts
import { z } from "zod";
import type { BuilderState, CtaVariant } from "./builder";
import type { MaterialType } from "./brief";

function normalizeInlineString(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value : String(value);
  return raw.replace(/\*\*/g, "").replace(/\r/g, "").replace(/\s+/g, " ").trim();
}

function normalizeLongText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value : String(value);
  return raw.replace(/\*\*/g, "").replace(/\r/g, "").trim();
}

const looseString = z.preprocess(normalizeInlineString, z.string().catch(""));
const requiredString = z.preprocess(
  normalizeInlineString,
  z.string().min(1, "Campo de copy obrigatório vazio."),
);

const looseText = z.preprocess(normalizeLongText, z.string().catch(""));
const requiredText = z.preprocess(
  normalizeLongText,
  z.string().min(1, "Corpo da copy obrigatório vazio."),
);

const looseList = z.preprocess((value) => {
  if (value === null || value === undefined) return [];
  const arr = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
  return arr
    .map((item) => (typeof item === "string" ? item : String(item)))
    .map((item) => item.replace(/\*\*/g, "").trim())
    .filter((item) => item.length > 0 && item.toLowerCase() !== "null");
}, z.array(z.string()).catch([]));

function compactBadge(maxCharacters: number, maxWords: number) {
  return z.preprocess((value) => {
    const normalized = normalizeInlineString(value);
    if (
      normalized.length > maxCharacters ||
      normalized.split(/\s+/).filter(Boolean).length > maxWords
    ) {
      return "";
    }
    return normalized;
  }, z.string().catch(""));
}

const hexColor = z.preprocess((value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  const colorMap: Record<string, string> = {
    "roxo": "#7c3aed", "branco": "#ffffff", "preto": "#0f172a",
    "vermelho": "#dc2626", "verde": "#16a34a", "amarelo": "#eab308",
    "rosa": "#db2777", "laranja": "#ea580c", "azul": "#2563eb",
    "cinza": "#475569", "marrom": "#78350f"
  };
  const firstWord = raw.toLowerCase().split(/[\s,-]+/)[0];
  if (colorMap[firstWord]) return colorMap[firstWord];
  return /^#[0-9a-fA-F]{3,8}$/.test(raw) ? raw : undefined;
}, z.string().optional().catch(undefined));

const ctaVariantSchema = z.preprocess((value) => {
  const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
  return ["primary", "secondary", "urgent", "soft"].includes(raw)
    ? (raw as CtaVariant)
    : "primary";
}, z.enum(["primary", "secondary", "urgent", "soft"]).catch("primary"));

const designSchema = z.object({
  imagePrompt: looseString.default(""),
  themeColor: hexColor,
  secondaryColor: hexColor,
});

export const LandingCopySchema = designSchema.extend({
  headline: requiredString,
  subheadline: looseString.default(""),
  body: looseText.optional(),
  footerInfo: looseString.optional(),
  ctaText: requiredString,
  ctaVariant: ctaVariantSchema,
  keyBenefits: looseList.transform((items) => items.slice(0, 2)).default([]),
  objectionsHandled: looseList.transform((items) => items.slice(0, 2)).default([]),
  layoutStyle: z.preprocess((value) => {
    const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
    return ["diagonal", "split", "minimalist", "centered", "reverse"].includes(raw) ? raw : "split";
  }, z.enum(["diagonal", "split", "minimalist", "centered", "reverse"])).default("split"),
  badgePrimary: compactBadge(14, 3).optional(),
  badgeSecondary: compactBadge(24, 4).optional(),
  backgroundShape: z.preprocess((value) => {
    const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
    return ["diagonal", "curve", "split", "minimalist", "blob", "geometric", "frame", "arch", "wave", "pill", "offset"].includes(raw) ? raw : "curve";
  }, z.enum(["diagonal", "curve", "split", "minimalist", "blob", "geometric", "frame", "arch", "wave", "pill", "offset"])).default("curve"),
});

export const SocialCopySchema = designSchema.extend({
  hook: requiredString,
  body: requiredText,
  cta: requiredString,
  hashtags: looseList.transform((items) => items.slice(0, 6)).default([]),
});

export const EmailCopySchema = designSchema.extend({
  subject: requiredString,
  preheader: looseString.default(""),
  headline: looseString.default(""),
  subtitle: looseString.default(""),
  body: requiredText,
  ctaText: requiredString,
  ctaVariant: ctaVariantSchema,
  keyBenefits: looseList.transform((items) => items.slice(0, 3)).default([]),
  objectionsHandled: looseList.transform((items) => items.slice(0, 2)).default([]),
  heroBadge: looseString.default(""),
  benefitTitle: looseString.default(""),
  secondaryCta: looseString.default(""),
  urgencyText: looseString.default(""),
  testimonials: looseList.transform((items) => items.slice(0, 3)).default([]),
  footerInfo: looseString.default(""),
  layoutStyle: z.preprocess((value) => {
    const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
    return ["diagonal", "split", "minimalist", "centered", "editorial", "modern", "overlap", "newsletter"].includes(raw) ? raw : "centered";
  }, z.enum(["diagonal", "split", "minimalist", "centered", "editorial", "modern", "overlap", "newsletter"])).default("centered"),
  backgroundShape: z.preprocess((value) => {
    const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
    return ["square", "curve", "arch", "pill", "blob"].includes(raw) ? raw : "square";
  }, z.enum(["square", "curve", "arch", "pill", "blob"])).default("square"),
});

export type LandingCopy = z.infer<typeof LandingCopySchema>;
export type SocialCopy = z.infer<typeof SocialCopySchema>;
export type EmailCopy = z.infer<typeof EmailCopySchema>;

export type GeneratedCopyByMaterial = {
  banner: LandingCopy;
  social: SocialCopy;
  email: EmailCopy;
};

export type GeneratedCopy = LandingCopy | SocialCopy | EmailCopy;

export const MATERIAL_SCHEMAS = {
  banner: LandingCopySchema,
  social: SocialCopySchema,
  email: EmailCopySchema,
} as const;

export const SCHEMA_HINTS: Record<MaterialType, string> = {
  banner: `{\n  "headline": "string obrigatória: conceito de 3–6 palavras, preferencialmente até 42 caracteres",\n  "subheadline": "string opcional: 4–10 palavras com informação nova ou vazio",\n  "body": "string opcional: uma frase de até 18 palavras ou vazio",\n  "ctaText": "string obrigatória: 2–4 palavras",\n  "ctaVariant": "primary | secondary | urgent | soft",\n  "badgePrimary": "string: apenas núcleo numérico da oferta, até 14 caracteres e 3 palavras; senão vazio",\n  "badgeSecondary": "string: condição confirmada, até 24 caracteres e 4 palavras; senão vazio",\n  "footerInfo": "string: condição indispensável de até 90 caracteres; senão vazio",\n  "keyBenefits": ["0–2 benefícios de até 5 palavras; prefira []"],\n  "objectionsHandled": ["0–2 objeções reais e breves"],\n  "layoutStyle": "split | reverse | centered",\n  "backgroundShape": "minimalist | split | curve | blob | geometric | frame | diagonal | arch | wave | pill | offset",\n  "imagePrompt": "prompt editorial detalhado em inglês, sem texto na imagem",\n  "themeColor": "#RRGGBB",\n  "secondaryColor": "#RRGGBB"\n}`,
  social: `{\n  "hook": "string obrigatória: conceito de 4–10 palavras, específico e sem clickbait",\n  "body": "string obrigatória: 45–90 palavras em 3–4 parágrafos curtos",\n  "cta": "string obrigatória: uma ação clara",\n  "hashtags": ["3–6 hashtags relevantes e não genéricas"],\n  "imagePrompt": "prompt editorial 4:5 detalhado em inglês, sem texto na imagem",\n  "themeColor": "#RRGGBB",\n  "secondaryColor": "#RRGGBB"\n}`,
  email: `{\n  "subject": "string obrigatória: até 9 palavras e 60 caracteres",\n  "preheader": "string: 40–90 caracteres e sem repetir o assunto",\n  "headline": "string: conceito de 3–8 palavras",\n  "subtitle": "string opcional: até 14 palavras ou vazio",\n  "body": "string obrigatória: 80–140 palavras em 3–5 parágrafos",\n  "heroBadge": "string: somente fato confirmado; senão vazio",\n  "benefitTitle": "string curta que introduz benefícios ou vazio",\n  "keyBenefits": ["0–3 benefícios distintos; use apenas quando ajudarem"],\n  "objectionsHandled": ["0–2 objeções reais respondidas"],\n  "urgencyText": "string: somente urgência confirmada; senão vazio",\n  "testimonials": ["somente depoimentos literais fornecidos; senão array vazio"],\n  "ctaText": "string obrigatória: ação principal concreta",\n  "ctaVariant": "primary | secondary | urgent | soft",\n  "secondaryCta": "string: mesma intenção da ação principal ou vazio",\n  "footerInfo": "string: condição factual ou vazio",\n  "imagePrompt": "prompt hero editorial detalhado em inglês, sem texto",\n  "layoutStyle": "minimalist | split | diagonal | centered | editorial | modern | overlap | newsletter",\n  "backgroundShape": "square | curve | arch | pill | blob",\n  "themeColor": "#RRGGBB",\n  "secondaryColor": "#RRGGBB"\n}`
};

export interface MaterialRenderContext {
  brandName: string;
  productImageUrl?: string | null;
  productImages?: string[];
  productSku?: string | null;
}

const DEFAULT_THEME = "#0f172a";
const DEFAULT_SECONDARY = "#475569";

export function toBuilderContent<T extends MaterialType>(
  type: T,
  copy: GeneratedCopyByMaterial[T],
  context: MaterialRenderContext,
): BuilderState {
  const base = {
    type,
    brandName: context.brandName,
    productImageUrl: context.productImageUrl ?? null,
    productImages: context.productImages ?? [],
    productSku: context.productSku ?? null,
    themeColor: copy.themeColor ?? DEFAULT_THEME,
    secondaryColor: copy.secondaryColor ?? DEFAULT_SECONDARY,
    imagePrompt: copy.imagePrompt,
  } satisfies Partial<BuilderState> & { type: MaterialType };

  if (type === "banner") {
    const landing = copy as LandingCopy;
    return { 
      ...base, 
      title: landing.headline, 
      subtitle: landing.subheadline,
      body: landing.body,
      footerInfo: landing.footerInfo,
      cta: landing.ctaText, 
      ctaVariant: landing.ctaVariant satisfies CtaVariant, 
      keyBenefits: landing.keyBenefits, 
      objectionsHandled: landing.objectionsHandled, 
      layoutStyle: landing.layoutStyle,
      badgePrimary: landing.badgePrimary,
      badgeSecondary: landing.badgeSecondary,
      backgroundShape: landing.backgroundShape
    };
  }

  if (type === "email") {
    const email = copy as EmailCopy;
    return {
      ...base,
      title: email.subject,
      subtitle: email.headline,
      preheader: email.preheader,
      body: email.body,
      cta: email.ctaText,
      ctaVariant: email.ctaVariant satisfies CtaVariant,
      keyBenefits: email.keyBenefits,
      objectionsHandled: email.objectionsHandled,
      emailHeroImagePrompt: copy.imagePrompt,
      heroBadge: email.heroBadge,
      benefitTitle: email.benefitTitle,
      secondaryCta: email.secondaryCta,
      urgencyText: email.urgencyText,
      testimonials: email.testimonials,
      footerInfo: email.footerInfo,
      layoutStyle: email.layoutStyle,
      backgroundShape: email.backgroundShape,
    } as BuilderState;
  }

  const social = copy as SocialCopy;
  
  // Garantia extrema: Sempre devolve uma string limpa para não quebrar a tela do React.
  const theHook = social.hook?.trim() || "";
  const theBody = social.body?.trim() || "";
  const theCta = social.cta?.trim() || "";
  
  const caption = [theHook, theBody, theCta].filter((p) => p.length > 0).join("\n\n");

  return { 
    ...base, 
    hook: theHook, 
    body: theBody, 
    cta: theCta,
    caption: caption || "Crie um post atraente e envolvente com nossa ferramenta.", 
    hashtags: social.hashtags || [] 
  };
}

export type { MaterialType };
