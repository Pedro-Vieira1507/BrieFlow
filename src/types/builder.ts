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
  // NOVO: Para o agente propor o plano antes de gerar
  discoveryPlan?: {
    detectedContext: string;
    missingInfo: string;
    proposedStrategy: string;
  };
}

export interface BrandContext {
  persona: string;
  tone: string;
  framework: string;
}

export interface CampaignAsset {
  id: string;
  type: "email" | "social" | "banner" | "landing_page_copy" | "script";
  content: BuilderState;
  status: "draft" | "review" | "approved"; 
}

export interface SavedAsset {
  id: string;
  name: string;
  type: "prompt" | "reference_copy" | "brand_manifesto";
  content: string;
}