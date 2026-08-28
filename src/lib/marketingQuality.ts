import type { MarketingBrief, MaterialType } from "../types/brief";
import type { GeneratedCopyByMaterial } from "../types/generatedContent";

interface ClaimRule {
  id: string;
  claim: RegExp;
  evidence: RegExp;
}

const CLAIM_RULES: ClaimRule[] = [
  {
    id: "automatic",
    claim: /\bautom[aá]tic(?:o|a|os|as|amente)\b/i,
    evidence: /\bautom[aá]tic(?:o|a|os|as|amente)\b/i,
  },
  {
    id: "exclusive",
    claim: /\bexclusiv(?:o|a|os|as)\b/i,
    evidence: /\bexclusiv(?:o|a|os|as)\b/i,
  },
  {
    id: "unique",
    claim: /\b[uú]nic(?:o|a|os|as)\b/i,
    evidence: /\b[uú]nic(?:o|a|os|as)\b/i,
  },
  {
    id: "leader",
    claim: /\bl[ií]der(?:es)?\b/i,
    evidence: /\bl[ií]der(?:es)?\b/i,
  },
  {
    id: "certified",
    claim: /\bcertificad(?:o|a|os|as)\b/i,
    evidence: /\bcertificad(?:o|a|os|as)\b/i,
  },
  {
    id: "proven",
    claim: /\bcomprovad(?:o|a|os|as)\b/i,
    evidence: /\bcomprovad(?:o|a|os|as)\b/i,
  },
  {
    id: "award",
    claim: /\bpremiad(?:o|a|os|as)\b/i,
    evidence: /\bpremiad(?:o|a|os|as)\b/i,
  },
  {
    id: "guarantee",
    claim: /\b(?:garantia|garantid(?:o|a|os|as)|garantimos)\b/i,
    evidence: /\b(?:garantia|garantid(?:o|a|os|as)|garantimos)\b/i,
  },
  { id: "coupon", claim: /\bcupons?\b/i, evidence: /\bcupons?\b/i },
  {
    id: "checkout",
    claim: /\bcheckout\b/i,
    evidence: /\bcheckout\b/i,
  },
  {
    id: "contracting",
    claim: /\b(?:contrata(?:ção|r)|ades[aã]o)\b/i,
    evidence: /\b(?:contrata(?:ção|r)|ades[aã]o)\b/i,
  },
  {
    id: "billing",
    claim: /\b(?:cobrança|mensalidade)\b/i,
    evidence: /\b(?:cobrança|mensalidade)\b/i,
  },
  {
    id: "renewal",
    claim: /\brenova(?:ção|r)\b/i,
    evidence: /\brenova(?:ção|r)\b/i,
  },
  {
    id: "commitment",
    claim: /\b(?:fidelidade|cancelamento|elegibilidade)\b/i,
    evidence: /\b(?:fidelidade|cancelamento|elegibilidade)\b/i,
  },
  { id: "plan", claim: /\bplanos?\b/i, evidence: /\bplanos?\b/i },
  { id: "shipping", claim: /\bfrete\b/i, evidence: /\bfrete\b/i },
  {
    id: "free",
    claim: /\b(?:gr[aá]tis|gratuit(?:o|a|os|as))\b/i,
    evidence: /\b(?:gr[aá]tis|gratuit(?:o|a|os|as))\b/i,
  },
  {
    id: "scarcity",
    claim:
      /\b(?:[uú]ltimas? unidades?|estoque limitado|por tempo limitado|s[oó] hoje)\b/i,
    evidence:
      /\b(?:[uú]ltimas? unidades?|estoque limitado|por tempo limitado|s[oó] hoje)\b/i,
  },
];

const STOP_WORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "seu",
  "sua",
  "um",
  "uma",
]);

function collectConfirmedEvidence(brief: MarketingBrief): string {
  return [
    brief.brandName,
    brief.product,
    brief.audience,
    brief.objective,
    brief.offer,
    brief.tone,
    brief.strategy,
    brief.context,
    brief.productTitle,
    brief.productDescription,
    brief.site?.title,
    brief.site?.description,
    brief.site?.keywords,
    ...(brief.site?.headings ?? []),
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && Boolean(value.trim()),
    )
    .join(" \n ");
}

