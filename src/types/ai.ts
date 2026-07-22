import type {
  BuilderState,
  CampaignAsset,
  DiscoveryPlan,
} from "./builder";

export type AiIntent =
  | "discovery"
  | "campaign"
  | "banner"
  | "social"
  | "email"
  | "copy"
  | "strategy"
  | "website_analysis"
  | "general";

export type AiChannel =
  | "instagram"
  | "linkedin"
  | "facebook"
  | "google_ads"
  | "email"
  | "website"
  | "whatsapp"
  | "other";

export type AiAssetType = "banner" | "social" | "email";

export type AiStage =
  | "discovery"
  | "ready_to_generate"
  | "generating"
  | "completed"
  | "needs_revision";

export type AiMessageRole = "system" | "user" | "assistant";

export interface AiChatMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiBrandProfile {
  brandName?: string;
  websiteUrl?: string;
  market?: string;
  product?: string;
  offer?: string;
  audience?: string;
  tone?: string;
  differentiators?: string[];
  proofPoints?: string[];
  bannedTerms?: string[];
  preferredChannels?: AiChannel[];
}

export interface AiCampaignBrief {
  objective?: string;
  channel?: AiChannel;
  audience?: string;
  offer?: string;
  product?: string;
  deadline?: string;
  cta?: string;
  desiredAsset?: AiAssetType;
}

export interface AiQualityScore {
  persuasion: number;
  clarity: number;
  brandAlignment: number;
  channelFit: number;
  completeness: number;
  overall: number;
}

export interface AiQualityReview {
  passed: boolean;
  score: AiQualityScore;
  issues: string[];
  suggestions: string[];
}

export interface AiGeneratedCopy {
  headline?: string;
  subheadline?: string;
  body?: string;
  caption?: string;
  hashtags?: string[];
  cta?: string;
  imagePrompt?: string;
  alternativeHeadlines?: string[];
}

export interface AiGenerationMeta {
  requestId: string;
  model: string;
  intent: AiIntent;
  stage: AiStage;
  usedFallback: boolean;
  generatedAt: string;
  latencyMs?: number;
}

export interface AiDiscoveryResult {
  reply: string;
  plan: Partial<DiscoveryPlan>;
  missingInfo: string[];
  nextQuestion?: string;
  stage: AiStage;
}

export interface AiAssetResult {
  reply: string;
  asset: CampaignAsset;
  copy: AiGeneratedCopy;
  quality: AiQualityReview;
  stage: "completed" | "needs_revision";
}

export interface AiChatResult {
  reply: string;
  discovery?: AiDiscoveryResult;
  asset?: AiAssetResult;
  builderState?: BuilderState;
  meta: AiGenerationMeta;
}

export interface AiChatRequest {
  message: string;
  history?: AiChatMessage[];
  intent?: AiIntent;
  targetAsset?: AiAssetType;
  brand?: AiBrandProfile;
  brief?: AiCampaignBrief;
  currentPlan?: Partial<DiscoveryPlan>;
  requestId?: string;
}

export interface AiStreamEvent {
  type: "token" | "result" | "error" | "done";
  requestId: string;
  content?: string;
  result?: AiChatResult;
  error?: {
    code:
      | "INVALID_INPUT"
      | "MODEL_UNAVAILABLE"
      | "MODEL_TIMEOUT"
      | "MODEL_RESPONSE_INVALID"
      | "INTERNAL_ERROR";
    message: string;
  };
}

export interface AiModelResponse {
  reply?: string;
  discoveryPlan?: Partial<DiscoveryPlan>;
  asset?: Partial<CampaignAsset>;
  copy?: AiGeneratedCopy;
  quality?: Partial<AiQualityReview>;
}

export function isAiAssetType(value: unknown): value is AiAssetType {
  return value === "banner" || value === "social" || value === "email";
}

export function isAiIntent(value: unknown): value is AiIntent {
  return (
    value === "discovery" ||
    value === "campaign" ||
    value === "banner" ||
    value === "social" ||
    value === "email" ||
    value === "copy" ||
    value === "strategy" ||
    value === "website_analysis" ||
    value === "general"
  );
}

export function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `bf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clampScore(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function normalizeQualityScore(
  input?: Partial<AiQualityScore>,
): AiQualityScore {
  const persuasion = clampScore(input?.persuasion);
  const clarity = clampScore(input?.clarity);
  const brandAlignment = clampScore(input?.brandAlignment);
  const channelFit = clampScore(input?.channelFit);
  const completeness = clampScore(input?.completeness);

  const overall =
    input?.overall !== undefined
      ? clampScore(input.overall)
      : Math.round(
          (persuasion +
            clarity +
            brandAlignment +
            channelFit +
            completeness) /
            5,
        );

  return {
    persuasion,
    clarity,
    brandAlignment,
    channelFit,
    completeness,
    overall,
  };
}