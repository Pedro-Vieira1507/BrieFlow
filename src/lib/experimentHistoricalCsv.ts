export type ExperimentCsvSource = "generic" | "meta_ads" | "google_ads";

export interface ExperimentCsvRow {
  variant: "A" | "B";
  date?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  notes: string;
}

export interface HistoricalExperimentCsvParseResult {
  rows: ExperimentCsvRow[];
  delimiter: "," | ";" | "\t";
  sourceRowCount: number;
  source: ExperimentCsvSource;
  historical: boolean;
  firstDate: string | null;
  lastDate: string | null;
}

export interface ExperimentCumulativeSnapshot {
  variant: "A" | "B";
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  notes: string;
}

const HEADER_ALIASES = {
  variant: [
    "variant",
    "variante",
    "variacao",
    "variation",
    "versao",
    "version",
    "ab",
    "ab_variant",
  ],
  variantLabel: [
    "ad_name",
    "nome_do_anuncio",
    "ad",
    "anuncio",
    "ad_set_name",
    "nome_do_conjunto_de_anuncios",
    "ad_set",
    "conjunto_de_anuncios",
    "campaign",
    "campaign_name",
    "campanha",
    "nome_da_campanha",
    "ad_group",
    "ad_group_name",
    "grupo_de_anuncios",
    "nome_do_grupo_de_anuncios",
  ],
  date: [
    "date",
    "data",
    "day",
    "dia",
    "reporting_starts",
    "reporting_start",
    "inicio_dos_relatorios",
    "inicio_do_relatorio",
    "report_start",
  ],
  impressions: [
    "impressions",
    "impression",
    "impressoes",
    "impressao",
    "views",
    "visualizacoes",
    "impr",
  ],
  clicks: [
    "clicks",
    "click",
    "cliques",
    "clique",
    "link_clicks",
    "cliques_no_link",
    "clicks_all",
    "cliques_todos",
  ],
  conversions: [
    "conversions",
    "conversion",
    "conversoes",
    "conversao",
    "compras",
    "purchases",
    "purchase",
    "website_purchases",
    "compras_no_site",
    "leads",
    "results",
    "resultados",
    "all_conversions",
    "all_conv",
    "todas_as_conversoes",
  ],
  revenue: [
    "revenue",
    "receita",
    "faturamento",
    "valor",
    "sales_value",
    "purchase_conversion_value",
    "website_purchase_conversion_value",
    "valor_de_conversao_da_compra",
    "valor_de_conversao_de_compras",
    "conversion_value",
    "conv_value",
    "all_conversion_value",
    "all_conv_value",
    "valor_de_conv",
    "valor_de_conversao",
    "valor_total_de_conversao",
  ],
  notes: [
    "notes",
    "note",
    "observacoes",
    "observacao",
    "contexto",
    "source",
    "fonte",
  ],
} as const;

type CanonicalHeader = keyof typeof HEADER_ALIASES;

const META_SIGNATURES = new Set([
  "reporting_starts",
  "reporting_start",
  "inicio_dos_relatorios",
  "ad_set_name",
  "nome_do_conjunto_de_anuncios",
  "link_clicks",
  "cliques_no_link",
  "purchase_conversion_value",
  "website_purchase_conversion_value",
]);

const GOOGLE_SIGNATURES = new Set([
  "impr",
  "conv_value",
  "all_conv",
  "all_conversions",
  "ad_group",
  "ad_group_name",
  "grupo_de_anuncios",
  "valor_de_conv",
]);

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function countDelimiterOutsideQuotes(line: string, delimiter: string): number {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      count += 1;
    }
  }
  return count;
}

function detectDelimiter(line: string): "," | ";" | "\t" {
  const candidates = [",", ";", "\t"] as const;
  return candidates.reduce((best, candidate) =>
    countDelimiterOutsideQuotes(line, candidate) >
    countDelimiterOutsideQuotes(line, best)
      ? candidate
      : best,
  );
}

function parseLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells;
}

function findHeaderIndex(
  headers: string[],
  canonical: CanonicalHeader,
): number {
  const aliases = new Set<string>(HEADER_ALIASES[canonical]);
  return headers.findIndex((header) => aliases.has(header));
}

function headerScore(headers: string[]): number {
  let score = 0;
  for (const canonical of [
    "variant",
    "variantLabel",
    "date",
    "impressions",
    "clicks",
    "conversions",
    "revenue",
  ] as const) {
    if (findHeaderIndex(headers, canonical) >= 0) score += 1;
  }
  return score;
}

function locateHeader(lines: string[]): {
  index: number;
  delimiter: "," | ";" | "\t";
  headers: string[];
} {
  let best:
    | {
        index: number;
        delimiter: "," | ";" | "\t";
        headers: string[];
        score: number;
      }
    | undefined;

  for (let index = 0; index < Math.min(lines.length, 15); index += 1) {
    const delimiter = detectDelimiter(lines[index]);
    const headers = parseLine(lines[index], delimiter).map(normalizeHeader);
    const score = headerScore(headers);
    if (!best || score > best.score) {
      best = { index, delimiter, headers, score };
    }
  }

  if (!best || best.score < 4) {
    throw new Error(
      "Não encontrei um cabeçalho válido. Inclua variante/nome, impressões, cliques e conversões.",
    );
  }
  return best;
}

