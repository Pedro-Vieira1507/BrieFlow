import { type ChangeEvent, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FlaskConical,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ExperimentHistoryPanel } from "./ExperimentHistoryPanel";
import { ExperimentHistoricalImport } from "./ExperimentHistoricalImport";
import {
  buildExperimentCsvTemplate,
  parseExperimentCsv,
  type ExperimentCsvParseResult,
} from "@/lib/experimentCsv";
import {
  analyzeExperimentEvidence,
  type ProportionEvidence,
} from "@/lib/experimentStatistics";
import {
  saveExperimentMetrics,
  type AssetExperimentMetrics,
  type SavedLibraryAsset,
} from "@/lib/supabase";

interface ExperimentEvidencePanelProps {
  variants: SavedLibraryAsset[];
  metrics: AssetExperimentMetrics[];
  onMetricsImported: (metrics: AssetExperimentMetrics[]) => void;
}

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatPValue(value: number | null): string {
  if (value === null) return "—";
  if (value < 0.001) return "< 0,001";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${percent.format(value)} p.p.`;
}

function EvidenceRow({ evidence }: { evidence: ProportionEvidence }) {
  return (
    <div className="grid gap-2 rounded-xl border border-border-subtle bg-surface-1 p-3 sm:grid-cols-[1.1fr_repeat(4,minmax(0,1fr))] sm:items-center">
      <div>
        <div className="text-xs font-semibold text-fg-primary">
          {evidence.label}
        </div>
        <div className="mt-1 text-[10px] text-fg-muted">
          {evidence.status === "significant"
            ? "Diferença significativa a 95%"
            : evidence.status === "insufficient"
              ? "Amostra ainda insuficiente"
              : "Diferença ainda inconclusiva"}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-fg-muted">A</div>
        <div className="mt-0.5 text-xs font-semibold tabular-nums text-fg-primary">
          {percent.format(evidence.aRate)}%
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-fg-muted">B</div>
        <div className="mt-0.5 text-xs font-semibold tabular-nums text-fg-primary">
          {percent.format(evidence.bRate)}%
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-fg-muted">Δ B − A</div>
        <div className="mt-0.5 text-xs font-semibold tabular-nums text-fg-primary">
          {formatDelta(evidence.deltaPercentagePoints)}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-fg-muted">p-valor</div>
        <div className="mt-0.5 text-xs font-semibold tabular-nums text-fg-primary">
          {formatPValue(evidence.pValue)}
        </div>
      </div>
    </div>
  );
}

export function ExperimentEvidencePanel({
  variants,
  metrics,
  onMetricsImported,
}: ExperimentEvidencePanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedCsv, setParsedCsv] = useState<ExperimentCsvParseResult | null>(
    null,
  );
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const variantsByLabel = useMemo(
    () => new Map(variants.map((variant) => [variant.variant_label, variant])),
    [variants],
  );
  const metricsByAsset = useMemo(
    () => new Map(metrics.map((metric) => [metric.asset_id, metric])),
    [metrics],
  );
  const a = variantsByLabel.get("A");
  const b = variantsByLabel.get("B");
  const evidence = analyzeExperimentEvidence(
    a ? metricsByAsset.get(a.id) : null,
    b ? metricsByAsset.get(b.id) : null,
  );

  const handleCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("CSV muito grande", {
        description: "Use um arquivo de até 2 MB com métricas agregadas.",
      });
      return;
    }
    try {
      const result = parseExperimentCsv(await file.text());
      const unknownVariant = result.rows.find(
        (row) => !variantsByLabel.get(row.variant),
      );
      if (unknownVariant) {
        throw new Error(
          `A variação ${unknownVariant.variant} não existe neste experimento.`,
        );
      }
      setParsedCsv(result);
      setFileName(file.name);
      toast.success("CSV lido", {
        description: `${result.sourceRowCount} linha(s) agregada(s) em ${result.rows.length} variação(ões).`,
      });
    } catch (error) {
      setParsedCsv(null);
      setFileName("");
      toast.error("Não foi possível ler o CSV", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleImport = async () => {
    if (!parsedCsv) return;
    setImporting(true);
    try {
      const saved: AssetExperimentMetrics[] = [];
      for (const row of parsedCsv.rows) {
        const variant = variantsByLabel.get(row.variant);
        if (!variant) continue;
        const importNote = [
          fileName ? `CSV: ${fileName}` : "CSV importado",
          row.notes,
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 500);
        saved.push(
          await saveExperimentMetrics(variant.id, {
            impressions: row.impressions,
            clicks: row.clicks,
            conversions: row.conversions,
            revenue: row.revenue,
            notes: importNote,
          }),
        );
      }
      onMetricsImported(saved);
      setParsedCsv(null);
      setFileName("");
      toast.success("Métricas importadas", {
        description:
          "Os agregados do CSV substituíram os valores atuais das variações importadas.",
      });
    } catch (error) {
      toast.error("Não foi possível importar as métricas", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([buildExperimentCsvTemplate()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "brieflow-experimento-ab.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const recommendation = (() => {
    switch (evidence.recommendation) {
      case "significant_conversion":
        return {
          icon: CheckCircle2,
          title: `Sinal consistente para a variação ${evidence.suggestedWinner}`,
          body: "A diferença de conversão por impressão atingiu significância estatística bilateral a 95%. Ainda confirme qualidade do tráfego, receita e condições do teste antes da decisão final.",
        };
      case "ctr_only_signal":
        return {
          icon: AlertTriangle,
          title: "CTR mudou, conversão ainda não",
          body: "Há diferença estatística em cliques, mas a métrica de negócio ainda é inconclusiva. Evite declarar vencedora apenas pelo CTR.",
        };
      case "conversion_inconclusive":
        return {
          icon: AlertTriangle,
          title: "Experimento ainda inconclusivo",
          body: "O volume já permite a aproximação estatística, mas a diferença observada em conversão ainda não ultrapassou o limiar de 95%.",
        };
      default:
        return {
          icon: FlaskConical,
          title: "Colete mais dados antes de decidir",
          body: "Ainda não há eventos suficientes para uma comparação estável de conversão. Continue o teste com distribuição de tráfego comparável entre A e B.",
        };
    }
  })();
  const RecommendationIcon = recommendation.icon;

  return (
    <div className="space-y-4">
      <ExperimentHistoricalImport
        variants={variants}
        onMetricsImported={onMetricsImported}
      />

      <section className="rounded-2xl border border-border-subtle bg-surface-2/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h6 className="text-xs font-semibold text-fg-primary">
              Importar resultados por CSV
            </h6>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-tertiary">
              Use colunas de variante, impressões, cliques e conversões. Receita
              e observações são opcionais. Linhas repetidas de A ou B são
              somadas antes da gravação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="min-h-11 rounded-xl border-border-strong bg-surface-1 text-xs text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
            >
              <Download className="mr-1.5 size-4" />
              Modelo CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-11 rounded-xl border-border-strong bg-surface-1 text-xs text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
            >
              <Upload className="mr-1.5 size-4" />
              Escolher CSV
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

        {parsedCsv ? (
          <div className="mt-4 rounded-xl border border-brand/20 bg-brand-muted/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-fg-primary">
                  Prévia · {fileName}
                </div>
                <div className="mt-1 text-[10px] text-fg-muted">
                  {parsedCsv.sourceRowCount} linha(s) → {parsedCsv.rows.length}{" "}
                  agregado(s)
                </div>
              </div>
              <Button
                type="button"
                disabled={importing}
                onClick={() => void handleImport()}
                className="min-h-11 rounded-xl bg-brand px-4 text-xs font-semibold text-brand-fg hover:brightness-110"
              >
                {importing ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 size-4" />
                )}
                Aplicar CSV
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {parsedCsv.rows.map((row) => (
                <div
                  key={row.variant}
                  className="rounded-xl border border-border-subtle bg-surface-1 p-3 text-xs"
                >
                  <div className="font-semibold text-fg-primary">
                    Variação {row.variant}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-fg-tertiary">
                    <span>Impressões</span>
                    <span className="text-right tabular-nums text-fg-primary">
                      {integer.format(row.impressions)}
                    </span>
                    <span>Cliques</span>
                    <span className="text-right tabular-nums text-fg-primary">
                      {integer.format(row.clicks)}
                    </span>
                    <span>Conversões</span>
                    <span className="text-right tabular-nums text-fg-primary">
                      {integer.format(row.conversions)}
                    </span>
                    <span>Receita</span>
                    <span className="text-right tabular-nums text-fg-primary">
                      {currency.format(row.revenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface-2/60 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand-muted text-brand">
            <RecommendationIcon className="size-4" />
          </span>
          <div>
            <h6 className="text-xs font-semibold text-fg-primary">
              Evidência estatística
            </h6>
            <p className="mt-1 text-sm font-semibold text-fg-primary">
              {recommendation.title}
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-fg-tertiary">
              {recommendation.body}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <EvidenceRow evidence={evidence.conversion} />
          <EvidenceRow evidence={evidence.ctr} />
        </div>

        {evidence.conversion.status !== "significant" &&
        evidence.conversion.targetPerVariant ? (
          <div className="mt-3 rounded-xl border border-border-subtle bg-surface-1 p-3 text-xs leading-5 text-fg-tertiary">
            Com o efeito observado agora, uma referência aproximada para 80% de
            poder estatístico seria ~
            <strong className="text-fg-primary">
              {integer.format(evidence.conversion.targetPerVariant)} impressões
              por variante
            </strong>
            . Faltariam cerca de{" "}
            {integer.format(evidence.conversion.additionalA ?? 0)} em A e{" "}
            {integer.format(evidence.conversion.additionalB ?? 0)} em B. Essa
            projeção muda conforme as taxas mudam.
          </div>
        ) : null}

        {evidence.conversion.ciLowPercentagePoints !== null &&
        evidence.conversion.ciHighPercentagePoints !== null ? (
          <p className="mt-3 text-[11px] leading-5 text-fg-muted">
            IC95% da diferença de conversão B − A:{" "}
            {formatDelta(evidence.conversion.ciLowPercentagePoints)} a{" "}
            {formatDelta(evidence.conversion.ciHighPercentagePoints)}. Teste
            bilateral de duas proporções; significância estatística não
            substitui validação de atribuição, distribuição de tráfego ou
            impacto financeiro.
          </p>
        ) : null}
      </section>

      {a?.experiment_group_id ? (
        <ExperimentHistoryPanel
          experimentGroupId={a.experiment_group_id}
          variants={variants}
          metrics={metrics}
        />
      ) : null}
    </div>
  );
}
