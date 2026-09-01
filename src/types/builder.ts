// src/types/builder.ts
import type { MaterialType } from "./brief";

export type BuilderType = MaterialType | "none" | "campaign" | "discovery_plan";

export interface DiscoveryPlan {
  detectedContext: string;
  missingInfo: string;
  proposedStrategy: string;
  brandName?: string;
  product?: string;
  audience?: string;
  offer?: string;
  objective?: string;
  tone?: string;
  channels?: string[];
  websiteUrl?: string;
  productSku?: string | null;
  productUrl?: string | null;
  productImageUrl?: string | null;
  productTitle?: string | null;
  productDescription?: string | null;
}

export interface BannerContent {
  type: "banner";
  brandName?: string;
  title: string;
  subtitle?: string;
  cta: string;
  imagePrompt: string;
  imageSeed?: number;
  productImageUrl?: string | null;
  productSku?: string | null;
  themeColor?: string;
  secondaryColor?: string;
  layoutStyle?: "diagonal" | "split" | "minimalist" | "centered" | "reverse";
  badgePrimary?: string;
  badgeSecondary?: string;
  backgroundShape?:
    | "diagonal"
    | "curve"
    | "split"
    | "minimalist"
    | "blob"
    | "geometric"
    | "frame"
    | "arch"
    | "wave"
    | "pill"
    | "offset";
  bannerFontSizes?: BannerFontSizes;
}

export interface EmailContent {
  type: "email";
  brandName?: string;
  preheader: string;
  emailHeroImagePrompt: string;
  title: string;
  subtitle?: string;
  body: string;
  cta: string;
  footerText?: string;
  imageSeed?: number;
  productImageUrl?: string | null;
  productSku?: string | null;
  themeColor?: string;
  secondaryColor?: string;
  heroBadge?: string;
  benefitTitle?: string;
  secondaryCta?: string;
  urgencyText?: string;
  testimonials?: string[];
  footerInfo?: string;
  // --> NOVAS OPÇÕES DE E-MAIL AQUI <--
  layoutStyle?:
    | "diagonal"
    | "split"
    | "minimalist"
    | "centered"
    | "editorial"
    | "modern"
    | "overlap"
    | "newsletter";
  backgroundShape?: "square" | "curve" | "arch" | "pill" | "blob";
}

export interface SocialContent {
  type: "social";
  brandName?: string;
  caption: string;
  hashtags: string[];
  imagePrompt: string;
  imageSeed?: number;
  productImageUrl?: string | null;
  productSku?: string | null;
  themeColor?: string;
  secondaryColor?: string;
}

export type AssetContent = BannerContent | EmailContent | SocialContent;
export type CtaVariant = "primary" | "secondary" | "urgent" | "soft";

/** Bloco reutilizável para roteiros, apresentações e documentos longos. */
export interface StructuredContentSection {
  id: string;
  title: string;
  body: string;
  items?: string[];
  timing?: string;
  visualDirection?: string;
  speakerNotes?: string;
}

/**
 * Documento normalizado exibido pelo preview avançado. O JSON original fica
 * preservado na biblioteca, mas todos os novos formatos compartilham esta
 * representação para edição, exportação e futuras integrações.
 */
export interface StructuredContentDocument {
  format: Exclude<MaterialType, "banner" | "social" | "email">;
  title: string;
  subtitle?: string;
  summary?: string;
  duration?: string;
  sections: StructuredContentSection[];
  cta?: string;
  keywords?: string[];
  disclaimer?: string;
}

export interface BannerFontSizes {
  title?: number;
  subtitle?: number;
  body?: number;
  benefits?: number;
  footer?: number;
  badgePrimary?: number;
  badgeSecondary?: number;
}

export interface BuilderState {
  type: BuilderType;
  generationError?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  cta?: string;
  imagePrompt?: string;
  caption?: string;
  hashtags?: string[];
  imageSeed?: number;
  campaignAssets?: CampaignAsset[];
  discoveryPlan?: DiscoveryPlan;
  hook?: string;
  ctaVariant?: CtaVariant;
  keyBenefits?: string[];
  objectionsHandled?: string[];
  brandName?: string;
  preheader?: string;
  emailHeroImagePrompt?: string;
  footerText?: string;
  productImageUrl?: string | null;
  productSku?: string | null;
  productImages?: string[];
  themeColor?: string;
  secondaryColor?: string;
  layoutStyle?:
    | "diagonal"
    | "split"
    | "minimalist"
    | "centered"
    | "reverse"
    | "editorial"
    | "modern"
    | "overlap"
    | "newsletter";
  badgePrimary?: string;
  badgeSecondary?: string;
  backgroundShape?:
    | "diagonal"
    | "curve"
    | "split"
    | "minimalist"
    | "blob"
    | "geometric"
    | "frame"
    | "arch"
    | "wave"
    | "pill"
    | "offset"
    | "square";
  imagePosX?: number;
  imagePosY?: number;
  imageScale?: number;
  heroBadge?: string;
  benefitTitle?: string;
  secondaryCta?: string;
  urgencyText?: string;
  testimonials?: string[];
  footerInfo?: string;

  textColor?: string;
  boxColor?: string;
  fontFamily?: string;
  bannerFontSizes?: BannerFontSizes;
  structuredContent?: StructuredContentDocument;
}

export interface SiteBrandData {
  url: string;
  title: string;
  description: string;
  brandName: string;
  headings: string[];
  bodySnippet: string;
  ogImage?: string;
  keywords?: string;
  colors?: string[];
}

export interface BrandContext {
  persona: string;
  tone: string;
  framework: string;
  brandName?: string;
  product?: string;
  offer?: string;
  site?: SiteBrandData | null;
}

export interface CampaignAsset {
  id: string;
  type: MaterialType;
  content: BuilderState;
  status: "draft" | "review" | "approved";
}

export interface SavedAsset {
  id: string;
  name: string;
  type: "prompt" | "reference_copy" | "brand_manifesto";
  content: string;
}

export interface QualityScores {
  persuasion: number;
  clarity: number;
  seo: number;
}
