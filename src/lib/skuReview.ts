import type { BuilderState, CampaignAsset } from "../types/builder";

export interface CatalogProduct {
  sku: string;
  name: string;
  priceCents: number;
  unit: string;
  source: string;
  imageUrl?: string;
  priorUnits?: string[];
  priorPrices?: number[];
  revision: string;
  updatedAt: string;
}

interface FieldException {
  text: string;
  offsets: number[];
}

export interface SkuLink {
  approved: CatalogProduct;
  previousPrices?: number[];
  previousUnits?: string[];
  exceptions?: Record<string, FieldException>;
}

export type ReviewDecision = "update" | "keep";
type Channel = CampaignAsset["type"] | "briefing";
interface Field {
  key: string;
  channel: Channel;
  label: string;
  text: string;
  sharedOffer: boolean;
}
export interface SkuMention extends Field {
  start: number;
  end: number;
  before: string;
  after: string;
  needsChoice: boolean;
  id: string;
}

const numberFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const formatPrice = (cents: number) =>
  "R$ " + numberFormat.format(cents / 100);

export function parsePrice(input: string) {
  const value = input.trim().replace(/^R\$\s*/i, "");
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replaceAll(".", "").split(",");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 99999999999
    ? cents
    : null;
}

const copyFields = new Set([
  "brandName",
  "title",
  "subtitle",
  "body",
  "cta",
  "caption",
  "hashtags",
  "hook",
  "keyBenefits",
  "objectionsHandled",
  "preheader",
  "footerText",
  "badgePrimary",
  "badgeSecondary",
  "heroBadge",
  "benefitTitle",
  "secondaryCta",
  "urgencyText",
  "testimonials",
  "footerInfo",
  "structuredContent",
]);
const briefFields = new Set([
  "offer",
  "confirmedFacts",
  "product",
  "productTitle",
  "productDescription",
  "detectedContext",
  "missingInfo",
  "proposedStrategy",
  "objective",
  "audience",
  "brandName",
  "tone",
]);
const labels: Record<string, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  body: "Texto",
  offer: "Oferta compartilhada",
  caption: "Legenda",
  preheader: "Prévia do e-mail",
  confirmedFacts: "Fatos confirmados",
  cta: "Chamada para ação",
  items: "Item",
  summary: "Resumo",
  heroBadge: "Destaque",
  keyBenefits: "Benefício",
  speakerNotes: "Notas",
  visualDirection: "Direção visual",
  detectedContext: "Contexto",
  proposedStrategy: "Estratégia",
  product: "Produto",
  productTitle: "Nome do produto",
  productDescription: "Descrição",
  sections: "Seção",
  hook: "Abertura",
  objective: "Objetivo",
  footerText: "Rodapé",
  disclaimer: "Observação",
  testimonials: "Depoimento",
  keywords: "Palavra-chave",
  hashtags: "Hashtag",
};

