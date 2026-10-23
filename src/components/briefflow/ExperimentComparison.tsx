import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Loader2,
  Save,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  calculateCampaignChannelQuality,
  calculateExperimentRates,
} from "@/lib/campaignExperiment";
import {
  clearExperimentWinner,
  getExperimentData,
  saveExperimentMetrics,
  setExperimentWinner,
  type AssetExperimentData,
  type AssetExperimentMetrics,
  type SavedLibraryAsset,
} from "@/lib/supabase";
import type { MaterialType } from "@/types/brief";

interface ExperimentComparisonProps {
  experimentGroupId: string;
}

interface MetricsDraft {
  impressions: string;
  clicks: string;
  conversions: string;
  revenue: string;
  notes: string;
}

const EMPTY_METRICS: Pick<
  AssetExperimentMetrics,
  "impressions" | "clicks" | "conversions" | "revenue"
> = {
  impressions: 0,
  clicks: 0,
  conversions: 0,
  revenue: 0,
};

const MATERIAL_LABELS: Record<MaterialType, string> = {
  banner: "Banner",
  social: "Social",
  email: "E-mail",
  reel: "Reel",
  video: "Vídeo",
  podcast: "Podcast",
  slides: "Slides",
  technical_sheet: "Ficha técnica",
  blog: "Blog",
  whatsapp: "WhatsApp",
};

const percent = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function toDraft(metrics?: AssetExperimentMetrics): MetricsDraft {
  return {
    impressions: String(metrics?.impressions ?? 0),
    clicks: String(metrics?.clicks ?? 0),
    conversions: String(metrics?.conversions ?? 0),
    revenue: String(metrics?.revenue ?? 0),
    notes: metrics?.notes ?? "",
  };
}

