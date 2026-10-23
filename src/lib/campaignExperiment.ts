import type { MarketingBrief, MaterialType } from "../types/brief";
import type { BuilderState, CampaignAsset } from "../types/builder";
import { calculateCreativeQuality } from "./creativeQuality";
import { reviewEditorialContent } from "./editorialReview";
import type { AssetExperimentMetrics } from "./supabase";

export interface CampaignChannelQuality {
  type: MaterialType;
  score: number;
  label: "Excelente" | "Forte" | "Ajustar" | "Revisar";
  completeness: number;
  editorial: number;
  channelFit: number;
  issueCount: number;
  blockingIssues: number;
}

export interface CampaignQualitySummary {
  overallScore: number;
  channels: CampaignChannelQuality[];
}

export interface ExperimentRates {
  ctr: number;
  cvr: number;
  conversionRate: number;
  revenuePerConversion: number;
}

const clean = (value: string | undefined | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export function buildCampaignReviewBrief(state: BuilderState): MarketingBrief {
  const plan = state.discoveryPlan;
  const productImages = state.productImages?.filter(Boolean) ?? [];
  return {
    brandName: clean(plan?.brandName) ?? clean(state.brandName) ?? "Sua Marca",
    objective: clean(plan?.objective),
    context: clean(plan?.detectedContext),
    strategy: clean(plan?.proposedStrategy),
    missingInfo: clean(plan?.missingInfo),
    audience: clean(plan?.audience),
    product: clean(plan?.product),
    offer: clean(plan?.offer),
    tone: clean(plan?.tone),
    websiteUrl: clean(plan?.websiteUrl),
    site: null,
    availableImageUrls: productImages,
    productUrl: clean(plan?.productUrl),
    productImageUrl:
      clean(plan?.productImageUrl) ??
      clean(state.productImageUrl) ??
      productImages[0] ??
      null,
    productTitle: clean(plan?.productTitle),
    productDescription: clean(plan?.productDescription),
  };
}

export function calculateCampaignChannelQuality(
  state: BuilderState,
): CampaignQualitySummary {
  const assets: CampaignAsset[] =
    state.type === "campaign" ? (state.campaignAssets ?? []) : [];
  if (!assets.length) return { overallScore: 0, channels: [] };

  const brief = buildCampaignReviewBrief(state);
  const channels = assets.map((asset) => {
    const issues = reviewEditorialContent(
      asset.type,
      asset.content,
      brief,
      assets,
    );
    const quality = calculateCreativeQuality(asset, issues);
    return {
      type: asset.type,
      ...quality,
      issueCount: issues.length,
      blockingIssues: issues.filter((issue) => issue.severity === "blocking")
        .length,
    } satisfies CampaignChannelQuality;
  });

  return {
    overallScore: Math.round(
      channels.reduce((sum, channel) => sum + channel.score, 0) /
        channels.length,
    ),
    channels,
  };
}

export function calculateExperimentRates(
  metrics?: Pick<
    AssetExperimentMetrics,
    "impressions" | "clicks" | "conversions" | "revenue"
  > | null,
): ExperimentRates {
  const impressions = Math.max(0, metrics?.impressions ?? 0);
  const clicks = Math.max(0, metrics?.clicks ?? 0);
  const conversions = Math.max(0, metrics?.conversions ?? 0);
  const revenue = Math.max(0, metrics?.revenue ?? 0);

  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
    conversionRate: impressions > 0 ? (conversions / impressions) * 100 : 0,
    revenuePerConversion: conversions > 0 ? revenue / conversions : 0,
  };
}
