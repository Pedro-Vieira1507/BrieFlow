import { MATERIAL_TYPES, type MaterialType } from "../types/brief.ts";

export const PLAN_IDS = [
  "free",
  "basic",
  "pro",
  "agency",
  "enterprise",
] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export interface ContentFormatDefinition {
  label: string;
  shortLabel: string;
  description: string;
  prompt: string;
  creditCost: number;
  minPlan: PlanId;
  category: "design" | "social" | "audiovisual" | "document";
}

export const CONTENT_FORMATS: Record<MaterialType, ContentFormatDefinition> = {
  banner: {
    label: "Banner",
    shortLabel: "Banner",
    description: "Peça visual editável para campanhas e landing pages.",
    prompt: "Gere apenas um banner para esta campanha.",
    creditCost: 3,
    minPlan: "free",
    category: "design",
  },
  email: {
    label: "E-mail marketing",
    shortLabel: "E-mail",
    description: "Assunto, preheader, corpo, CTA e HTML exportável.",
    prompt: "Gere apenas um e-mail marketing para esta campanha.",
    creditCost: 3,
    minPlan: "free",
    category: "design",
  },
  social: {
    label: "Post social",
    shortLabel: "Social",
    description: "Arte 4:5, legenda, CTA e hashtags.",
    prompt: "Gere apenas um post social para esta campanha.",
    creditCost: 2,
    minPlan: "free",
    category: "social",
  },
  whatsapp: {
    label: "Mensagem para WhatsApp",
    shortLabel: "WhatsApp",
    description: "Mensagem curta e contextual com uma única ação.",
    prompt: "Gere apenas uma mensagem de WhatsApp para esta campanha.",
    creditCost: 2,
    minPlan: "basic",
    category: "social",
  },
  technical_sheet: {
    label: "Ficha técnica",
    shortLabel: "Ficha técnica",
    description: "Especificações, aplicações, benefícios e cuidados factuais.",
    prompt: "Gere apenas uma ficha técnica profissional para esta campanha.",
    creditCost: 4,
    minPlan: "basic",
    category: "document",
  },
  blog: {
    label: "Artigo para blog",
    shortLabel: "Blog",
    description: "Estrutura SEO, seções, meta description e CTA.",
    prompt: "Gere apenas um artigo de blog completo para esta campanha.",
    creditCost: 4,
    minPlan: "basic",
    category: "document",
  },
  reel: {
    label: "Roteiro de Reel",
    shortLabel: "Reel",
    description: "Cenas, gancho, locução, texto em tela e timing vertical.",
    prompt: "Gere apenas um roteiro de Reel vertical para esta campanha.",
    creditCost: 6,
    minPlan: "pro",
    category: "audiovisual",
  },
  video: {
    label: "Roteiro de vídeo",
    shortLabel: "Vídeo",
    description: "Roteiro audiovisual com cenas, locução e direção visual.",
    prompt: "Gere apenas um roteiro de vídeo para esta campanha.",
    creditCost: 10,
    minPlan: "pro",
    category: "audiovisual",
  },
  slides: {
    label: "Apresentação em slides",
    shortLabel: "Slides",
    description: "Narrativa de apresentação, conteúdo e notas por slide.",
    prompt: "Gere apenas uma apresentação em slides para esta campanha.",
    creditCost: 8,
    minPlan: "pro",
    category: "document",
  },
  podcast: {
    label: "Roteiro de podcast",
    shortLabel: "Podcast",
    description: "Pauta, abertura, blocos, roteiro do host e show notes.",
    prompt: "Gere apenas um roteiro de podcast para esta campanha.",
    creditCost: 12,
    minPlan: "agency",
    category: "audiovisual",
  },
};

export interface PlanDefinition {
  label: string;
  monthlyCredits: number;
  maxMembers: number;
  maxSavedAssets: number;
  allowedFormats: readonly MaterialType[];
}

const FREE_FORMATS: readonly MaterialType[] = ["banner", "email", "social"];
const BASIC_FORMATS: readonly MaterialType[] = [
  ...FREE_FORMATS,
  "technical_sheet",
  "blog",
  "whatsapp",
];
const PRO_FORMATS: readonly MaterialType[] = [
  ...BASIC_FORMATS,
  "reel",
  "video",
  "slides",
];

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  free: {
    label: "Gratuito",
    monthlyCredits: 20,
    maxMembers: 1,
    maxSavedAssets: 20,
    allowedFormats: FREE_FORMATS,
  },
  basic: {
    label: "Básico",
    monthlyCredits: 150,
    maxMembers: 1,
    maxSavedAssets: 250,
    allowedFormats: BASIC_FORMATS,
  },
  pro: {
    label: "Pro",
    monthlyCredits: 600,
    maxMembers: 5,
    maxSavedAssets: 2_000,
    allowedFormats: PRO_FORMATS,
  },
  agency: {
    label: "Agência",
    monthlyCredits: 2_500,
    maxMembers: 25,
    maxSavedAssets: 10_000,
    allowedFormats: MATERIAL_TYPES,
  },
  enterprise: {
    label: "Enterprise",
    monthlyCredits: 10_000,
    maxMembers: 250,
    maxSavedAssets: 100_000,
    allowedFormats: MATERIAL_TYPES,
  },
};

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  agency: 3,
  enterprise: 4,
};

export function isPlanId(value: unknown): value is PlanId {
  return (
    typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value)
  );
}

export function normalizePlanId(value: unknown): PlanId {
  return isPlanId(value) ? value : "free";
}

export function canUseMaterial(
  plan: PlanId | null | undefined,
  material: MaterialType,
  serverAllowedFormats?: readonly string[],
): boolean {
  if (serverAllowedFormats) return serverAllowedFormats.includes(material);
  return PLAN_CATALOG[plan ?? "free"].allowedFormats.includes(material);
}

export function planMeetsMinimum(
  plan: PlanId | null | undefined,
  minimum: PlanId,
): boolean {
  return PLAN_RANK[plan ?? "free"] >= PLAN_RANK[minimum];
}
