// src/types/generatedContent.ts
import { z } from "zod";
import type { BuilderState, CtaVariant } from "./builder";
import type { MaterialType } from "./brief";

const looseString = z.preprocess((value) => {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value : String(value);
  return raw
    .replace(/\*\*/g, "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  return /^#[0-9a-fA-F]{3,8}$/.test(raw) ? raw : undefined;
}, z.string().optional());

const ctaVariantSchema = z.preprocess((value) => {
  const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
  return ["primary", "secondary", "urgent", "soft"].includes(raw)
    ? raw
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
  ctaText: looseString,
  ctaVariant: ctaVariantSchema,
  keyBenefits: looseList.default([]),
  objectionsHandled: looseList.default([]),
  layoutStyle: z.preprocess((value) => {
    const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
    return ["diagonal", "split", "minimalist", "centered"].includes(raw)
      ? raw
      : "split";
  }, z.enum(["diagonal", "split", "minimalist", "centered"])),
});

export const SocialCopySchema = designSchema.extend({
  hook: looseString,
  body: looseString,
  cta: looseString.default(""),
  hashtags: z.preprocess((value) => {
    if (value === null || value === undefined) return [];
    const arr = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
    return arr
      .map((item) => (typeof item === "string" ? item : String(item)))
      .map((item) => item.replace(/\*\*/g, "").trim())
      .filter((item) => item.length > 0 && item.toLowerCase() !== "null");
  }, z.array(z.string())).pipe(z.array(z.string()).min(1, "A geração de hashtags é estritamente obrigatória.")),
});

export const EmailCopySchema = designSchema.extend({
  subject: looseString,
  preheader: looseString.default(""),
  headline: looseString.default(""),
  body: looseString,
  ctaText: looseString,
  ctaVariant: ctaVariantSchema,
  keyBenefits: looseList.default([]),
  objectionsHandled: looseList.default([]),
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
  banner: `{
  "headline": "Benefício principal... (SE HOUVER OFERTA NO BRIEFING, ELA DEVE OBRIGATORIAMENTE APARECER AQUI OU NO SUBHEADLINE)",
  "subheadline": "1 frase explicando a proposta de valor e para quem",
  "ctaText": "CTA curto começando por verbo de ação",
  "ctaVariant": "primary | secondary | urgent | soft",
  "keyBenefits": ["3 a 4 benefícios em linguagem de resultado, não de feature"],
  "objectionsHandled": ["2 a 3 objeções reais do público já respondidas em 1 frase cada"],
  "layoutStyle": "diagonal | split | minimalist | centered",
  "imagePrompt": "Detailed photography prompt in ENGLISH, no text, no logos",
  "themeColor": "#HEX vibrante da marca",
  "secondaryColor": "#HEX de contraste"
}`,
  social: `{
  "hook": "Primeira linha que para o scroll (SE HOUVER OFERTA NO BRIEFING, DEVE APARECER AQUI)",
  "body": "2 a 4 frases curtas com benefício e prova. Use \\n para quebrar linha",
  "cta": "Chamada final direta, com verbo de ação",
  "hashtags": ["#hashtags", "#relevantes", "#obrigatorias"],
  "imagePrompt": "Detailed photography prompt in ENGLISH, no text, no logos",
  "themeColor": "#HEX vibrante da marca",
  "secondaryColor": "#HEX de contraste"
}`,
  email: `{
  "subject": "Assunto de até 45 caracteres (SE HOUVER OFERTA, INCLUA NO ASSUNTO)",
  "preheader": "Complemento do assunto, sem repetir as mesmas palavras",
  "headline": "Título dentro do e-mail (SE HOUVER OFERTA, INCLUA AQUI)",
  "body": "2 a 3 parágrafos persuasivos. Use \\n\\n entre parágrafos",
  "ctaText": "Texto do botão, começando por verbo",
  "ctaVariant": "primary | secondary | urgent | soft",
  "keyBenefits": ["3 benefícios em formato de bullet"],
  "objectionsHandled": ["1 a 2 objeções respondidas"],
  "imagePrompt": "Detailed photography prompt in ENGLISH, no text, no logos",
  "themeColor": "#HEX vibrante da marca",
  "secondaryColor": "#HEX de contraste"
}`,
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
      cta: landing.ctaText,
      ctaVariant: landing.ctaVariant satisfies CtaVariant,
      keyBenefits: landing.keyBenefits,
      objectionsHandled: landing.objectionsHandled,
      layoutStyle: landing.layoutStyle,
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
    };
  }

  const social = copy as SocialCopy;
  const caption = [social.hook, social.body, social.cta]
    .filter((part) => part.length > 0)
    .join("\n\n");

  return {
    ...base,
    hook: social.hook,
    caption,
    body: social.body,
    cta: social.cta,
    hashtags: social.hashtags,
  };
}

export type { MaterialType };