import type { EditorialIssue } from "./editorialReview";
import type { BuilderState, CampaignAsset } from "../types/builder";

export interface CreativeQualityScore {
  score: number;
  completeness: number;
  editorial: number;
  channelFit: number;
  label: "Excelente" | "Forte" | "Ajustar" | "Revisar";
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function hasText(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

function requiredSignals(asset: CampaignAsset): boolean[] {
  const content: BuilderState = asset.content;
  const document = content.structuredContent;

  if (asset.type === "banner") {
    return [
      hasText(content.title),
      hasText(content.cta),
      hasText(content.imagePrompt) ||
        hasText(content.productImageUrl) ||
        hasText(content.backgroundImageUrl),
    ];
  }

  if (asset.type === "email") {
    return [
      hasText(content.preheader),
      hasText(content.title),
      hasText(content.body),
      hasText(content.cta),
      hasText(content.emailHeroImagePrompt) || hasText(content.productImageUrl),
    ];
  }

  if (asset.type === "social") {
    return [
      hasText(content.caption),
      Boolean(content.hashtags?.some((tag) => tag.trim())),
      hasText(content.imagePrompt) || hasText(content.productImageUrl),
    ];
  }

  return [
    hasText(document?.title),
    Boolean(document?.sections.length),
    Boolean(
      document?.sections.every(
        (section) =>
          hasText(section.body) ||
          Boolean(section.items?.some((item) => item.trim())),
      ),
    ),
  ];
}

function channelFitScore(asset: CampaignAsset): number {
  const content = asset.content;
  if (asset.type === "banner") {
    const titleLength = content.title?.trim().length ?? 0;
    return clamp(
      55 +
        (titleLength > 0 && titleLength <= 70 ? 25 : 0) +
        (hasText(content.cta) ? 20 : 0),
    );
  }
  if (asset.type === "email") {
    const bodyLength = content.body?.trim().length ?? 0;
    return clamp(
      50 +
        (hasText(content.preheader) ? 15 : 0) +
        (bodyLength >= 80 ? 20 : 0) +
        (hasText(content.cta) ? 15 : 0),
    );
  }
  if (asset.type === "social") {
    const captionLength = content.caption?.trim().length ?? 0;
    return clamp(
      50 +
        (captionLength >= 40 && captionLength <= 1200 ? 25 : 0) +
        (content.hashtags?.length ? 10 : 0) +
        (hasText(content.imagePrompt) || hasText(content.productImageUrl)
          ? 15
          : 0),
    );
  }

  const sections = content.structuredContent?.sections ?? [];
  return clamp(
    55 +
      (sections.length >= 2 ? 20 : 0) +
      (sections.every((section) => hasText(section.title)) ? 10 : 0) +
      (hasText(content.structuredContent?.cta) ||
      asset.type === "technical_sheet"
        ? 15
        : 0),
  );
}

export function calculateCreativeQuality(
  asset: CampaignAsset,
  issues: EditorialIssue[],
): CreativeQualityScore {
  const required = requiredSignals(asset);
  const completed = required.filter(Boolean).length;
  const completeness = Math.round(
    required.length ? (completed / required.length) * 100 : 0,
  );

  const blocking = issues.filter(
    (issue) => issue.severity === "blocking",
  ).length;
  const attention = issues.length - blocking;
  const editorial = clamp(100 - blocking * 45 - attention * 12);
  const channelFit = channelFitScore(asset);
  const score = Math.round(
    completeness * 0.45 + editorial * 0.4 + channelFit * 0.15,
  );

  const label: CreativeQualityScore["label"] =
    score >= 90
      ? "Excelente"
      : score >= 75
        ? "Forte"
        : score >= 60
          ? "Ajustar"
          : "Revisar";

  return {
    score,
    completeness,
    editorial,
    channelFit,
    label,
  };
}