// The walker preserves identity for every untouched piece, and never visits URLs,
// image prompts, identifiers, styles or the audit data itself.
function mapFields(
  state: BuilderState,
  visit: (field: Field) => string,
): BuilderState {
  function walk(
    value: unknown,
    path: string[],
    owner: string,
    channel: Channel,
  ): unknown {
    if (typeof value === "string") {
      const label = path
        .filter((key) => key !== "structuredContent")
        .map((key) =>
          /^\d+$/.test(key) ? String(Number(key) + 1) : labels[key] || key,
        )
        .join(" · ");
      return visit({
        key: JSON.stringify([owner, ...path]),
        channel,
        label,
        text: value,
        sharedOffer: channel === "briefing" && path[0] === "offer",
      });
    }
    if (!value || typeof value !== "object") return value;
    let result: Record<string, unknown> | unknown[] | undefined;
    for (const [key, child] of Object.entries(value)) {
      if (key === "id" || key === "format") continue;
      const next = walk(child, [...path, key], owner, channel);
      if (next === child) continue;
      result ??= Array.isArray(value) ? [...value] : { ...value };
      if (Array.isArray(result)) result[Number(key)] = next;
      else result[key] = next;
    }
    return result ?? value;
  }
  function fields<T extends object>(
    value: T,
    allowed: Set<string>,
    owner: string,
    channel: Channel,
  ): T {
    let result = value;
    for (const [key, original] of Object.entries(value)) {
      if (!allowed.has(key)) continue;
      const next = walk(original, [key], owner, channel);
      if (next !== original) result = { ...result, [key]: next };
    }
    return result;
  }
  let output = state;
  if (
    state.type !== "campaign" &&
    state.type !== "none" &&
    state.type !== "discovery_plan"
  )
    output = fields(state, copyFields, "standalone", state.type);
  if (state.discoveryPlan) {
    const plan = fields(state.discoveryPlan, briefFields, "plan", "briefing");
    if (plan !== state.discoveryPlan)
      output = { ...output, discoveryPlan: plan };
  }
  if (state.campaignAssets) {
    const assets = state.campaignAssets.map((asset) => {
      const content = fields(
        asset.content,
        copyFields,
        "asset:" + asset.id,
        asset.type,
      );
      return content === asset.content ? asset : { ...asset, content };
    });
    if (assets.some((asset, i) => asset !== state.campaignAssets![i]))
      output = { ...output, campaignAssets: assets };
  }
  return output;
}

const amount =
  /(?<![\p{L}\p{N}_])(?:(R\$|BRL)([ \t\u00a0\u202f]*))?(?<![\d.,])(\d+(?:[.,]\d+)*)(?![\d]|[.,]\d)([ \t\u00a0\u202f]+reais\b)?(?![\p{L}\p{N}_])/giu;
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^\x24{}()|[\]\\]/g, "\\$&");

