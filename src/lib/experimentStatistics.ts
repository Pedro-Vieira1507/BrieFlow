export type ExperimentVariantLabel = "A" | "B";

export interface ExperimentMetricSnapshot {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue?: number;
}

export type EvidenceStatus = "insufficient" | "inconclusive" | "significant";

export interface ProportionEvidence {
  label: string;
  aRate: number;
  bRate: number;
  deltaPercentagePoints: number;
  relativeLiftPercent: number | null;
  pValue: number | null;
  ciLowPercentagePoints: number | null;
  ciHighPercentagePoints: number | null;
  status: EvidenceStatus;
  leader: ExperimentVariantLabel | null;
  significantWinner: ExperimentVariantLabel | null;
  sampleReady: boolean;
  targetPerVariant: number | null;
  additionalA: number | null;
  additionalB: number | null;
}

export interface ExperimentEvidenceSummary {
  conversion: ProportionEvidence;
  ctr: ProportionEvidence;
  recommendation:
    | "collect_more_data"
    | "conversion_inconclusive"
    | "ctr_only_signal"
    | "significant_conversion";
  suggestedWinner: ExperimentVariantLabel | null;
}

const MIN_TOTAL_PER_VARIANT = 100;
const Z_95 = 1.959963984540054;
const Z_80_POWER = 0.8416212335729143;
const MAX_ESTIMATED_SAMPLE = 10_000_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeCount(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 0) return 0;
  return Math.floor(value);
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);
  return sign * y;
}

function normalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function estimateRequiredPerVariant(pA: number, pB: number): number | null {
  const delta = Math.abs(pB - pA);
  if (delta < 0.000001) return null;
  const average = clamp((pA + pB) / 2, 0.000001, 0.999999);
  const estimated =
    (2 * average * (1 - average) * (Z_95 + Z_80_POWER) ** 2) /
    delta ** 2;
  if (!Number.isFinite(estimated) || estimated <= 0) return null;
  return Math.min(MAX_ESTIMATED_SAMPLE, Math.max(MIN_TOTAL_PER_VARIANT, Math.ceil(estimated)));
}

export function compareExperimentProportions(input: {
  label: string;
  aSuccesses: number;
  aTotal: number;
  bSuccesses: number;
  bTotal: number;
}): ProportionEvidence {
  const aTotal = normalizeCount(input.aTotal);
  const bTotal = normalizeCount(input.bTotal);
  const aSuccesses = Math.min(aTotal, normalizeCount(input.aSuccesses));
  const bSuccesses = Math.min(bTotal, normalizeCount(input.bSuccesses));
  const pA = aTotal > 0 ? aSuccesses / aTotal : 0;
  const pB = bTotal > 0 ? bSuccesses / bTotal : 0;
  const delta = pB - pA;
  const leader: ExperimentVariantLabel | null =
    delta > 0 ? "B" : delta < 0 ? "A" : null;
  const pooledTotal = aTotal + bTotal;
  const pooledSuccesses = aSuccesses + bSuccesses;
  const pooledRate = pooledTotal > 0 ? pooledSuccesses / pooledTotal : 0;
  const expectedA = aTotal * pooledRate;
  const expectedB = bTotal * pooledRate;
  const expectedFailureA = aTotal * (1 - pooledRate);
  const expectedFailureB = bTotal * (1 - pooledRate);
  const sampleReady =
    aTotal >= MIN_TOTAL_PER_VARIANT &&
    bTotal >= MIN_TOTAL_PER_VARIANT &&
    expectedA >= 5 &&
    expectedB >= 5 &&
    expectedFailureA >= 5 &&
    expectedFailureB >= 5;

  let pValue: number | null = null;
  let ciLow: number | null = null;
  let ciHigh: number | null = null;

  if (aTotal > 0 && bTotal > 0) {
    const pooledVariance = pooledRate * (1 - pooledRate) * (1 / aTotal + 1 / bTotal);
    if (pooledVariance > 0) {
      const z = delta / Math.sqrt(pooledVariance);
      pValue = clamp(2 * (1 - normalCdf(Math.abs(z))), 0, 1);
    }

    const unpooledVariance =
      (pA * (1 - pA)) / aTotal + (pB * (1 - pB)) / bTotal;
    if (unpooledVariance >= 0) {
      const margin = Z_95 * Math.sqrt(unpooledVariance);
      ciLow = delta - margin;
      ciHigh = delta + margin;
    }
  }

  const significant = sampleReady && pValue !== null && pValue < 0.05;
  const status: EvidenceStatus = !sampleReady
    ? "insufficient"
    : significant
      ? "significant"
      : "inconclusive";
  const targetPerVariant = estimateRequiredPerVariant(pA, pB);

  return {
    label: input.label,
    aRate: pA * 100,
    bRate: pB * 100,
    deltaPercentagePoints: delta * 100,
    relativeLiftPercent: pA > 0 ? (delta / pA) * 100 : pB > 0 ? null : 0,
    pValue,
    ciLowPercentagePoints: ciLow === null ? null : ciLow * 100,
    ciHighPercentagePoints: ciHigh === null ? null : ciHigh * 100,
    status,
    leader,
    significantWinner: significant ? leader : null,
    sampleReady,
    targetPerVariant,
    additionalA:
      targetPerVariant === null ? null : Math.max(0, targetPerVariant - aTotal),
    additionalB:
      targetPerVariant === null ? null : Math.max(0, targetPerVariant - bTotal),
  };
}

export function analyzeExperimentEvidence(
  aMetrics?: ExperimentMetricSnapshot | null,
  bMetrics?: ExperimentMetricSnapshot | null,
): ExperimentEvidenceSummary {
  const a = aMetrics ?? { impressions: 0, clicks: 0, conversions: 0 };
  const b = bMetrics ?? { impressions: 0, clicks: 0, conversions: 0 };

  const conversion = compareExperimentProportions({
    label: "Conversão por impressão",
    aSuccesses: a.conversions,
    aTotal: a.impressions,
    bSuccesses: b.conversions,
    bTotal: b.impressions,
  });
  const ctr = compareExperimentProportions({
    label: "CTR",
    aSuccesses: a.clicks,
    aTotal: a.impressions,
    bSuccesses: b.clicks,
    bTotal: b.impressions,
  });

  if (conversion.status === "significant") {
    return {
      conversion,
      ctr,
      recommendation: "significant_conversion",
      suggestedWinner: conversion.significantWinner,
    };
  }
  if (conversion.status === "insufficient") {
    return {
      conversion,
      ctr,
      recommendation: "collect_more_data",
      suggestedWinner: null,
    };
  }
  if (ctr.status === "significant") {
    return {
      conversion,
      ctr,
      recommendation: "ctr_only_signal",
      suggestedWinner: null,
    };
  }
  return {
    conversion,
    ctr,
    recommendation: "conversion_inconclusive",
    suggestedWinner: null,
  };
}