function detectSource(headers: string[]): ExperimentCsvSource {
  if (headers.some((header) => META_SIGNATURES.has(header))) return "meta_ads";
  if (headers.some((header) => GOOGLE_SIGNATURES.has(header)))
    return "google_ads";
  return "generic";
}

function parseNumber(value: string, label: string, integer: boolean): number {
  const raw = value
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/%/g, "")
    .trim();
  if (!raw || raw === "-" || raw === "--" || raw === "—") return 0;

  let normalized = raw;
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    normalized =
      lastComma > lastDot
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = raw.length - lastComma - 1;
    normalized =
      decimals > 0 && decimals <= 4
        ? raw.replace(",", ".")
        : raw.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} contém um valor inválido: ${value}`);
  }
  if (integer && !Number.isInteger(parsed)) {
    throw new Error(
      `${label} precisa ser inteiro. Relatórios com conversões fracionárias devem ser ajustados para eventos discretos antes da importação.`,
    );
  }
  return parsed;
}

function parseVariant(value: string): "A" | "B" {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/^VARIA(?:NTE|CAO)\s*/i, "")
    .replace(/^VERS(?:AO|ION)\s*/i, "");
  if (normalized === "A" || normalized === "B") return normalized;
  throw new Error(`Variante inválida: ${value || "vazia"}. Use A ou B.`);
}

function inferVariantFromLabel(value: string): "A" | "B" {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

  if (!normalized) {
    throw new Error(
      "Não foi possível identificar A/B. Adicione uma coluna variante ou inclua A/B no nome do anúncio.",
    );
  }

  const tokens = normalized.split(/\s+/);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (
      ["VARIANTE", "VARIANT", "VARIACAO", "VERSAO", "VERSION"].includes(
        token,
      ) &&
      (tokens[index + 1] === "A" || tokens[index + 1] === "B")
    ) {
      return tokens[index + 1] as "A" | "B";
    }
  }

  const standalone = tokens.find((token) => token === "A" || token === "B");
  if (standalone === "A" || standalone === "B") return standalone;

  throw new Error(
    `Não foi possível inferir A/B a partir de "${value}". Use nomes com A/B ou inclua uma coluna variante.`,
  );
}

function isSummaryLabel(value: string): boolean {
  const normalized = normalizeHeader(value);
  return (
    normalized === "total" ||
    normalized.startsWith("total_") ||
    normalized === "summary" ||
    normalized.startsWith("resumo")
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Data inválida no CSV.");
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseDate(value: string): string {
  const raw = value.trim();
  if (!raw) throw new Error("Data vazia no CSV.");

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const br = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (br) {
    return toIsoDate(Number(br[3]), Number(br[2]), Number(br[1]));
  }

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return toIsoDate(
      Number(compact[1]),
      Number(compact[2]),
      Number(compact[3]),
    );
  }

  throw new Error(`Data inválida: ${value}. Use AAAA-MM-DD ou DD/MM/AAAA.`);
}

function mergeNotes(current: string, incoming: string): string {
  const note = incoming.trim();
  if (!note || current.includes(note)) return current;
  return current ? `${current} · ${note}` : note;
}

export function parseHistoricalExperimentCsv(
  text: string,
): HistoricalExperimentCsvParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(
      "O CSV precisa ter cabeçalho e pelo menos uma linha de dados.",
    );
  }

  const header = locateHeader(lines);
  const headers = header.headers;
  const source = detectSource(headers);
  const indexes = {
    variant: findHeaderIndex(headers, "variant"),
    variantLabel: findHeaderIndex(headers, "variantLabel"),
    date: findHeaderIndex(headers, "date"),
    impressions: findHeaderIndex(headers, "impressions"),
    clicks: findHeaderIndex(headers, "clicks"),
    conversions: findHeaderIndex(headers, "conversions"),
    revenue: findHeaderIndex(headers, "revenue"),
    notes: findHeaderIndex(headers, "notes"),
  };

  for (const required of ["impressions", "clicks", "conversions"] as const) {
    if (indexes[required] < 0) {
      throw new Error(`Coluna obrigatória ausente: ${required}.`);
    }
  }
  if (indexes.variant < 0 && indexes.variantLabel < 0) {
    throw new Error(
      "Inclua uma coluna variante ou uma coluna de nome de anúncio/campanha com A/B.",
    );
  }

  const historical = indexes.date >= 0;
  const aggregated = new Map<string, ExperimentCsvRow>();
  let sourceRowCount = 0;

  for (const line of lines.slice(header.index + 1)) {
    const cells = parseLine(line, header.delimiter);
    if (!cells.some(Boolean)) continue;

    const variantRaw =
      indexes.variant >= 0
        ? (cells[indexes.variant] ?? "")
        : (cells[indexes.variantLabel] ?? "");

    if (isSummaryLabel(variantRaw)) continue;

    const variant =
      indexes.variant >= 0
        ? parseVariant(variantRaw)
        : inferVariantFromLabel(variantRaw);

    const date = historical ? parseDate(cells[indexes.date] ?? "") : undefined;
    const key = historical ? `${date}:${variant}` : variant;
    const current = aggregated.get(key) ?? {
      variant,
      ...(date ? { date } : {}),
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      notes: "",
    };

    current.impressions += parseNumber(
      cells[indexes.impressions] ?? "",
      "Impressões",
      true,
    );
    current.clicks += parseNumber(cells[indexes.clicks] ?? "", "Cliques", true);
    current.conversions += parseNumber(
      cells[indexes.conversions] ?? "",
      "Conversões",
      true,
    );
    if (indexes.revenue >= 0) {
      current.revenue += parseNumber(
        cells[indexes.revenue] ?? "",
        "Receita",
        false,
      );
    }
    if (indexes.notes >= 0) {
      current.notes = mergeNotes(current.notes, cells[indexes.notes] ?? "");
    }

    aggregated.set(key, current);
    sourceRowCount += 1;
  }

  const rows = [...aggregated.values()]
    .map((row) => ({
      ...row,
      revenue: Math.round(row.revenue * 100) / 100,
    }))
    .sort((left, right) => {
      const dateOrder = (left.date ?? "").localeCompare(right.date ?? "");
      return dateOrder || left.variant.localeCompare(right.variant);
    });

  if (!rows.length) {
    throw new Error("Nenhuma linha válida de A ou B foi encontrada.");
  }

  const dates = rows
    .map((row) => row.date)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    rows,
    delimiter: header.delimiter,
    sourceRowCount,
    source,
    historical,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}

export function buildCumulativeExperimentSnapshots(
  rows: ExperimentCsvRow[],
): ExperimentCumulativeSnapshot[] {
  const datedRows = rows.filter(
    (row): row is ExperimentCsvRow & { date: string } => Boolean(row.date),
  );
  if (!datedRows.length || datedRows.length !== rows.length) {
    throw new Error(
      "Para criar histórico, todas as linhas precisam ter uma data.",
    );
  }

  const variants = new Set(datedRows.map((row) => row.variant));
  if (!variants.has("A") || !variants.has("B")) {
    throw new Error("O histórico precisa conter dados das variações A e B.");
  }

  const byDate = new Map<
    string,
    Map<"A" | "B", ExperimentCsvRow & { date: string }>
  >();
  for (const row of datedRows) {
    const dateRows = byDate.get(row.date) ?? new Map();
    dateRows.set(row.variant, row);
    byDate.set(row.date, dateRows);
  }

  const totals = {
    A: { impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
    B: { impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  };
  const result: ExperimentCumulativeSnapshot[] = [];

  for (const date of [...byDate.keys()].sort()) {
    const dateRows = byDate.get(date)!;
    for (const variant of ["A", "B"] as const) {
      const row = dateRows.get(variant);
      if (row) {
        totals[variant].impressions += row.impressions;
        totals[variant].clicks += row.clicks;
        totals[variant].conversions += row.conversions;
        totals[variant].revenue += row.revenue;
      }
      result.push({
        variant,
        date,
        impressions: totals[variant].impressions,
        clicks: totals[variant].clicks,
        conversions: totals[variant].conversions,
        revenue: Math.round(totals[variant].revenue * 100) / 100,
        notes: row?.notes ?? "",
      });
    }
  }

  return result;
}

export function buildHistoricalExperimentCsvTemplate(
  source: ExperimentCsvSource = "generic",
): string {
  if (source === "meta_ads") {
    return [
      "Reporting starts;Ad name;Impressions;Link clicks;Purchases;Purchase conversion value",
      "2026-10-20;Criativo [A];1000;80;12;1500,00",
      "2026-10-20;Criativo [B];1000;95;18;2200,00",
      "2026-10-21;Criativo [A];900;70;10;1300,00",
      "2026-10-21;Criativo [B];950;88;15;1900,00",
    ].join("\n");
  }

  if (source === "google_ads") {
    return [
      "Day;Ad;Impr.;Clicks;Conversions;Conv. value",
      "2026-10-20;Criativo [A];1000;80;12;1500,00",
      "2026-10-20;Criativo [B];1000;95;18;2200,00",
      "2026-10-21;Criativo [A];900;70;10;1300,00",
      "2026-10-21;Criativo [B];950;88;15;1900,00",
    ].join("\n");
  }

  return [
    "data;variante;impressoes;cliques;conversoes;receita;observacoes",
    "2026-10-20;A;1000;80;12;1500,00;dia 1",
    "2026-10-20;B;1000;95;18;2200,00;dia 1",
    "2026-10-21;A;900;70;10;1300,00;dia 2",
    "2026-10-21;B;950;88;15;1900,00;dia 2",
  ].join("\n");
}
