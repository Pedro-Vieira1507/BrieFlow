import type { MarketingBrief, MaterialType } from "../types/brief";
import type { BuilderState, CampaignAsset } from "../types/builder";
import { findUnsupportedClaims } from "./marketingQuality.ts";

export interface EditorialIssue {
  code: string;
  severity: "attention" | "blocking";
  message: string;
  excerpt?: string;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const GENERIC_COPY =
  /(?:eleve (?:seu|sua)|proximo nivel|experiencia unica|solucao inovadora|descubra o poder|transforme sua jornada|qualidade e inovacao)/;
const PLACEHOLDER =
  /(?:\[(?:inserir|nome|produto|marca|link)[^\]]*\]|lorem ipsum|sua marca|nao informad[oa]|sem oferta definida)/;

function repeatsSupportingCopy(subtitle: string, body: string): boolean {
  const words = (value: string) =>
    new Set(
      normalize(value)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 2 &&
            !["com", "para", "por", "uma", "seu", "sua"].includes(word),
        ),
    );
  const first = words(subtitle);
  const second = words(body);
  if (Math.min(first.size, second.size) < 4) return false;
  const shared = [...first].filter((word) => second.has(word)).length;
  return shared / new Set([...first, ...second]).size >= 0.8;
}

/** Checks visible copy only. This is a review aid, never a quality score or factual certification. */
export function reviewEditorialContent(
  material: MaterialType,
  content: BuilderState,
  brief: MarketingBrief,
  siblings: CampaignAsset[] = [],
): EditorialIssue[] {
  if (content.generationError)
    return [
      {
        code: "generation_failed",
        severity: "blocking",
        message:
          "Esta peça não terminou de gerar. Tente novamente antes de exportar.",
      },
    ];
  const document = content.structuredContent;
  const title = document?.title || content.title || content.hook || "";
  const visibleText = [
    title,
    content.subtitle,
    content.body,
    content.caption,
    content.cta,
    content.preheader,
    content.footerInfo,
    content.badgePrimary,
    content.badgeSecondary,
    ...(content.keyBenefits || []),
    ...(content.testimonials || []),
    document?.subtitle,
    document?.summary,
    document?.cta,
    ...(document?.sections.flatMap((section) => [
      section.title,
      section.body,
      ...(section.items || []),
    ]) || []),
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  const issues: EditorialIssue[] = [];
  if (!title.trim())
    issues.push({
      code: "missing_title",
      severity: "blocking",
      message: "Defina uma mensagem principal para a peça.",
    });
  if (PLACEHOLDER.test(normalize(visibleText)))
    issues.push({
      code: "placeholder",
      severity: "blocking",
      message: "Substitua os campos provisórios antes de publicar.",
    });
  if (GENERIC_COPY.test(normalize(visibleText)))
    issues.push({
      code: "generic_copy",
      severity: "attention",
      message:
        "Troque a frase genérica por uma ideia ligada ao produto e ao público.",
    });
  if (
    material === "banner" &&
    repeatsSupportingCopy(content.subtitle || "", content.body || "")
  )
    issues.push({
      code: "repeated_supporting_copy",
      severity: "attention",
      message:
        "O subtítulo e o texto de apoio repetem a mesma informação. Enxugue ou acrescente um detalhe confirmado.",
    });
  if (findUnsupportedClaims(visibleText, brief).length)
    issues.push({
      code: "unsupported_claim",
      severity: "attention",
      message:
        "Há uma alegação sem apoio no briefing. Confirme a fonte ou reformule.",
    });

  // Compare complete quantities, not isolated digits: 15% never substantiates 50%.
  const quantities = (text: string) =>
    [
      ...text.matchAll(
        /(?:R\$\s*\d[\d.,]*|\d[\d.,]*\s*(?:%|rpm|[kKmM]?[wW]|[mM]?[lL]|[kK]?[gG]|[mM]?[mM]|[vV]|°\s*[cC]))(?![\p{L}\d])/gu,
      ),
    ].map((match) => normalize(match[0]).replace(/\s/g, ""));
  const evidence = [
    brief.brandName,
    brief.product,
    brief.productTitle,
    brief.productDescription,
    brief.offer,
    brief.context,
    brief.site?.title,
    brief.site?.description,
    ...(brief.site?.headings || []),
  ]
    .filter(Boolean)
    .join("\n");
  const known = new Set(quantities(evidence));
  const unknown = [...new Set(quantities(visibleText))].filter(
    (value) => !known.has(value),
  );
  if (unknown.length)
    issues.push({
      code: "unverified_quantity",
      severity: "attention",
      message: "Confira os valores e especificações com a fonte original.",
      excerpt: unknown.slice(0, 5).join(" · "),
    });
  if (material === "banner" && title.length > 70)
    issues.push({
      code: "long_headline",
      severity: "attention",
      message: "Encurte a chamada para facilitar a leitura no celular.",
    });
  if (material !== "technical_sheet" && !(document?.cta || content.cta)?.trim())
    issues.push({
      code: "missing_cta",
      severity: "attention",
      message: "Inclua uma próxima ação clara para o público.",
    });
  if (
    document?.sections.some(
      (section) =>
        !section.body.trim() && !section.items?.some((item) => item.trim()),
    )
  )
    issues.push({
      code: "empty_section",
      severity: "blocking",
      message: "Complete ou remova as seções sem conteúdo.",
    });
  if (
    title &&
    siblings.some(
      (asset) =>
        asset.type !== material &&
        normalize(
          asset.content.title ||
            asset.content.hook ||
            asset.content.structuredContent?.title ||
            "",
        ) === normalize(title),
    )
  )
    issues.push({
      code: "repeated_headline",
      severity: "attention",
      message: "Adapte a abertura ao canal; outra peça usa a mesma chamada.",
    });
  return issues;
}
