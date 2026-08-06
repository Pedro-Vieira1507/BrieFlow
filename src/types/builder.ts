// src/types/builder.ts
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
  productSku?: string | null;
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
  // Campos de Design Dinâmico
  themeColor?: string;
  secondaryColor?: string;
  layoutStyle?: "diagonal" | "split" | "minimalist" | "centered";
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
  // Campos de Design Dinâmico
  themeColor?: string;
  secondaryColor?: string;
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
  // Campos de Design Dinâmico
  themeColor?: string;
  secondaryColor?: string;
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
  preheader?: string;
  emailHeroImagePrompt?: string;
  footerText?: string;
  productImageUrl?: string | null;
  productSku?: string | null;
  productImages?: string[];
  themeColor?: string;
  secondaryColor?: string;
  layoutStyle?: "diagonal" | "split" | "minimalist" | "centered";
  imagePosX?: number;
  imagePosY?: number;
  imageScale?: number;
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
  colors?: string[]; // Cores extraídas do site
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

export interface QualityScores {
  persuasion: number;
  clarity: number;
  seo: number;
}