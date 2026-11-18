import type { BuilderState, CampaignAsset } from "../types/builder";

import {
  CORE_MATERIAL_TYPES,
  isMaterialType,
  type MaterialType,
} from "../types/brief.ts";

export function selectedMaterials(channels: unknown): MaterialType[] {
  if (!Array.isArray(channels)) return [...CORE_MATERIAL_TYPES];
  const materials = [...new Set(channels.filter(isMaterialType))];
  return materials.length || channels.length === 0
    ? materials
    : [...CORE_MATERIAL_TYPES];
}

const FORMAT_MENTIONS: Record<MaterialType, RegExp> = {
  banner: /\bbanners?\b/,
  email: /\be-?mails?\b/,
  social: /\b(?:post(?:s)?(?: social| sociais)?|social)\b/,
  reel: /\breels?\b/,
  video: /\bvideos?\b/,
  podcast: /\bpodcasts?\b/,
  slides: /\b(?:slides?|apresentacao|apresentacoes)\b/,
  technical_sheet: /\bfichas? tecnicas?\b/,
  blog: /\bblogs?\b/,
  whatsapp: /\bwhats\s?app\b/,
};

/** A suggestion for the review screen when an older discovery response omits format IDs. */
export function requestedMaterials(text: string): MaterialType[] {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const clauses = normalized.split(/[.!?\n]/);
  const positive = clauses
    .map((clause) => {
      const instruction = clause.split(/\b(?:sem|exceto|menos|nao|evite)\b/)[0];
      const start = instruction.search(
        /\b(?:gere|gerar|crie|criar|produza|produzir|preciso de|quero|formatos?\s*:|materiais\s*:)/,
      );
      return start >= 0 ? instruction.slice(start) : "";
    })
    .join(" ");
  return (Object.keys(FORMAT_MENTIONS) as MaterialType[]).filter((type) =>
    FORMAT_MENTIONS[type].test(positive),
  );
}

const LEGACY_ERROR_TITLE = /não consegui gerar este (?:banner|e-mail)/i;
const LEGACY_ERROR_CAPTION = /não consegui gerar este post/i;

export function getGenerationErrorMessage(
  content: BuilderState,
): string | undefined {
  const explicit = content.generationError?.trim();
  if (explicit) return explicit;

  const legacyError =
    LEGACY_ERROR_TITLE.test(content.title ?? "") ||
    LEGACY_ERROR_CAPTION.test(content.caption ?? "");
  if (!legacyError) return undefined;

  return (
    content.body?.trim() ||
    content.subtitle?.trim() ||
    "A IA não conseguiu concluir esta peça agora. Tente novamente."
  );
}

export function getCampaignBrandName(
  assets: Pick<CampaignAsset, "content">[],
): string | undefined {
  return assets
    .map(({ content }) => content.brandName?.trim())
    .find((brandName): brandName is string => Boolean(brandName));
}

/**
 * Campanhas antigas nem sempre têm `brandName` no estado raiz. A origem mais
 * confiável é o plano aprovado e, em seguida, as peças já geradas.
 */
export function getBuilderCampaignBrandName(
  state: BuilderState | undefined,
): string | undefined {
  const rootBrand = state?.brandName?.trim();
  if (rootBrand) return rootBrand;

  const planBrand = state?.discoveryPlan?.brandName?.trim();
  if (planBrand) return planBrand;

  return getCampaignBrandName(state?.campaignAssets ?? []);
}
