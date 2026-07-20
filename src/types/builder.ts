// types/builder.ts — Corrigido (tipos aprimorados e específicos)
export type BuilderType =
  | "email"
  | "social"
  | "banner"
  | "none"
  | "campaign"
  | "discovery_plan";

export interface DiscoveryPlan {
  detectedContext: string;
  missingInfo: string;
  proposedStrategy: string;
  brandName?: string;
  product?: string;
  audience?: string;
  offer?: string;
  channels?: string[];
  websiteUrl?: string;
}

// Tipos específicos por peça para validação mais rigorosa
export interface BannerContent {
  type: "banner";
  brandName?: string;
  title: string;
  subtitle?: string;
  cta: string;
  imagePrompt: string;
  imageSeed?: number;
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
}

export interface SocialContent {
  type: "social";
  brandName?: string;
  caption: string;
  hashtags: string[];
  imagePrompt: string;
  imageSeed?: number;
}

export type AssetContent = BannerContent | EmailContent | SocialContent;

export interface BuilderState {
  type: BuilderType;
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
  brandName?: string;
  // Premium e-mail fields
  preheader?: string;
  emailHeroImagePrompt?: string;
  footerText?: string;
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
  type: "email" | "social" | "banner";
  content: BuilderState;
  status: "draft" | "review" | "approved";
}

export interface SavedAsset {
  id: string;
  name: string;
  type: "prompt" | "reference_copy" | "brand_manifesto";
  content: string;
}

// Scores de qualidade para validação do conteúdo gerado
export interface QualityScores {
  persuasion: number; // 0-100: força persuasiva do copy
  clarity: number;     // 0-100: clareza e legibilidade
  seo: number;         // 0-100: otimização para busca (quando aplicável)
}