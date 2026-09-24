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
    claim: /\bexclusiv(?:o|a|os|as|idade|idades)\b/i,
    evidence: /\bexclusiv(?:o|a|os|as|idade|idades)\b/i,
  },
  {
    id: "unique",
    claim: /\b[uú]nic(?:o|a|os|as)\b/i,
    evidence: /\b[uú]nic(?:o|a|os|as)\b/i,
  },
  {
    id: "curated_for_you",
    claim:
      /\b(?:selecionad(?:o|a|os|as)|escolhid(?:o|a|os|as))\s+para\s+(?:voc[eê]|seu|sua)(?=\s|[.,!?;:]|$)/i,
    evidence:
      /\b(?:curadoria|selecionad(?:o|a|os|as)|escolhid(?:o|a|os|as)|personalizad(?:o|a|os|as))\b/i,
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
  {
    id: "artisanal_process",
    claim: /\bartesana(?:l|is|lmente|lidade|lidades)\b/i,
    evidence: /\bartesana(?:l|is|lmente|lidade|lidades)\b/i,
  },
  {
    id: "local_producers",
    claim: /\bprodutor(?:es)?\s+loca(?:l|is)\b/i,
    evidence: /\bprodutor(?:es)?\s+loca(?:l|is)\b/i,
  },
  {
    id: "production_process",
    claim:
      /\b(?:cultivad|colhid|torrad)(?:o|a|os|as)?\b|\bquem\s+(?:cultivou|colheu|torrou)\b/i,
    evidence:
      /\b(?:cultivad|colhid|torrad)(?:o|a|os|as)?\b|\bquem\s+(?:cultivou|colheu|torrou)\b/i,
  },
  {
    id: "point_of_sale",
    claim: /\bpontos?\s+de\s+venda\b/i,
    evidence: /\bpontos?\s+de\s+venda\b/i,
  },
  {
    id: "conscious_choice",
    claim: /\bescolha\s+consciente\b/i,
    evidence: /\bescolha\s+consciente\b/i,
  },
  {
    id: "physical_packaging",
    claim: /\bembalage(?:m|ns)\b/i,
    evidence: /\bembalage(?:m|ns)\b/i,
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

const COMMERCIAL_BANNER_IMAGE_SUFFIX =
  "premium commercial advertising key visual, disciplined editorial grid, one clear focal point, realistic scale, controlled studio lighting, crisp material detail, clean brand-led art direction, generous negative space for external copy, strong subject-background separation, polished campaign photography, thumbnail legibility, no abstract-only gradient background, no generic geometric-only composition, no clutter, no glassmorphism, no random decorative blobs, no excessive glow, no surreal floating objects, no text, no letters, no numbers, no logo, no visible watermark, no UI";

const LEGACY_DECORATIVE_SHAPES = new Set([
  "blob",
  "geometric",
  "arch",
  "wave",
  "pill",
  "offset",
]);

function collectConfirmedEvidence(brief: MarketingBrief): string {
  return [
    brief.brandName,
    brief.product,
    brief.audience,
    brief.objective,
    brief.offer,
    brief.tone,
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
  useFactualFallback = false,
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
  if (cleaned || !useFactualFallback) return cleaned;

  return (
    brief.productDescription?.trim() ||
    brief.productTitle?.trim() ||
    brief.product?.trim() ||
    ""
  );
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

function clipArtDirection(value: string, max = 360): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function bannerSubject(brief: MarketingBrief): string {
  return clipArtDirection(
    [
      brief.productTitle,
      brief.product,
      brief.productDescription,
      brief.objective,
      brief.context,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" && Boolean(value.trim()),
      )
      .join("; "),
    420,
  );
}

function enforceBannerImageDirection(
  value: unknown,
  brief: MarketingBrief,
): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const subject = bannerSubject(brief);
  const subjectDirection = subject
    ? `campaign subject and category context: ${subject}`
    : `campaign subject must visibly express the concrete business context instead of decorative abstraction`;
  const productDirection = brief.productImageUrl
    ? "generate background and supporting scene only, preserve a clean 48 to 55 percent visual zone for the real product cutout, do not invent, duplicate, redraw or replace the real product"
    : brief.product || brief.productTitle
      ? "show a concrete, recognizable category scene or product context tied directly to the campaign subject; use photorealistic commercial photography when the subject is physical; all visible products and packaging must be unbranded with completely blank surfaces; never invent a brand mark or label"
      : "show one concrete campaign scene, environment, object or visual metaphor tied directly to the message; never solve the brief with color gradients alone";

  const alreadyCommercial = raw.includes(
    "premium commercial advertising key visual",
  );
  const alreadyUnbranded = raw.includes(
    "unbranded with completely blank surfaces",
  );
  if (alreadyCommercial && (brief.productImageUrl || alreadyUnbranded)) {
    return raw;
  }

  return [
    raw,
    subjectDirection,
    productDirection,
    COMMERCIAL_BANNER_IMAGE_SUFFIX,
  ]
    .filter(Boolean)
    .join(", ");
}

function normalizeComparableText(value: unknown): string {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    : "";
}

function repairBrandOnlyHeadline(
  copy: Record<string, unknown>,
  brief: MarketingBrief,
): void {
  const headline = normalizeComparableText(copy.headline);
  const brand = normalizeComparableText(brief.brandName);
  if (!headline || !brand || headline !== brand) return;

  const product = brief.productTitle?.trim() || brief.product?.trim();
  if (product) {
    copy.headline = repairFragmentedHeadline(product).slice(0, 58);
    return;
  }

  const objective = brief.objective?.trim();
  if (objective) {
    const candidate = objective
      .replace(/^(?:criar|gerar|divulgar|apresentar|promover)\s+/i, "")
      .split(/[.!?]/)[0]
      .trim();
    if (candidate) copy.headline = candidate.slice(0, 58);
  }
}

function enforceBannerComposition(
  copy: Record<string, unknown>,
  brief: MarketingBrief,
): void {
  copy.imagePrompt = enforceBannerImageDirection(copy.imagePrompt, brief);
  repairBrandOnlyHeadline(copy, brief);

  if (brief.productImageUrl && copy.layoutStyle === "centered") {
    copy.layoutStyle = "split";
  }

  if (LEGACY_DECORATIVE_SHAPES.has(String(copy.backgroundShape ?? ""))) {
    copy.backgroundShape = "minimalist";
  }

  if (!copy.backgroundShape) copy.backgroundShape = "minimalist";

  const hasConfirmedOffer = Boolean(brief.offer?.trim());
  if (!hasConfirmedOffer) {
    copy.badgePrimary = "";
    copy.badgeSecondary = "";
  }
}

export function sanitizeGeneratedCopy<T extends MaterialType>(
  material: T,
  copy: GeneratedCopyByMaterial[T],
  brief: MarketingBrief,
): GeneratedCopyByMaterial[T] {
  const sanitized = { ...copy } as Record<string, unknown>;
  const isStructured = !["banner", "email", "social"].includes(material);

  const headlineKeys =
    material === "banner"
      ? ["headline", "subheadline"]
      : material === "email"
        ? ["subject", "headline", "subtitle"]
        : material === "social"
          ? ["hook"]
          : ["title", "subtitle"];
  for (const key of headlineKeys) {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = repairFragmentedHeadline(sanitized[key]);
    }
  }

  if (typeof sanitized.body === "string") {
    sanitized.body = removeUnsupportedSentences(sanitized.body, brief, true);
  }
  if (typeof sanitized.summary === "string") {
    sanitized.summary = removeUnsupportedSentences(sanitized.summary, brief);
  }

  filterUnsupportedLists(
    sanitized,
    ["keyBenefits", "objectionsHandled", "testimonials"],
    brief,
  );

  if (isStructured && Array.isArray(sanitized.sections)) {
    sanitized.sections = sanitized.sections.map((rawSection) => {
      if (!rawSection || typeof rawSection !== "object") return rawSection;
      const section = { ...(rawSection as Record<string, unknown>) };
      if (typeof section.title === "string") {
        section.title = repairFragmentedHeadline(section.title);
      }
      for (const key of ["body", "visualDirection", "speakerNotes"] as const) {
        if (typeof section[key] === "string") {
          section[key] = removeUnsupportedSentences(section[key], brief);
        }
      }
      if (Array.isArray(section.items)) {
        section.items = section.items.filter(
          (item) =>
            typeof item !== "string" ||
            findUnsupportedClaims(item, brief).length === 0,
        );
      }
      return section;
    });
    clearUnsupportedOptionalFields(
      sanitized,
      ["subtitle", "summary", "cta", "disclaimer"],
      brief,
    );
  } else if (material === "banner") {
    clearUnsupportedOptionalFields(
      sanitized,
      ["subheadline", "footerInfo", "badgePrimary", "badgeSecondary"],
      brief,
    );
    enforceBannerComposition(sanitized, brief);
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