export function findUnsupportedClaims(
  value: string,
  brief: MarketingBrief,
): string[] {
  if (!value.trim()) return [];
  const evidence = collectConfirmedEvidence(brief);
  return CLAIM_RULES.filter(
    (rule) => rule.claim.test(value) && !rule.evidence.test(evidence),
  ).map((rule) => rule.id);
}

function removeUnsupportedSentences(
  value: string,
  brief: MarketingBrief,
): string {
  const paragraphs = value.split(/\n{2,}/);
  const safeParagraphs = paragraphs
    .map((paragraph) =>
      paragraph
        .split(/(?<=[.!?])\s+/)
        .filter(
          (sentence) => findUnsupportedClaims(sentence, brief).length === 0,
        )
        .join(" ")
        .trim(),
    )
    .filter(Boolean);

  const cleaned = safeParagraphs.join("\n\n").trim();
  return cleaned || value;
}

function repairFragmentedHeadline(value: string): string {
  return value
    .replace(
      /:\s+(?=(?:de|da|do|dos|das|para|por|com|em|na|no|nas|nos)\b)/gi,
      " ",
    )
    .replace(/:\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9%\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function dedupeSocialCallToAction(body: string, cta: string): string {
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);
  if (paragraphs.length < 2 || !cta.trim()) return body;

  const lastTokens = meaningfulTokens(paragraphs.at(-1) ?? "");
  const ctaTokens = meaningfulTokens(cta);
  if (lastTokens.size === 0 || ctaTokens.size === 0) return body;

  const overlap = [...lastTokens].filter((token) =>
    ctaTokens.has(token),
  ).length;
  const similarity = overlap / Math.min(lastTokens.size, ctaTokens.size);
  if (similarity < 0.5) return body;

  return paragraphs.slice(0, -1).join("\n\n").trim();
}

function clearUnsupportedOptionalFields(
  copy: Record<string, unknown>,
  keys: string[],
  brief: MarketingBrief,
): void {
  for (const key of keys) {
    const value = copy[key];
    if (
      typeof value === "string" &&
      findUnsupportedClaims(value, brief).length > 0
    ) {
      copy[key] = "";
    }
  }
}

function filterUnsupportedLists(
  copy: Record<string, unknown>,
  keys: string[],
  brief: MarketingBrief,
): void {
  for (const key of keys) {
    if (!Array.isArray(copy[key])) continue;
    copy[key] = (copy[key] as unknown[]).filter(
      (item) =>
        typeof item !== "string" ||
        findUnsupportedClaims(item, brief).length === 0,
    );
  }
}

export function sanitizeGeneratedCopy<T extends MaterialType>(
  material: T,
  copy: GeneratedCopyByMaterial[T],
  brief: MarketingBrief,
): GeneratedCopyByMaterial[T] {
  const sanitized = { ...copy } as Record<string, unknown>;

  const headlineKeys =
    material === "banner"
      ? ["headline", "subheadline"]
      : material === "email"
        ? ["subject", "headline", "subtitle"]
        : ["hook"];
  for (const key of headlineKeys) {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = repairFragmentedHeadline(sanitized[key]);
    }
  }

  if (typeof sanitized.body === "string") {
    sanitized.body = removeUnsupportedSentences(sanitized.body, brief);
  }

  filterUnsupportedLists(
    sanitized,
    ["keyBenefits", "objectionsHandled", "testimonials"],
    brief,
  );

  if (material === "banner") {
    clearUnsupportedOptionalFields(
      sanitized,
      ["subheadline", "footerInfo", "badgePrimary", "badgeSecondary"],
      brief,
    );
  } else if (material === "email") {
    clearUnsupportedOptionalFields(
      sanitized,
      [
        "preheader",
        "headline",
        "subtitle",
        "heroBadge",
        "benefitTitle",
        "secondaryCta",
        "urgencyText",
        "footerInfo",
      ],
      brief,
    );
  } else {
    const body = typeof sanitized.body === "string" ? sanitized.body : "";
    const cta = typeof sanitized.cta === "string" ? sanitized.cta : "";
    sanitized.body = dedupeSocialCallToAction(body, cta);
  }

  return sanitized as GeneratedCopyByMaterial[T];
}
