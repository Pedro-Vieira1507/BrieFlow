// src/types/brief.ts
//
// Fonte única de verdade do BRIEF tipado usado pela camada de geração.
//
// Decisão de arquitetura: o estado do app (BrandContext + DiscoveryPlan) é
// "cru" e cresce com o produto. Os prompts, porém, precisam de um objeto
// estável e previsível. Por isso existe o `MarketingBrief`: um DTO puro,
// derivado do estado via `toMarketingBrief()`, que é a ÚNICA entrada das
// funções de prompt em `src/lib/marketingPrompts.ts`.

import type { BrandContext, DiscoveryPlan, SiteBrandData } from "./builder";

/** Canais suportados pelas variações de prompt. */
export type MarketingChannel =
  | "landing"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "email"
  | "whatsapp"
  | "generic";

/** Tipos de peça que o builder renderiza hoje. */
export type MaterialType = "banner" | "social" | "email";

/**
 * Referência de produto usada para ancorar a copy em algo concreto.
 *
 * ROADMAP (onde plugar no futuro):
 * 1. `link preview`: um server fn que recebe `productUrl` e extrai
 *    og:image -> `productImageUrl`, og:title -> `productTitle`,
 *    og:description -> `productDescription`.
 *    (já existe base em `src/lib/scrape-site.ts` -> `scrapeProductByUrlFn`)
 * 2. `upload manual`: o usuário envia um arquivo; após subir para o storage,
 *    grave a URL pública em `productImageUrl` e mantenha os demais campos
 *    preenchidos manualmente pelo usuário.
 *
 * Nenhum campo é obrigatório: a geração funciona sem produto e apenas
 * enriquece o prompt quando os dados existem.
 */
export interface ProductReference {
  /** URL da página do produto (fonte para o futuro link preview). */
  productUrl?: string | null;
  /** URL da imagem do produto (og:image hoje, upload no futuro). */
  productImageUrl?: string | null;
  /** Nome/título do produto conforme a página ou o usuário. */
  productTitle?: string | null;
  /** Descrição curta do produto (og:description ou copy da página). */
  productDescription?: string | null;
}

/** Brief tipado e normalizado que alimenta todos os prompts. */
export interface MarketingBrief extends ProductReference {
  brandName: string;
  /** Objetivo da campanha (ex.: gerar leads, vender, lançar). */
  objective?: string | null;
  /** Contexto literal capturado do cliente (exigências palavra por palavra). */
  context?: string | null;
  /** Estratégia proposta na fase de discovery. */
  strategy?: string | null;
  /** O que ainda falta descobrir. */
  missingInfo?: string | null;
  audience?: string | null;
  product?: string | null;
  /** Oferta/cupom já higienizado. `null` = não existe oferta. */
  offer?: string | null;
  tone?: string | null;
  framework?: string | null;
  channels?: MarketingChannel[];
  /** Dados extraídos do site da marca, quando houver. */
  site?: SiteBrandData | null;
  /** Imagens adicionais disponíveis (uploads + scraping). */
  availableImageUrls?: string[];
}

/** `true` quando há informação de produto suficiente para ancorar a copy. */
export function hasProductContext(brief: MarketingBrief): boolean {
  return Boolean(
    brief.productImageUrl ||
      brief.productTitle ||
      brief.productDescription ||
      brief.productUrl,
  );
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Converte o estado do app no brief tipado. Função pura: nada de store,
 * nada de fetch — facilita testar prompts isoladamente.
 */
export function toMarketingBrief(input: {
  brandContext: BrandContext;
  plan?: DiscoveryPlan;
  product?: ProductReference;
  availableImageUrls?: string[];
  channels?: MarketingChannel[];
}): MarketingBrief {
  const { brandContext, plan, product, availableImageUrls, channels } = input;

  return {
    brandName:
      clean(plan?.brandName) ??
      clean(brandContext.brandName) ??
      clean(brandContext.site?.brandName) ??
      "Sua Marca",
    objective: clean(plan?.proposedStrategy),
    context: clean(plan?.detectedContext),
    strategy: clean(plan?.proposedStrategy),
    missingInfo: clean(plan?.missingInfo),
    audience: clean(plan?.audience) ?? clean(brandContext.persona),
    product: clean(plan?.product) ?? clean(brandContext.product),
    offer: clean(plan?.offer) ?? clean(brandContext.offer),
    tone: clean(brandContext.tone),
    framework: clean(brandContext.framework),
    channels,
    site: brandContext.site ?? null,
    availableImageUrls: availableImageUrls ?? [],
    productUrl: clean(product?.productUrl) ?? clean(plan?.productUrl),
    productImageUrl:
      clean(product?.productImageUrl) ?? clean(plan?.productImageUrl),
    productTitle: clean(product?.productTitle) ?? clean(plan?.productTitle),
    productDescription:
      clean(product?.productDescription) ?? clean(plan?.productDescription),
  };
}
