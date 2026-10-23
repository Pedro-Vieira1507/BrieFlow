import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Loader2,
  PlayCircle,
  Save,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getExperimentHistory,
  saveExperimentTrafficSplit,
  setExperimentRunStatus,
  type AssetExperimentMetricSnapshot,
  type ExperimentHistoryData,
} from "@/lib/experimentHistory";
import type { AssetExperimentMetrics, SavedLibraryAsset } from "@/lib/supabase";

interface ExperimentHistoryPanelProps {
  experimentGroupId: string;
  variants: SavedLibraryAsset[];
  metrics: AssetExperimentMetrics[];
}

interface TrendPoint {
  date: string;
  a: AssetExperimentMetricSnapshot | null;
  b: AssetExperimentMetricSnapshot | null;
}

const percent = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function rate(successes: number, total: number): number {
  return total > 0 ? (successes / total) * 100 : 0;
}

function chartPath(
  points: TrendPoint[],
  pick: (point: TrendPoint) => number | null,
  min: number,
  max: number,
): string {
  const width = 620;
  const top = 14;
  const bottom = 126;
  const span = max - min || 1;
  const coordinates = points
    .map((point, index) => {
      const value = pick(point);
      if (value === null) return null;
      const x =
        points.length <= 1
          ? width / 2
          : 10 + (index / (points.length - 1)) * 600;
      const y = bottom - ((value - min) / span) * (bottom - top);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter((value): value is string => Boolean(value));
  return coordinates.length ? `M ${coordinates.join(" L ")}` : "";
}

function HistoryChart({
  title,
  description,
  points,
  valueA,
  valueB,
  formatValue,
}: {
  title: string;
  description: string;
  points: TrendPoint[];
  valueA: (snapshot: AssetExperimentMetricSnapshot) => number;
  valueB: (snapshot: AssetExperimentMetricSnapshot) => number;
  formatValue: (value: number) => string;
}) {
  const values = points.flatMap((point) => [
    point.a ? valueA(point.a) : null,
    point.b ? valueB(point.b) : null,
  ]);
  const numericValues = values.filter(
    (value): value is number => value !== null,
  );
  const min = numericValues.length ? Math.min(...numericValues) : 0;
  const max = numericValues.length ? Math.max(...numericValues) : 1;
  const aPath = chartPath(
    points,
    (point) => (point.a ? valueA(point.a) : null),
    min,
    max,
  );
  const bPath = chartPath(
    points,
    (point) => (point.b ? valueB(point.b) : null),
    min,
    max,
  );
  const last = points.at(-1);
  const lastA = last?.a ? valueA(last.a) : null;
  const lastB = last?.b ? valueB(last.b) : null;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-fg-primary">{title}</div>
          <div className="mt-1 text-[10px] leading-4 text-fg-muted">
            {description}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-fg-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-brand" /> A
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-fg-secondary" />{" "}
            B
          </span>
        </div>
      </div>

      {points.length ? (
        <>
          <svg
            className="mt-3 h-36 w-full overflow-visible"
            viewBox="0 0 640 150"
            role="img"
            aria-label={`${title}: evolução das variações A e B`}
          >
            <line
              x1="10"
              x2="610"
              y1="126"
              y2="126"
              className="stroke-border-strong"
            />
            {aPath ? (
              <path
                d={aPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brand"
              />
            ) : null}
            {bPath ? (
              <path
                d={bPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="7 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-fg-secondary"
              />
            ) : null}
          </svg>
          <div className="mt-1 flex items-center justify-between text-[10px] text-fg-muted">
            <span>{formatDate(points[0].date)}</span>
            <span>{formatDate(points.at(-1)?.date ?? points[0].date)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <span className="text-fg-muted">A atual</span>
              <div className="mt-0.5 font-semibold tabular-nums text-fg-primary">
                {lastA === null ? "—" : formatValue(lastA)}
              </div>
            </div>
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <span className="text-fg-muted">B atual</span>
              <div className="mt-0.5 font-semibold tabular-nums text-fg-primary">
                {lastB === null ? "—" : formatValue(lastB)}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border-strong p-4 text-xs leading-5 text-fg-muted">
          O histórico começa quando as métricas do experimento são salvas. O
          BrieFlow mantém um snapshot cumulativo por dia e por variação.
        </div>
      )}
    </div>
  );
}

export function ExperimentHistoryPanel({
  experimentGroupId,
  variants,
  metrics,
}: ExperimentHistoryPanelProps) {
  const [history, setHistory] = useState<ExperimentHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTraffic, setSavingTraffic] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [trafficDraft, setTrafficDraft] = useState(50);

  const metricRevision = useMemo(
    () =>
      metrics
        .map((metric) => `${metric.asset_id}:${metric.updated_at}`)
        .sort()
        .join("|"),
    [metrics],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getExperimentHistory(experimentGroupId)
      .then((result) => {
        if (cancelled) return;
        setHistory(result);
        setTrafficDraft(result.run.traffic_a_percent);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error("Não foi possível carregar o histórico A/B", {
          description: error instanceof Error ? error.message : undefined,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [experimentGroupId, metricRevision]);

  const variantsByLabel = useMemo(
    () => new Map(variants.map((variant) => [variant.variant_label, variant])),
    [variants],
  );
  const a = variantsByLabel.get("A");
  const b = variantsByLabel.get("B");
  const metricsByAsset = useMemo(
    () => new Map(metrics.map((metric) => [metric.asset_id, metric])),
    [metrics],
  );
  const aMetric = a ? metricsByAsset.get(a.id) : undefined;
  const bMetric = b ? metricsByAsset.get(b.id) : undefined;
  const totalImpressions =
    (aMetric?.impressions ?? 0) + (bMetric?.impressions ?? 0);
  const observedA =
    totalImpressions > 0
      ? ((aMetric?.impressions ?? 0) / totalImpressions) * 100
      : null;

  const trendPoints = useMemo<TrendPoint[]>(() => {
    if (!history || !a || !b) return [];
    const byDate = new Map<string, TrendPoint>();
    for (const snapshot of history.snapshots) {
      const point = byDate.get(snapshot.captured_on) ?? {
        date: snapshot.captured_on,
        a: null,
        b: null,
      };
      if (snapshot.asset_id === a.id) point.a = snapshot;
      if (snapshot.asset_id === b.id) point.b = snapshot;
      byDate.set(snapshot.captured_on, point);
    }
    return [...byDate.values()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-45);
  }, [a, b, history]);

  const saveTraffic = async () => {
    setSavingTraffic(true);
    try {
      const run = await saveExperimentTrafficSplit(
        experimentGroupId,
        trafficDraft,
      );
      setHistory((current) => (current ? { ...current, run } : current));
      toast.success("Divisão de tráfego salva");
    } catch (error) {
      toast.error("Não foi possível salvar o tráfego", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingTraffic(false);
    }
  };

  const toggleStatus = async () => {
    if (!history) return;
    setChangingStatus(true);
    try {
      const status = history.run.status === "running" ? "completed" : "running";
      const run = await setExperimentRunStatus(experimentGroupId, status);
      setHistory((current) => (current ? { ...current, run } : current));
      toast.success(
        status === "completed"
          ? "Experimento encerrado"
          : "Experimento reaberto",
      );
    } catch (error) {
      toast.error("Não foi possível alterar o experimento", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setChangingStatus(false);
    }
  };

  if (!a || !b) return null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-2/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand-muted text-brand">
            <TrendingUp className="size-4" />
          </span>
          <div>
            <h6 className="text-xs font-semibold text-fg-primary">
              Histórico do experimento
            </h6>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-tertiary">
              Snapshots cumulativos diários mostram como CTR, conversão e
              receita evoluem sem apagar os resultados anteriores.
            </p>
          </div>
        </div>
        {history ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              history.run.status === "running"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : "border-border-strong bg-surface-1 text-fg-tertiary"
            }`}
          >
            {history.run.status === "running" ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <Flag className="size-3" />
            )}
            {history.run.status === "running" ? "Em andamento" : "Encerrado"}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 flex min-h-24 items-center justify-center text-xs text-fg-muted">
          <Loader2 className="mr-2 size-4 animate-spin" /> Carregando histórico…
        </div>
      ) : history ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-fg-primary">
                    Divisão planejada de tráfego
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-fg-muted">
                    Registre a distribuição usada na plataforma de mídia. O
                    BrieFlow compara o planejado com as impressões observadas.
                  </p>
                </div>
                <div className="rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold tabular-nums text-fg-primary">
                  A {trafficDraft}% · B {100 - trafficDraft}%
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={trafficDraft}
                aria-label="Percentual de tráfego destinado à variação A"
                onChange={(event) =>
                  setTrafficDraft(Number(event.target.value))
                }
                className="mt-4 w-full accent-current"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[10px] leading-4 text-fg-muted">
                  Observado:{" "}
                  {observedA === null
                    ? "sem impressões suficientes"
                    : `A ${percent.format(observedA)}% · B ${percent.format(100 - observedA)}%`}
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    savingTraffic ||
                    trafficDraft === history.run.traffic_a_percent
                  }
                  onClick={() => void saveTraffic()}
                  className="min-h-11 rounded-xl bg-brand px-4 text-xs font-semibold text-brand-fg hover:brightness-110"
                >
                  {savingTraffic ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 size-4" />
                  )}
                  Salvar divisão
                </Button>
              </div>
              {observedA !== null &&
              Math.abs(observedA - history.run.traffic_a_percent) >= 10 ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-[11px] leading-5 text-amber-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  As impressões observadas estão mais de 10 p.p. distantes da
                  divisão planejada. Verifique entrega, segmentação ou
                  configuração do experimento antes de interpretar a vencedora.
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
              <div className="text-xs font-semibold text-fg-primary">
                Janela do teste
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Início</dt>
                  <dd className="font-medium text-fg-primary">
                    {formatDateTime(history.run.started_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Fim</dt>
                  <dd className="font-medium text-fg-primary">
                    {formatDateTime(history.run.ended_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Snapshots</dt>
                  <dd className="font-medium tabular-nums text-fg-primary">
                    {history.snapshots.length}
                  </dd>
                </div>
              </dl>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={changingStatus}
                onClick={() => void toggleStatus()}
                className="mt-4 min-h-11 w-full rounded-xl border-border-strong bg-surface-2 text-xs text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
              >
                {changingStatus ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : history.run.status === "running" ? (
                  <Flag className="mr-1.5 size-4" />
                ) : (
                  <PlayCircle className="mr-1.5 size-4" />
                )}
                {history.run.status === "running"
                  ? "Encerrar experimento"
                  : "Reabrir experimento"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <HistoryChart
              title="CTR"
              description="Cliques ÷ impressões, acumulado até cada data."
              points={trendPoints}
              valueA={(snapshot) => rate(snapshot.clicks, snapshot.impressions)}
              valueB={(snapshot) => rate(snapshot.clicks, snapshot.impressions)}
              formatValue={(value) => `${percent.format(value)}%`}
            />
            <HistoryChart
              title="Conversão / impressão"
              description="Conversões ÷ impressões, a métrica principal do teste."
              points={trendPoints}
              valueA={(snapshot) =>
                rate(snapshot.conversions, snapshot.impressions)
              }
              valueB={(snapshot) =>
                rate(snapshot.conversions, snapshot.impressions)
              }
              formatValue={(value) => `${percent.format(value)}%`}
            />
            <HistoryChart
              title="Receita acumulada"
              description="Receita registrada em cada variação ao longo do teste."
              points={trendPoints}
              valueA={(snapshot) => snapshot.revenue}
              valueB={(snapshot) => snapshot.revenue}
              formatValue={(value) => currency.format(value)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
