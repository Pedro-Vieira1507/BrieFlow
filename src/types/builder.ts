// types/builder.ts
export type BuilderType = "email" | "social" | "banner" | "none" | "campaign" | "discovery_plan";

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
  discoveryPlan?: {
    detectedContext: string;
    missingInfo: string;
    proposedStrategy: string;
  };
  // NOVO: Campos Premium para E-mail
  preheader?: string;
  emailHeroImagePrompt?: string;
  footerText?: string;
}

export interface BrandContext {
  persona: string;
  tone: string;
  framework: string;
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