import type { DiscoveryPlan } from "@/types/builder";

export type DetectedBriefContext = Record<string, string | null | undefined>;

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

const DERIVED_CLAIM_RULES = [
  /\bexclusiv(?:o|a|os|as|idade|idades)\b/i,
  /\b[uú]nic(?:o|a|os|as)\b/i,
  /\bl[ií]der(?:es)?\b/i,
  /\bsuperior(?:es)?\b/i,
  /\bmelhor(?:es)?\b/i,
  /\bpersonalizad(?:o|a|os|as)\b/i,
  /\bcomprovad(?:o|a|os|as)\b/i,
  /\bgarantid(?:o|a|os|as)\b/i,
];

export function sanitizeDiscoveryStrategy(
  strategy: string,
  confirmedFacts: string,
): string {
  const evidence = confirmedFacts.trim();
  const safeClauses = strategy
    .split(/\s*;\s*/)
    .map((clause) => {
      let cleaned = clause;
      for (const rule of DERIVED_CLAIM_RULES) {
        if (rule.test(cleaned) && !rule.test(evidence)) {
          cleaned = cleaned.replace(new RegExp(rule.source, "gi"), "");
        }
      }

      return cleaned
        .replace(/\b(?:e|ou)\s*$/i, "")
        .replace(/:\s*$/, "")
        .replace(/\s+([,.:])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
    })
    .filter(Boolean);

  return safeClauses.join("; ");
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

  const brandName = clean(detected?.brandName) ?? clean(base.brandName);
  const product =
    clean(detected?.productName) ??
    clean(detected?.product) ??
    clean(base.product);
  const productSku = clean(detected?.productSku) ?? clean(base.productSku);
  const productUrl = clean(detected?.productUrl) ?? clean(base.productUrl);
  const offer = clean(detected?.offer) ?? clean(base.offer);
  const audience = clean(detected?.audience) ?? clean(base.audience);
  const tone = clean(detected?.tone) ?? clean(base.tone);
  const objective = clean(detected?.objective) ?? clean(base.objective);

  const facts = [
    brandName && `Marca: ${brandName}`,
    product && `Produto/serviço: ${product}`,
    offer && `Oferta: ${offer}`,
    audience && `Público: ${audience}`,
    tone && `Tom: ${tone}`,
    objective && `Objetivo: ${objective}`,
  ].filter((value): value is string => Boolean(value));

  const confirmedFacts = facts.join("\n");

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
    detectedContext: clean(base.detectedContext) ?? confirmedFacts,
    proposedStrategy: sanitizeDiscoveryStrategy(
      base.proposedStrategy,
      confirmedFacts,
    ),
  };
}