function MetricInput({
  id,
  label,
  value,
  onChange,
  decimal = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  decimal?: boolean;
}) {
  return (
    <label htmlFor={id} className="space-y-1.5">
      <span className="block text-[11px] font-semibold text-fg-tertiary">
        {label}
      </span>
      <input
        id={id}
        type="number"
        min="0"
        step={decimal ? "0.01" : "1"}
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border-strong bg-surface-1 px-3 text-sm text-fg-primary outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}

export function ExperimentComparison({
  experimentGroupId,
}: ExperimentComparisonProps) {
  const [data, setData] = useState<AssetExperimentData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, MetricsDraft>>({});
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getExperimentData(experimentGroupId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        const metricsByAsset = new Map(
          result.metrics.map((metric) => [metric.asset_id, metric]),
        );
        setDrafts(
          Object.fromEntries(
            result.variants.map((variant) => [
              variant.id,
              toDraft(metricsByAsset.get(variant.id)),
            ]),
          ),
        );
        setDecisionNote(result.decision?.decision_note ?? "");
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error("Não foi possível carregar a comparação A/B", {
          description: error instanceof Error ? error.message : undefined,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [experimentGroupId]);

  const qualities = useMemo(
    () =>
      new Map(
        (data?.variants ?? []).map((variant) => [
          variant.id,
          calculateCampaignChannelQuality(variant.content),
        ]),
      ),
    [data?.variants],
  );

  const variantsByLabel = useMemo(
    () =>
      new Map(
        (data?.variants ?? []).map((variant) => [
          variant.variant_label,
          variant,
        ]),
      ),
    [data?.variants],
  );

  const channelRows = useMemo(() => {
    const a = variantsByLabel.get("A");
    const b = variantsByLabel.get("B");
    const aChannels = a ? (qualities.get(a.id)?.channels ?? []) : [];
    const bChannels = b ? (qualities.get(b.id)?.channels ?? []) : [];
    const types = Array.from(
      new Set([
        ...aChannels.map((channel) => channel.type),
        ...bChannels.map((channel) => channel.type),
      ]),
    );
    return types.map((type) => ({
      type,
      a: aChannels.find((channel) => channel.type === type),
      b: bChannels.find((channel) => channel.type === type),
    }));
  }, [qualities, variantsByLabel]);

  const updateDraft = (
    assetId: string,
    field: keyof MetricsDraft,
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [assetId]: {
        ...(current[assetId] ?? toDraft()),
        [field]: value,
      },
    }));
  };

  const handleSaveMetrics = async (assetId: string) => {
    const draft = drafts[assetId] ?? toDraft();
    setSavingAssetId(assetId);
    try {
      const saved = await saveExperimentMetrics(assetId, {
        impressions: Number(draft.impressions || 0),
        clicks: Number(draft.clicks || 0),
        conversions: Number(draft.conversions || 0),
        revenue: Number(draft.revenue || 0),
        notes: draft.notes,
      });
      setData((current) =>
        current
          ? {
              ...current,
              metrics: [
                saved,
                ...current.metrics.filter(
                  (metric) => metric.asset_id !== saved.asset_id,
                ),
              ],
            }
          : current,
      );
      setDrafts((current) => ({
        ...current,
        [assetId]: toDraft(saved),
      }));
      toast.success("Métricas da variação salvas");
    } catch (error) {
      toast.error("Não foi possível salvar as métricas", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingAssetId(null);
    }
  };

  const handleWinner = async (variant: SavedLibraryAsset) => {
    setDeciding(true);
    try {
      const decision = await setExperimentWinner(
        experimentGroupId,
        variant.id,
        decisionNote,
      );
      setData((current) => (current ? { ...current, decision } : current));
      toast.success(`Variação ${variant.variant_label} marcada como vencedora`);
    } catch (error) {
      toast.error("Não foi possível registrar a vencedora", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDeciding(false);
    }
  };

  const handleClearWinner = async () => {
    setDeciding(true);
    try {
      await clearExperimentWinner(experimentGroupId);
      setData((current) =>
        current ? { ...current, decision: null } : current,
      );
      toast.success("Decisão A/B removida");
    } catch (error) {
      toast.error("Não foi possível remover a decisão", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return (
      <section
        aria-label="Comparação A/B"
        className="flex min-h-40 items-center justify-center rounded-2xl border border-border-strong bg-surface-1/80 text-sm text-fg-tertiary"
      >
        <Loader2 className="mr-2 size-4 animate-spin" />
        Carregando comparação A/B...
      </section>
    );
  }

  if (!data || data.variants.length < 2) {
    return (
      <section
        aria-label="Comparação A/B"
        className="rounded-2xl border border-dashed border-border-strong bg-surface-1/60 p-5"
      >
        <h5 className="text-sm font-semibold text-fg-primary">
          Comparação A/B
        </h5>
        <p className="mt-2 text-xs leading-5 text-fg-tertiary">
          Crie a variação B para comparar qualidade por canal e registrar
          resultados reais lado a lado.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Comparação A/B"
      className="space-y-5 rounded-2xl border border-border-strong bg-surface-1/80 p-4 shadow-[var(--shadow-soft)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl border border-brand/20 bg-brand-muted text-brand">
              <BarChart3 className="size-4" />
            </span>
            <div>
              <h5 className="text-sm font-semibold text-fg-primary">
                Comparação A/B
              </h5>
              <p className="mt-0.5 text-xs text-fg-tertiary">
                Qualidade criativa + resultados observados.
              </p>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-fg-muted">
            O score é um diagnóstico editorial e de adequação ao canal; ele não
            prevê performance. Use impressões, cliques, conversões e receita
            para decidir a vencedora real.
          </p>
        </div>
        {data.decision ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={deciding}
            onClick={() => void handleClearWinner()}
            className="min-h-11 rounded-xl border-border-strong bg-surface-2 text-xs text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
          >
            {deciding ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <X className="mr-1.5 size-4" />
            )}
            Limpar decisão
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.variants.map((variant) => {
          const metrics =
            data.metrics.find((item) => item.asset_id === variant.id) ?? null;
          const rates = calculateExperimentRates(metrics ?? EMPTY_METRICS);
          const quality = qualities.get(variant.id);
          const draft = drafts[variant.id] ?? toDraft(metrics ?? undefined);
          const isWinner = data.decision?.winner_asset_id === variant.id;

          return (
            <article
              key={variant.id}
              className="rounded-2xl border border-border-subtle bg-surface-2/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-brand/20 bg-brand-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                      Variação {variant.variant_label}
                    </span>
                    {isWinner ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                        <Trophy className="size-3" /> Vencedora
                      </span>
                    ) : null}
                  </div>
                  <h6 className="mt-2 truncate text-sm font-semibold text-fg-primary">
                    {variant.name}
                  </h6>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums text-fg-primary">
                    {quality?.overallScore ?? 0}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                    score médio
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-border-subtle bg-surface-1 p-2.5">
                  <div className="text-[10px] font-semibold text-fg-muted">
                    CTR
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-fg-primary">
                    {percent.format(rates.ctr)}%
                  </div>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-1 p-2.5">
                  <div className="text-[10px] font-semibold text-fg-muted">
                    CVR
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-fg-primary">
                    {percent.format(rates.cvr)}%
                  </div>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-1 p-2.5">
                  <div className="text-[10px] font-semibold text-fg-muted">
                    Conversão
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-fg-primary">
                    {percent.format(rates.conversionRate)}%
                  </div>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-1 p-2.5">
                  <div className="text-[10px] font-semibold text-fg-muted">
                    Receita/conv.
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold tabular-nums text-fg-primary">
                    {currency.format(rates.revenuePerConversion)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricInput
                  id={`${variant.id}-impressions`}
                  label="Impressões"
                  value={draft.impressions}
                  onChange={(value) =>
                    updateDraft(variant.id, "impressions", value)
                  }
                />
                <MetricInput
                  id={`${variant.id}-clicks`}
                  label="Cliques"
                  value={draft.clicks}
                  onChange={(value) => updateDraft(variant.id, "clicks", value)}
                />
                <MetricInput
                  id={`${variant.id}-conversions`}
                  label="Conversões"
                  value={draft.conversions}
                  onChange={(value) =>
                    updateDraft(variant.id, "conversions", value)
                  }
                />
                <MetricInput
                  id={`${variant.id}-revenue`}
                  label="Receita (R$)"
                  value={draft.revenue}
                  decimal
                  onChange={(value) =>
                    updateDraft(variant.id, "revenue", value)
                  }
                />
              </div>

              <label
                htmlFor={`${variant.id}-notes`}
                className="mt-3 block space-y-1.5"
              >
                <span className="block text-[11px] font-semibold text-fg-tertiary">
                  Observação das métricas
                </span>
                <input
                  id={`${variant.id}-notes`}
                  maxLength={500}
                  value={draft.notes}
                  onChange={(event) =>
                    updateDraft(variant.id, "notes", event.target.value)
                  }
                  placeholder="Ex.: Meta Ads, 7 dias, tráfego frio"
                  className="h-11 w-full rounded-xl border border-border-strong bg-surface-1 px-3 text-sm text-fg-primary outline-none placeholder:text-fg-muted focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
                />
              </label>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(savingAssetId)}
                  onClick={() => void handleSaveMetrics(variant.id)}
                  className="min-h-11 flex-1 rounded-xl border-border-strong bg-surface-1 text-xs font-semibold text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
                >
                  {savingAssetId === variant.id ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 size-4" />
                  )}
                  Salvar métricas
                </Button>
                <Button
                  type="button"
                  disabled={deciding || isWinner}
                  onClick={() => void handleWinner(variant)}
                  className="min-h-11 flex-1 rounded-xl bg-brand text-xs font-semibold text-brand-fg hover:brightness-110"
                >
                  {isWinner ? (
                    <CheckCircle2 className="mr-1.5 size-4" />
                  ) : (
                    <Trophy className="mr-1.5 size-4" />
                  )}
                  {isWinner ? "Vencedora" : "Marcar vencedora"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-2/60 p-4">
        <h6 className="text-xs font-semibold text-fg-primary">
          Score criativo por canal
        </h6>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-fg-muted">
                <th className="px-2 py-2 font-semibold">Canal</th>
                <th className="px-2 py-2 text-center font-semibold">A</th>
                <th className="px-2 py-2 text-center font-semibold">B</th>
                <th className="px-2 py-2 text-center font-semibold">
                  Diferença
                </th>
              </tr>
            </thead>
            <tbody>
              {channelRows.map((row) => {
                const aScore = row.a?.score ?? 0;
                const bScore = row.b?.score ?? 0;
                const delta = bScore - aScore;
                return (
                  <tr
                    key={row.type}
                    className="border-b border-border-subtle/60 last:border-0"
                  >
                    <td className="px-2 py-3 font-semibold text-fg-secondary">
                      {MATERIAL_LABELS[row.type]}
                    </td>
                    <td className="px-2 py-3 text-center tabular-nums text-fg-primary">
                      {row.a ? `${aScore}/100` : "—"}
                    </td>
                    <td className="px-2 py-3 text-center tabular-nums text-fg-primary">
                      {row.b ? `${bScore}/100` : "—"}
                    </td>
                    <td className="px-2 py-3 text-center font-semibold tabular-nums text-fg-secondary">
                      {row.a && row.b ? `${delta > 0 ? "+" : ""}${delta}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <label htmlFor="experiment-decision-note" className="block space-y-1.5">
        <span className="block text-[11px] font-semibold text-fg-tertiary">
          Motivo da decisão (opcional)
        </span>
        <input
          id="experiment-decision-note"
          maxLength={500}
          value={decisionNote}
          onChange={(event) => setDecisionNote(event.target.value)}
          placeholder="Ex.: B teve maior conversão com volume semelhante"
          className="h-11 w-full rounded-xl border border-border-strong bg-surface-2 px-3 text-sm text-fg-primary outline-none placeholder:text-fg-muted focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
        />
      </label>
    </section>
  );
}
