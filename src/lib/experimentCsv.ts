export interface ExperimentCsvRow {
  variant: "A" | "B";
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  notes: string;
}

export interface ExperimentCsvParseResult {
  rows: ExperimentCsvRow[];
  delimiter: "," | ";" | "\t";
  sourceRowCount: number;
}

const HEADER_ALIASES = {
  variant: [
    "variant",
    "variante",
    "variacao",
    "variation",
    "versao",
    "version",
  ],
  impressions: [
    "impressions",
    "impression",
    "impressoes",
    "impressao",
    "views",
    "visualizacoes",
  ],
  clicks: ["clicks", "click", "cliques", "clique"],
  conversions: [
    "conversions",
    "conversion",
    "conversoes",
    "conversao",
    "compras",
    "purchases",
    "leads",
  ],
  revenue: ["revenue", "receita", "faturamento", "valor", "sales_value"],
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
  const aliases = new Set(HEADER_ALIASES[canonical]);
  return headers.findIndex((header) => aliases.has(header as never));
}

function parseNumber(value: string, label: string, integer: boolean): number {
  const raw = value
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/%/g, "")
    .trim();
  if (!raw) return 0;

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
      decimals > 0 && decimals <= 2
        ? raw.replace(",", ".")
        : raw.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} contém um valor inválido: ${value}`);
  }
  if (integer && !Number.isInteger(parsed)) {
    throw new Error(`${label} deve conter números inteiros.`);
  }
  return parsed;
}

function parseVariant(value: string): "A" | "B" {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/^VARIA(?:NTE|ÇÃO)\s*/i, "");
  if (normalized === "A" || normalized === "B") return normalized;
  throw new Error(`Variante inválida: ${value || "vazia"}. Use A ou B.`);
}

export function parseExperimentCsv(text: string): ExperimentCsvParseResult {
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

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map(normalizeHeader);
  const indexes = {
    variant: findHeaderIndex(headers, "variant"),
    impressions: findHeaderIndex(headers, "impressions"),
    clicks: findHeaderIndex(headers, "clicks"),
    conversions: findHeaderIndex(headers, "conversions"),
    revenue: findHeaderIndex(headers, "revenue"),
    notes: findHeaderIndex(headers, "notes"),
  };

  for (const required of [
    "variant",
    "impressions",
    "clicks",
    "conversions",
  ] as const) {
    if (indexes[required] < 0) {
      throw new Error(`Coluna obrigatória ausente: ${required}.`);
    }
  }

  const aggregated = new Map<"A" | "B", ExperimentCsvRow>();
  let sourceRowCount = 0;

  for (const line of lines.slice(1)) {
    const cells = parseLine(line, delimiter);
    if (!cells.some(Boolean)) continue;
    const variant = parseVariant(cells[indexes.variant] ?? "");
    const current = aggregated.get(variant) ?? {
      variant,
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
      const note = (cells[indexes.notes] ?? "").trim();
      if (note && !current.notes.includes(note)) {
        current.notes = current.notes ? `${current.notes} · ${note}` : note;
      }
    }
    aggregated.set(variant, current);
    sourceRowCount += 1;
  }

  const rows = (["A", "B"] as const)
    .map((variant) => aggregated.get(variant))
    .filter((row): row is ExperimentCsvRow => Boolean(row))
    .map((row) => ({ ...row, revenue: Math.round(row.revenue * 100) / 100 }));

  if (!rows.length)
    throw new Error("Nenhuma linha válida de A ou B foi encontrada.");
  return { rows, delimiter, sourceRowCount };
}

export function buildExperimentCsvTemplate(): string {
  return [
    "variante;impressoes;cliques;conversoes;receita;observacoes",
    "A;1000;80;12;1500,00;Meta Ads - 7 dias",
    "B;1000;95;18;2200,00;Meta Ads - 7 dias",
  ].join("\n");
}