function fieldMentions(
  field: Field,
  link: SkuLink,
  product: CatalogProduct,
): SkuMention[] {
  const issues: SkuMention[] = [];
  const exception = link.exceptions?.[field.key];
  const ignore = exception?.text === field.text ? exception.offsets : [];
  const knownPrices = [
    link.approved.priceCents,
    ...(link.previousPrices ?? []),
    ...(product.priorPrices ?? []),
  ];
  const protectedSpans = [
    ...field.text.matchAll(/(?:https?:\/\/|www\.)\S+/giu),
  ];
  function add(
    start: number,
    before: string,
    after: string,
    needsChoice: boolean,
  ) {
    if (
      ignore.includes(start) ||
      protectedSpans.some(
        (url) => start >= url.index && start < url.index + url[0].length,
      )
    )
      return;
    issues.push({
      ...field,
      start,
      end: start + before.length,
      before,
      after,
      needsChoice,
      id: JSON.stringify([field.key, field.text, start, product.revision]),
    });
  }
  for (const match of field.text.matchAll(amount)) {
    const [token, prefix, space, value, suffix] = match;
    // Some imported copy uses a decimal point with an explicit BRL marker.
    const decimalPoint =
      Boolean(prefix || suffix) &&
      /^(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}$/.test(value);
    const cents = parsePrice(
      decimalPoint ? value.replaceAll(",", "").replace(".", ",") : value,
    );
    if (cents === null || cents === product.priceCents) continue;
    const context = field.text.slice(
      Math.max(0, match.index - 34),
      match.index,
    );
    if (!prefix && !suffix) {
      if (
        /(?:[$€£¥]|\b(?:USD|EUR|GBP|JPY))\s*$/i.test(context) ||
        /^\s*(?:[$€£¥]|\b(?:USD|EUR|GBP|JPY)\b)/i.test(
          field.text.slice(match.index + token.length),
        )
      )
        continue;
      if (
        !/,\d{2}$/.test(value) ||
        (!knownPrices.includes(cents) &&
          !/(?:por|custa|preço|valor|de)\s*$/i.test(context))
      )
        continue;
      if (
        /^\s*(?:%|kg\b|g\b|ml\b|l\b|cm\b|m\b|unidades?\b)/i.test(
          field.text.slice(match.index + token.length),
        )
      )
        continue;
    }
    const display = decimalPoint
      ? (product.priceCents / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : numberFormat.format(product.priceCents / 100);
    add(
      match.index,
      token,
      (prefix ? prefix + space : "") + display + (suffix || ""),
      !knownPrices.includes(cents) ||
        /(?:frete|parcela|desconto|cupom|economize|de)\s*(?:de\s*)?$/i.test(
          context,
        ),
    );
  }
  const units = [
    ...new Set([
      link.approved.unit,
      ...(link.previousUnits ?? []),
      ...(product.priorUnits ?? []),
    ]),
  ]
    .filter(
      (value) =>
        value &&
        value.toLocaleLowerCase("pt-BR") !==
          product.unit.toLocaleLowerCase("pt-BR"),
    )
    .sort((a, b) => b.length - a.length);
  if (units.length) {
    const pattern = units
      .map((unit) => unit.trim().split(/\s+/).map(escapeRegex).join("\\s*"))
      .join("|");
    const expression = new RegExp(
      "(?<![\\p{L}\\p{N},.])(?:" + pattern + ")(?![\\p{L}\\p{N}])",
      "giu",
    );
    for (const match of field.text.matchAll(expression)) {
      if (
        !issues.some(
          (issue) =>
            issue.start < match.index + match[0].length &&
            issue.end > match.index,
        )
      )
        add(match.index, match[0], product.unit, false);
    }
  }
  return issues.sort((a, b) => a.start - b.start);
}

export function reviewSku(
  state: BuilderState,
  product: CatalogProduct,
): SkuMention[] {
  const link = state.skuLink;
  if (!link || link.approved.sku !== product.sku) return [];
  const issues: SkuMention[] = [];
  mapFields(state, (field) => {
    issues.push(...fieldMentions(field, link, product));
    return field.text;
  });
  return issues;
}

export function affectsOutput(
  issue: SkuMention,
  channel: CampaignAsset["type"],
) {
  return (
    issue.channel === channel ||
    (issue.sharedOffer && (channel === "email" || channel === "social"))
  );
}

export function applySkuReview(
  state: BuilderState,
  product: CatalogProduct,
  decisions: Record<string, ReviewDecision>,
): BuilderState {
  const link = state.skuLink;
  if (!link || link.approved.sku !== product.sku)
    throw new Error("O SKU da campanha mudou. Abra a revisão novamente.");
  const exceptions: Record<string, FieldException> = {};
  const next = mapFields(state, (field) => {
    const issues = fieldMentions(field, link, product);
    const previous = link.exceptions?.[field.key];
    const offsets = previous?.text === field.text ? [...previous.offsets] : [];
    let output = "",
      cursor = 0;
    for (const issue of issues) {
      const decision =
        decisions[issue.id] ?? (issue.needsChoice ? undefined : "update");
      if (!decision)
        throw new Error(
          "Escolha como tratar cada valor que pode ter outra finalidade.",
        );
      output += field.text.slice(cursor, issue.start);
      if (decision === "keep") offsets.push(issue.start);
      output += decision === "keep" ? issue.before : issue.after;
      cursor = issue.end;
    }
    output += field.text.slice(cursor);
    if (offsets.length) {
      const newOffsets = offsets.map(
        (offset) =>
          offset +
          issues
            .filter(
              (issue) => issue.end <= offset && decisions[issue.id] !== "keep",
            )
            .reduce(
              (delta, issue) =>
                delta + issue.after.length - issue.before.length,
              0,
            ),
      );
      exceptions[field.key] = { text: output, offsets: newOffsets };
    }
    return output;
  });
  return {
    ...next,
    skuLink: {
      approved: product,
      previousPrices: [
        ...new Set([...(link.previousPrices ?? []), link.approved.priceCents]),
      ],
      previousUnits: [
        ...new Set([...(link.previousUnits ?? []), link.approved.unit]),
      ],
      exceptions,
    },
  };
}
