// src/components/briefflow/builder/DiscoveryPlanView.tsx
import { DiscoveryPlan, BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { Editable } from "../Editable";
import {
  CircleCheck,
  Sparkles,
  Target,
  Users,
  Megaphone,
  Tag,
} from "lucide-react";
import { MATERIAL_TYPES } from "@/types/brief";
import { selectedMaterials } from "@/lib/campaignGeneration";
import { CONTENT_FORMATS, canUseMaterial } from "@/lib/plans";
import { useCreditsStore } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";

interface Props {
  plan: DiscoveryPlan;
  loading: boolean;
  onPatch: (patch: Partial<BuilderState>) => void;
  onApprove: () => void;
}

export function DiscoveryPlanView({
  plan,
  loading,
  onPatch,
  onApprove,
}: Props) {
  const account = useCreditsStore((state) => state.plan);
  const selected = selectedMaterials(plan.channels);
  const allowed = (type: (typeof MATERIAL_TYPES)[number]) =>
    canUseMaterial(account?.plan, type, account?.allowedFormats);
  const cost = selected.reduce(
    (sum, type) => sum + CONTENT_FORMATS[type].creditCost,
    0,
  );
  const handleEdit = (key: keyof DiscoveryPlan, value: string) => {
    onPatch({ discoveryPlan: { ...plan, [key]: value } });
  };

  return (
    <div
      className={cn(
        "mx-auto max-w-4xl space-y-6 animate-in slide-in-from-bottom-6 fade-in duration-500",
        loading && "opacity-50 pointer-events-none",
      )}
    >
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/8 px-3 py-1.5 text-[10px] font-semibold text-emerald-300">
          <CircleCheck className="size-3.5" /> Briefing estruturado
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-fg-primary md:text-3xl">
          Revise a direção da campanha
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-fg-secondary">
          Clique nos textos para ajustar os fatos e a direção criativa. Quanto
          mais específico o briefing, mais relevante a campanha.
        </p>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-border-strong bg-surface-1/88 shadow-[var(--shadow-elevated)] backdrop-blur-xl">
        {/* Cabeçalho do Card */}
        <div className="flex items-start gap-4 border-b border-border-subtle bg-surface-2/65 p-5 sm:p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
            <Target className="size-6" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest text-fg-muted mb-1">
              Marca / Produto
            </div>
            <Editable
              as="h3"
              value={plan.brandName || "Marca não identificada"}
              onChange={(v) => handleEdit("brandName", v)}
              className="text-xl font-bold text-fg-primary"
            />
            {
              <Editable
                as="p"
                value={plan.product || "Descreva o produto ou serviço"}
                onChange={(v) => handleEdit("product", v)}
                className="text-sm text-fg-secondary mt-1"
              />
            }
          </div>
        </div>

        {/* Corpo do Card com Grid */}
        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 md:grid-cols-2 md:gap-6">
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center gap-2 text-fg-muted">
              <Target className="size-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Objetivo da campanha
              </span>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface-2/45 p-3.5">
              <Editable
                as="p"
                multiline
                value={
                  plan.objective || "Defina a ação que você quer do público"
                }
                onChange={(value) => handleEdit("objective", value)}
                className="text-sm leading-relaxed text-fg-primary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-fg-muted mb-1">
              <Users className="size-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Público-Alvo
              </span>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface-2/45 p-3.5 transition hover:border-border-strong">
              <Editable
                as="p"
                multiline
                value={plan.audience || "Público geral"}
                onChange={(v) => handleEdit("audience", v)}
                className="text-sm text-fg-primary leading-relaxed"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-fg-muted mb-1">
              <Tag className="size-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Oferta confirmada · opcional
              </span>
            </div>
            <div className="rounded-xl border border-brand/20 bg-brand/5 p-3.5 transition hover:border-brand/35">
              <Editable
                as="p"
                value={plan.offer || "Sem oferta definida"}
                onChange={(v) => handleEdit("offer", v)}
                className="text-sm font-semibold text-brand leading-relaxed"
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center gap-2 text-fg-muted mb-1">
              <Megaphone className="size-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Estratégia Proposta
              </span>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface-2/45 p-4 transition hover:border-border-strong">
              <Editable
                as="p"
                multiline
                value={
                  plan.proposedStrategy || "Criar peças de conscientização."
                }
                onChange={(v) => handleEdit("proposedStrategy", v)}
                className="text-sm text-fg-primary leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>

      <label className="block space-y-2 text-sm text-fg-secondary">
        <span className="font-semibold text-fg-primary">
          Fatos confirmados por você
        </span>
        <textarea
          className="block w-full rounded-xl border border-border-subtle bg-surface-1 p-3"
          rows={2}
          maxLength={1800}
          disabled={loading}
          value={plan.confirmedFacts ?? ""}
          placeholder="Ex.: Pacote de 250 g. Preço de R$ 39,90."
          onChange={(event) => handleEdit("confirmedFacts", event.target.value)}
        />
        <span>
          Esses dados acompanham as peças e ficam disponíveis na revisão
          editorial.
        </span>
      </label>

      <fieldset
        disabled={loading}
        className="rounded-2xl border border-border-subtle bg-surface-1 p-5"
      >
        <legend className="px-2 font-semibold text-fg-primary">
          Formatos da campanha
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MATERIAL_TYPES.map((type) => {
            const checked = selected.includes(type);
            const available = allowed(type);
            return (
              <label
                key={type}
                className="flex min-h-11 items-center gap-2 text-sm text-fg-secondary"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!available && !checked}
                  onChange={() =>
                    onPatch({
                      discoveryPlan: {
                        ...plan,
                        channels: checked
                          ? selected.filter((value) => value !== type)
                          : [...selected, type],
                      },
                    })
                  }
                />
                {CONTENT_FORMATS[type].label} ·{" "}
                {available
                  ? CONTENT_FORMATS[type].creditCost + " cr."
                  : "fora do plano"}
              </label>
            );
          })}
        </div>
        <p aria-live="polite" className="mt-3 text-sm text-fg-secondary">
          Geração de {selected.length} peça(s) · {cost} créditos
        </p>
      </fieldset>

      <div className="flex justify-center pb-10 pt-3">
        <Button
          size="lg"
          onClick={onApprove}
          disabled={
            loading ||
            !selected.length ||
            selected.some((type) => !allowed(type))
          }
          className="h-12 w-full rounded-xl border border-white/10 bg-brand px-7 text-sm font-semibold text-white shadow-[var(--shadow-brand)] transition-all duration-200 hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:scale-[0.99] sm:w-auto"
        >
          <Sparkles className="mr-2 size-4" />
          Aprovar e gerar campanha
        </Button>
      </div>
    </div>
  );
}
