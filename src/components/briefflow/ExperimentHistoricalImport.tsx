import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { CalendarDays, Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  buildCumulativeExperimentSnapshots,
  buildHistoricalExperimentCsvTemplate,
  parseHistoricalExperimentCsv,
  type ExperimentCsvSource,
  type HistoricalExperimentCsvParseResult,
} from "@/lib/experimentHistoricalCsv";
import {
  importExperimentHistory,
  type ExperimentHistoryImportSource,
} from "@/lib/experimentHistory";
import type {
  AssetExperimentMetrics,
  SavedLibraryAsset,
} from "@/lib/supabase";

interface ExperimentHistoricalImportProps {
  variants: SavedLibraryAsset[];
  onMetricsImported: (metrics: AssetExperimentMetrics[]) => void;
}

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const SOURCE_LABELS: Record<ExperimentCsvSource, string> = {
  generic: "BrieFlow",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

function sourceForImport(
  source: ExperimentCsvSource,
): ExperimentHistoryImportSource {
  if (source === "meta_ads" || source === "google_ads") return source;
  return "csv";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("pt-BR");
}

export function ExperimentHistoricalImport({
  variants,
  onMetricsImported,
}: ExperimentHistoricalImportProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<HistoricalExperimentCsvParseResult | null>(
    null,
  );
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const variantsByLabel = useMemo(
    () => new Map(variants.map((variant) => [variant.variant_label, variant])),
    [variants],
  );
  const variantA = variantsByLabel.get("A");
  const variantB = variantsByLabel.get("B");

  const cumulative = useMemo(() => {
    if (!parsed) return [];
    try {
      return buildCumulativeExperimentSnapshots(parsed.rows);
    } catch {
      return [];
    }
  }, [parsed]);

  const latestByVariant = useMemo(() => {
    const latest = new Map<"A" | "B", (typeof cumulative)[number]>();
    for (const snapshot of cumulative) latest.set(snapshot.variant, snapshot);
    return latest;
  }, [cumulative]);

  const downloadTemplate = (source: ExperimentCsvSource) => {
    const blob = new Blob([buildHistoricalExperimentCsvTemplate(source)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `brieflow-historico-${source.replace("_", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("CSV muito grande", {
        description: "Use um arquivo de até 2 MB com resultados diários.",
      });
      return;
    }

    try {
      const result = parseHistoricalExperimentCsv(await file.text());
      if (!result.historical || !result.firstDate || !result.lastDate) {
        throw new Error(
          "Este importador precisa de uma coluna de data. Para totais sem data, use o importador agregado abaixo.",
        );
      }
      buildCumulativeExperimentSnapshots(result.rows);
      setParsed(result);
      setFileName(file.name);
      toast.success("Histórico reconhecido", {
        description: `${result.sourceRowCount} linha(s) · ${SOURCE_LABELS[result.source]} · ${formatDate(result.firstDate)} a ${formatDate(result.lastDate)}.`,
      });
    } catch (error) {
      setParsed(null);
      setFileName("");
      toast.error("Não foi possível ler o histórico", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleImport = async () => {
    if (!parsed || !variantA || !variantB || !variantA.experiment_group_id) {
      return;
    }
    setImporting(true);
    try {
      const snapshots = buildCumulativeExperimentSnapshots(parsed.rows).map(
        (snapshot) => ({
          assetId: snapshot.variant === "A" ? variantA.id : variantB.id,
          capturedOn: snapshot.date,
          impressions: snapshot.impressions,
          clicks: snapshot.clicks,
          conversions: snapshot.conversions,
          revenue: snapshot.revenue,
          notes: snapshot.notes,
        }),
      );

      const saved = await importExperimentHistory(
        variantA.experiment_group_id,
        snapshots,
        sourceForImport(parsed.source),
        `CSV: ${fileName}`.slice(0, 500),
      );
      onMetricsImported(saved);
      setParsed(null);
      setFileName("");
      toast.success("Histórico importado", {
        description:
          "A série diária foi substituída de forma atômica e os totais atuais foram sincronizados com o último dia.",
      });
    } catch (error) {
      toast.error("Não foi possível importar o histórico", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setImporting(false);
    }
  };

  if (!variantA || !variantB) return null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-2/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand-muted text-brand">
            <CalendarDays className="size-4" />
          </span>
          <div>
            <h6 className="text-xs font-semibold text-fg-primary">
              Importar histórico diário
            </h6>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-tertiary">
              Importe resultados diários de A e B. O BrieFlow reconhece o
              formato genérico e exports comuns do Meta Ads e Google Ads,
              soma linhas do mesmo dia e transforma os períodos em snapshots
              cumulativos para os gráficos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["generic", "meta_ads", "google_ads"] as const).map((source) => (
            <Button
              key={source}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate(source)}
              className="min-h-10 rounded-xl border-border-strong bg-surface-1 px-3 text-[11px] text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
            >
              <Download className="mr-1.5 size-3.5" />
              {SOURCE_LABELS[source]}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-10 rounded-xl border-border-strong bg-surface-1 px-3 text-[11px] text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
          >
            <Upload className="mr-1.5 size-3.5" />
            Escolher histórico
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(event) => void handleCsvFile(event)}
          />
        </div>
      </div>

      <p className="mt-3 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2 text-[10px] leading-4 text-fg-muted">
        Use métricas por dia/período, não totais cumulativos do gerenciador. A
        importação histórica é autoritativa: ao aplicar o arquivo, ela substitui
        a série anterior desse experimento. Para não sobrescrever o histórico,
        use o importador agregado sem data.
      </p>

      {parsed ? (
        <div className="mt-4 rounded-xl border border-brand/20 bg-brand-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-fg-primary">
                {fileName} · {SOURCE_LABELS[parsed.source]}
              </div>
              <div className="mt-1 text-[10px] text-fg-muted">
                {formatDate(parsed.firstDate)} → {formatDate(parsed.lastDate)} ·{" "}
                {parsed.sourceRowCount} linha(s) · {cumulative.length} snapshot(s)
              </div>
            </div>
            <Button
              type="button"
              disabled={importing || !variantA.experiment_group_id}
              onClick={() => void handleImport()}
              className="min-h-11 rounded-xl bg-brand px-4 text-xs font-semibold text-brand-fg hover:brightness-110"
            >
              {importing ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 size-4" />
              )}
              Substituir histórico
            </Button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(["A", "B"] as const).map((variant) => {
              const latest = latestByVariant.get(variant);
              return (
                <div
                  key={variant}
                  className="rounded-xl border border-border-subtle bg-surface-1 p-3 text-xs"
                >
                  <div className="font-semibold text-fg-primary">
                    Variação {variant} · total no último dia
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-fg-tertiary">
                    <span>Impressões</span>
                    <span className="text-right tabular-nums text-fg-primary">
                      {integer.format(latest?.impressions ?? 0)}
                    </span>
                    <span>Cliques</span>
                    <span className="text-right tabular-nums text-fg-primary">
                      {integer.format(latest?.clicks ?? 0)}
                    </span>
                    <span>Conversões</span>
                    <span className="text-right tabular-nums text-fg-primary">
                      {integer.format(latest?.conversions ?? 0)}
                    </span>
                    <span>Receita</span>
                    <span className="text-right tabular-nums text-fg-primary">
                      {currency.format(latest?.revenue ?? 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
