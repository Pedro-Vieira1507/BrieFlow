// src/lib/sanitize.ts
// Helpers centralizados para higienizar strings vindas do LLM
// que podem chegar como "null", "undefined", "Nenhum", "N/A", "-", etc.

const EMPTY_TOKENS = new Set([
  "",
  "null",
  "undefined",
  "nenhum",
  "nenhuma",
  "n/a",
  "na",
  "-",
  "--",
  "none",
  "nao informado",
  "não informado",
  "sem informacao",
  "sem informação",
]);

/**
 * Retorna true se o valor for "vazio" no sentido semântico:
 * null, undefined, string vazia, ou strings-tokens tipo "null"/"nenhum".
 */
export function isEmptyLike(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return Number.isNaN(value);
  if (Array.isArray(value)) return value.every(isEmptyLike);
  if (typeof value === "object")
    return Object.keys(value as object).length === 0;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return EMPTY_TOKENS.has(normalized);
}

/**
 * Retorna uma string limpa. Se o input for empty-like, retorna "" (nunca "null").
 * Também remove artefatos comuns do LLM: colchetes soltos, asteriscos duplos, etc.
 */
export function cleanText(value: unknown, fallback = ""): string {
  if (isEmptyLike(value)) return fallback;
  const raw = typeof value === "string" ? value : String(value);
  return raw
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[|\]/g, "")
    .trim();
}

/**
 * Limpa uma lista removendo itens empty-like e trimando strings.
 * Aceita string CSV, array de strings, ou undefined.
 */
export function cleanList(value: unknown): string[] {
  if (isEmptyLike(value)) return [];
  const arr = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
  return arr.map((v) => cleanText(v)).filter((v) => v.length > 0);
}

/**
 * Aceita string que pode conter uma oferta (ex: "20% OFF", "SUMMER10")
 * e retorna null se for empty-like.
 */
export function cleanOffer(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned.length > 0 ? cleaned : null;
}
