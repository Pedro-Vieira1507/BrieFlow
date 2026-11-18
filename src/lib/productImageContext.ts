import type { DiscoveryPlan } from "@/types/builder";

export const PRODUCT_IMAGE_CONTEXT_MARKER =
  "Foto real do produto anexada pelo usuário e disponível como imagem principal no BrieFlow.";

export const PRODUCT_IMAGE_REQUEST_PATTERN =
  /(?:(?:foto|imagem)(?:\s+real|\s+oficial)?(?:\s+do|\s+da)?\s+(?:produto|equipamento)|(?:produto|equipamento|centr[ií]fuga|microcentr[ií]fuga|micropipeta).{0,100}(?:foto|imagem)|(?:envie|enviar|envia|anexe|anexar|anexa|mande|mandar|receber).{0,120}(?:foto|imagem)|(?:foto|imagem).{0,160}(?:envie|enviar|anexe|anexar|mande|mandar|receber)|(?:preciso|precisamos|necess[aá]rio|necess[aá]ria|poderia|pode).{0,100}(?:receber|ter|obter|usar).{0,100}(?:foto|imagem))/i;

export function asksForProductImage(value: string | null | undefined): boolean {
  return PRODUCT_IMAGE_REQUEST_PATTERN.test(value ?? "");
}

export function withAttachedProductImage(
  plan: DiscoveryPlan | undefined,
  imageUrl: string | null | undefined,
): DiscoveryPlan | undefined {
  if (!imageUrl) return plan;
  const base = plan ?? {
    detectedContext: "",
    missingInfo: "",
    proposedStrategy: "",
  };

  const detectedContext = base.detectedContext?.includes(
    PRODUCT_IMAGE_CONTEXT_MARKER,
  )
    ? base.detectedContext
    : [base.detectedContext, PRODUCT_IMAGE_CONTEXT_MARKER]
        .filter(Boolean)
        .join("\n");

  return {
    ...base,
    productImageUrl: imageUrl,
    detectedContext,
    missingInfo: asksForProductImage(base.missingInfo) ? "" : base.missingInfo,
  };
}
