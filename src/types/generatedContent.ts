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
  keyBenefits: looseList.transform((items) => items.slice(0, 3)).default([]),
  objectionsHandled: looseList.transform((items) => items.slice(0, 2)).default([]),
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
  hook: requiredString,
  body: requiredText,
  cta: requiredString,
  hashtags: looseList.transform((items) => items.slice(0, 8)).default([]),
});

export const EmailCopySchema = designSchema.extend({
  subject: requiredString,
  preheader: looseString.default(""),
  headline: looseString.default(""),
  subtitle: looseString.default(""),
  body: requiredText,
  ctaText: requiredString,
  ctaVariant: ctaVariantSchema,
  keyBenefits: looseList.transform((items) => items.slice(0, 4)).default([]),
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
  banner: `{\n  "headline": "string obrigatória: 3–7 palavras, até 50 caracteres",\n  "subheadline": "string: 5–14 palavras, sem repetir a headline",\n  "body": "string: uma frase de até 28 palavras",\n  "ctaText": "string obrigatória: 1–3 palavras",\n  "ctaVariant": "primary | secondary | urgent | soft",\n  "badgePrimary": "string: somente fato/oferta confirmada; senão vazio",\n  "badgeSecondary": "string: somente fato/oferta confirmada; senão vazio",\n  "footerInfo": "string: condição ou informação factual; senão vazio",\n  "keyBenefits": ["2–3 benefícios curtos e diferentes"],\n  "objectionsHandled": ["0–2 objeções reais e breves"],\n  "layoutStyle": "split | reverse | centered",\n  "backgroundShape": "curve | blob | geometric | frame | diagonal | arch | wave | pill | offset",\n  "imagePrompt": "prompt visual detalhado em inglês, sem texto na imagem",\n  "themeColor": "#RRGGBB",\n  "secondaryColor": "#RRGGBB"\n}`,
  social: `{\n  "hook": "string obrigatória: até 12 palavras, específica e sem clickbait",\n  "body": "string obrigatória: 70–150 palavras em parágrafos curtos",\n  "cta": "string obrigatória: uma ação clara",\n  "hashtags": ["4–8 hashtags relevantes e não genéricas"],\n  "imagePrompt": "prompt 4:5 detalhado em inglês, sem texto na imagem",\n  "themeColor": "#RRGGBB",\n  "secondaryColor": "#RRGGBB"\n}`,
  email: `{\n  "subject": "string obrigatória: até 9 palavras e 60 caracteres",\n  "preheader": "string: 40–90 caracteres e sem repetir o assunto",\n  "headline": "string: até 8 palavras",\n  "subtitle": "string: até 16 palavras",\n  "body": "string obrigatória: 110–220 palavras em 3–5 parágrafos",\n  "heroBadge": "string: somente fato confirmado; senão vazio",\n  "benefitTitle": "string curta que introduz os benefícios",\n  "keyBenefits": ["2–4 benefícios distintos"],\n  "objectionsHandled": ["0–2 objeções reais respondidas"],\n  "urgencyText": "string: somente urgência confirmada; senão vazio",\n  "testimonials": ["somente depoimentos literais fornecidos; senão array vazio"],\n  "ctaText": "string obrigatória: ação principal concreta",\n  "ctaVariant": "primary | secondary | urgent | soft",\n  "secondaryCta": "string: mesma intenção da ação principal ou vazio",\n  "footerInfo": "string: condição factual ou vazio",\n  "imagePrompt": "prompt hero horizontal detalhado em inglês, sem texto",\n  "layoutStyle": "minimalist | split | diagonal | centered | editorial | modern | overlap | newsletter",\n  "backgroundShape": "square | curve | arch | pill | blob",\n  "themeColor": "#RRGGBB",\n  "secondaryColor": "#RRGGBB"\n}`
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
