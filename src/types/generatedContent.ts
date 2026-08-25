// src/types/generatedContent.ts
import { z } from "zod";
import type { BuilderState, CtaVariant } from "./builder";
import type { MaterialType } from "./brief";

const looseString = z.preprocess((value) => {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value : String(value);
  return raw.replace(/\*\*/g, "").replace(/\r/g, "").replace(/\s+/g, " ").trim();
}, z.string());

const looseText = z.preprocess((value) => {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value : String(value);
  return raw.replace(/\*\*/g, "").replace(/\r/g, "").trim();
}, z.string());

const looseList = z.preprocess((value) => {
  if (value === null || value === undefined) return [];
  const arr = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
  return arr
    .map((item) => (typeof item === "string" ? item : String(item)))
    .map((item) => item.replace(/\*\*/g, "").trim())
    .filter((item) => item.length > 0 && item.toLowerCase() !== "null");
}, z.array(z.string()));

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
}, z.string().optional());

const ctaVariantSchema = z.preprocess((value) => {
  const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
  return ["primary", "secondary", "urgent", "soft"].includes(raw)
    ? (raw as CtaVariant)
    : "primary";
}, z.enum(["primary", "secondary", "urgent", "soft"]));

const designSchema = z.object({
  imagePrompt: looseString.default(""),
  themeColor: hexColor,
  secondaryColor: hexColor,
});

export const LandingCopySchema = designSchema.extend({
  headline: looseString,
  subheadline: looseString.default(""),
  body: looseText.optional(),
  footerInfo: looseString.optional(),
  ctaText: looseString,
  ctaVariant: ctaVariantSchema,
  keyBenefits: looseList.default([]),
  objectionsHandled: looseList.default([]),
  layoutStyle: z.preprocess((value) => {
    const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
    return ["diagonal", "split", "minimalist", "centered", "reverse"].includes(raw) ? raw : "split";
  }, z.enum(["diagonal", "split", "minimalist", "centered", "reverse"])).default("split"),
  badgePrimary: looseString.optional(),
  badgeSecondary: looseString.optional(),
  backgroundShape: z.preprocess((value) => {
    const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
    return ["diagonal", "curve", "split", "minimalist", "blob", "geometric", "frame", "arch", "wave", "pill", "offset"].includes(raw) ? raw : "curve";
  }, z.enum(["diagonal", "curve", "split", "minimalist", "blob", "geometric", "frame", "arch", "wave", "pill", "offset"])).default("curve"),
});

export const SocialCopySchema = designSchema.extend({
  hook: looseString,
  body: looseString,
  cta: looseString.default(""),
  // CORREÇÃO: Removido o .min(1) para não quebrar a IA quando ela omitir hashtags
  hashtags: z.preprocess((value) => {
    if (value === null || value === undefined) return [];
    const arr = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
    return arr
      .map((item) => (typeof item === "string" ? item : String(item)))
      .map((item) => item.replace(/\*\*/g, "").trim())
      .filter((item) => item.length > 0 && item.toLowerCase() !== "null");
  }, z.array(z.string())).default([]),
});

export const EmailCopySchema = designSchema.extend({
  subject: looseString,
  preheader: looseString.default(""),
  headline: looseString.default(""),
  subtitle: looseString.default(""),
  body: looseText,
  ctaText: looseString,
  ctaVariant: ctaVariantSchema,
  keyBenefits: looseList.default([]),
  objectionsHandled: looseList.default([]),
  heroBadge: looseString.default(""),
  benefitTitle: looseString.default(""),
  secondaryCta: looseString.default(""),
  urgencyText: looseString.default(""),
  testimonials: looseList.default([]),
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
  banner: `{\n  "headline": "Benefício principal...",\n  "subheadline": "1 frase explicando",\n  "body": "Parágrafo detalhando a oferta ou produto...",\n  "ctaText": "CTA",\n  "ctaVariant": "primary",\n  "badgePrimary": "Destaque curto (ex: 15% OFF)",\n  "badgeSecondary": "Apoio (ex: FRETE GRÁTIS)",\n  "footerInfo": "Informações de rodapé, regras ou nomes técnicos",\n  "keyBenefits": ["Benefício 1", "Benefício 2"],\n  "objectionsHandled": ["Objeção 1"],\n  "layoutStyle": "split",\n  "backgroundShape": "blob",\n  "imagePrompt": "Prompt",\n  "themeColor": "#HEX",\n  "secondaryColor": "#HEX"\n}`,
  social: `{\n  "hook": "Gancho",\n  "body": "Corpo",\n  "cta": "CTA",\n  "hashtags": ["#tag"],\n  "imagePrompt": "Prompt",\n  "themeColor": "#HEX",\n  "secondaryColor": "#HEX"\n}`,
  email: `{\n  "subject": "Assunto",\n  "preheader": "Preheader",\n  "headline": "Título dinâmico",\n  "subtitle": "Subtítulo de apoio",\n  "body": "Corpo persuasivo em 2-3 parágrafos",\n  "heroBadge": "Badge (ex: NOVIDADE)",\n  "benefitTitle": "Por que escolher?",\n  "keyBenefits": ["Benefício forte 1", "Benefício 2"],\n  "objectionsHandled": ["Objeção 1"],\n  "urgencyText": "Apenas hoje",\n  "testimonials": ["Nome do Cliente - R$ Resultado Alcançado | 'Citação do cliente aqui'"],\n  "ctaText": "Comprar Agora",\n  "ctaVariant": "primary",\n  "secondaryCta": "Comprar Agora",\n  "footerInfo": "*Regras, validade ou termos legais",\n  "imagePrompt": "Prompt em inglês",\n  "layoutStyle": "minimalist | split | diagonal | centered | editorial | modern | overlap | newsletter",\n  "backgroundShape": "square | curve | arch | pill | blob",\n  "themeColor": "#HEX",\n  "secondaryColor": "#HEX"\n}`
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
  const caption = [social.hook, social.body, social.cta].filter((p) => p.length > 0).join("\n\n");
  return { ...base, hook: social.hook, caption, body: social.body, cta: social.cta, hashtags: social.hashtags };
}

export type { MaterialType };