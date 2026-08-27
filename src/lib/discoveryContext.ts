import type { DiscoveryPlan } from "@/types/builder";

export type DetectedBriefContext = Record<string, string | null | undefined>;

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

/**
 * Mantém os fatos extraídos no briefing tipado. O modelo frequentemente
 * preenche `detectedContext` corretamente, mas omite a duplicação dos mesmos
 * campos dentro de `builder.discoveryPlan`; sem esta ponte a geração seguinte
 * perde marca, produto e oferta e cai em "Sua Marca".
 */
export function mergeDetectedBriefContext(
  plan: DiscoveryPlan | undefined,
  detected: DetectedBriefContext | undefined,
): DiscoveryPlan {
  const base: DiscoveryPlan = plan ?? {
    detectedContext: "",
    missingInfo: "",
    proposedStrategy: "",
  };

  if (!detected) return base;

  const brandName = clean(detected.brandName);
  const product = clean(detected.productName) ?? clean(detected.product);
  const productSku = clean(detected.productSku);
  const productUrl = clean(detected.productUrl);
  const offer = clean(detected.offer);
  const audience = clean(detected.audience);
  const tone = clean(detected.tone);
  const objective = clean(detected.objective);

  const facts = [
    brandName && `Marca: ${brandName}`,
    product && `Produto/serviço: ${product}`,
    offer && `Oferta: ${offer}`,
    audience && `Público: ${audience}`,
    tone && `Tom: ${tone}`,
    objective && `Objetivo: ${objective}`,
  ].filter((value): value is string => Boolean(value));

  return {
    ...base,
    ...(brandName ? { brandName } : {}),
    ...(product ? { product } : {}),
    ...(productSku ? { productSku } : {}),
    ...(productUrl ? { productUrl } : {}),
    ...(offer ? { offer } : {}),
    ...(audience ? { audience } : {}),
    ...(tone ? { tone } : {}),
    ...(objective ? { objective } : {}),
    detectedContext: clean(base.detectedContext) ?? facts.join("\n"),
  };
}
