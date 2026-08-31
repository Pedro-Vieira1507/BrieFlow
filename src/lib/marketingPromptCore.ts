import type { MaterialType } from "../types/brief";

export interface PromptPalette {
  theme: string;
  secondary: string;
}

const FALLBACK_PALETTES: PromptPalette[] = [
  { theme: "#7c3aed", secondary: "#2e1065" },
  { theme: "#059669", secondary: "#022c22" },
  { theme: "#ea580c", secondary: "#431407" },
  { theme: "#db2777", secondary: "#500724" },
  { theme: "#1f2937", secondary: "#020617" },
  { theme: "#b91c1c", secondary: "#450a0a" },
  { theme: "#0d9488", secondary: "#083344" },
  { theme: "#2563eb", secondary: "#0f172a" },
];

const CURRENT_CONTENT_MARKER = /===\s*CONTE[ÚU]DO ATUAL DA PE[ÇC]A\s*===/i;
const CHANNEL_MARKER =
  /(?:^|\n)\s*(?:#{1,3}\s*)?(BANNER|E[- ]?MAIL(?:\s+MARKETING)?|EMAIL(?:\s+MARKETING)?|POST\s+SOCIAL|SOCIAL)\s*:\s*/gim;

function markerToMaterial(marker: string): MaterialType {
  const normalized = marker.toLowerCase().replace(/[- ]/g, "");
  if (normalized === "banner") return "banner";
  if (normalized.includes("mail")) return "email";
  return "social";
}

/**
 * Isola o briefing de um canal quando o usuário envia várias peças na mesma
 * mensagem. O contexto global e o conteúdo atual da peça continuam presentes.
 */
export function extractMaterialBriefing(
  text: string,
  material: MaterialType,
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const currentContentIndex = trimmed.search(CURRENT_CONTENT_MARKER);
  const source =
    currentContentIndex >= 0
      ? trimmed.slice(0, currentContentIndex).trim()
      : trimmed;
  const currentContent =
    currentContentIndex >= 0 ? trimmed.slice(currentContentIndex).trim() : "";

  const markers = Array.from(source.matchAll(CHANNEL_MARKER)).map((match) => ({
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    material: markerToMaterial(match[1]),
  }));

  if (markers.length === 0) return trimmed;

  const globalContext = source.slice(0, markers[0].index).trim();
  const channelSections = markers
    .map((marker, index) => ({
      ...marker,
      content: source
        .slice(marker.end, markers[index + 1]?.index ?? source.length)
        .trim(),
    }))
    .filter((section) => section.material === material && section.content)
    .map((section) => section.content);

  return [globalContext, ...channelSections, currentContent]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Escolhe variedade visual reproduzível, sem aleatoriedade entre regenerações. */
export function selectFallbackPalette(seed: string): PromptPalette {
  return FALLBACK_PALETTES[stableHash(seed) % FALLBACK_PALETTES.length];
}

export function clipPromptValue(value: unknown, maxLength = 1800): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\u0000/g, "").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}
