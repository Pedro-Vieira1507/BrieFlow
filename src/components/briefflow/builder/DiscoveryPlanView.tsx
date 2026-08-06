// src/components/briefflow/builder/DiscoveryPlanView.tsx
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Editable } from "@/components/briefflow/Editable";
import type { BuilderState, DiscoveryPlan } from "@/types/builder";
import { cn } from "@/lib/utils";
import { cleanText, isEmptyLike } from "@/lib/sanitize";

interface Props {
  plan: DiscoveryPlan;
  loading?: boolean;
  onPatch: (patch: Partial<BuilderState>) => void;
  onApprove: () => void;
}

export function DiscoveryPlanView({ plan, loading, onPatch, onApprove }: Props) {
  const detectedContext = cleanText(plan.detectedContext);
  const missingInfo = cleanText(plan.missingInfo);
  const proposedStrategy = cleanText(plan.proposedStrategy);
  const offer = cleanText(plan.offer);

  const hasContext = detectedContext.length > 0;
  const hasMissing = !isEmptyLike(plan.missingInfo);
  const hasStrategy = proposedStrategy.length > 0;
  const hasOffer = offer.length > 0;

  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6 scale-in"
      data-testid="discovery-plan-view"
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <div
          className={cn(
            "mb-4 grid size-16 place-items-center rounded-2xl",
            "bg-brand-muted ring-1 ring-brand/30",
            "shadow-[0_0_50px_var(--brand-glow)]",
          )}
        >
          <Sparkles className="size-7 text-brand" />
        </div>
        <h3 className="font-display text-2xl font-semibold tracking-tight text-fg-primary">
          Briefing estruturado
        </h3>
        <p className="mt-2 text-[13px] text-fg-tertiary">
          Edite o que o agente deduziu antes de gerar as artes finais.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card label="Contexto principal" tone="brand" testid="discovery-context-card">
          {hasContext ? (
            <Editable
              as="p"
              multiline
              value={detectedContext}
              onChange={(v) =>
                onPatch({ discoveryPlan: { ...plan, detectedContext: v } })
              }
              className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg-secondary break-words"
            />
          ) : (
            <EmptyHint>
              Ainda não capturei um contexto claro. Envie mais detalhes no chat
              para eu estruturar o briefing.
            </EmptyHint>
          )}
        </Card>

        <Card label="Falta validar" tone="danger" testid="discovery-missing-card">
          {hasMissing ? (
            <Editable
              as="p"
              multiline
              value={missingInfo}
              onChange={(v) =>
                onPatch({ discoveryPlan: { ...plan, missingInfo: v } })
              }
              className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg-secondary break-words"
            />
          ) : (
            <EmptyHint>Nenhuma pendência identificada. Você já pode gerar as peças.</EmptyHint>
          )}
        </Card>

        {hasStrategy && (
          <Card label="Estratégia proposta" tone="brand" testid="discovery-strategy-card">
            <Editable
              as="p"
              multiline
              value={proposedStrategy}
              onChange={(v) =>
                onPatch({ discoveryPlan: { ...plan, proposedStrategy: v } })
              }
              className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg-secondary break-words"
            />
          </Card>
        )}

        {hasOffer && (
          <Card label="Oferta / cupom" tone="brand" testid="discovery-offer-card">
            <Editable
              as="p"
              value={offer}
              onChange={(v) => onPatch({ discoveryPlan: { ...plan, offer: v } })}
              className="text-[13.5px] leading-relaxed text-fg-secondary break-words font-semibold"
            />
          </Card>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={onApprove}
          disabled={loading}
          data-testid="discovery-approve-btn"
          className={cn(
            "h-12 rounded-xl px-8 font-semibold tracking-wide",
            "bg-brand text-brand-fg",
            "shadow-[var(--shadow-brand)] hover:brightness-110 transition-all",
          )}
        >
          Aprovar e gerar peças
        </Button>
      </div>
    </div>
  );
}

function Card({
  label,
  tone,
  children,
  testid,
}: {
  label: string;
  tone: "brand" | "danger";
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <div
      data-testid={testid}
      className={cn(
        "rounded-2xl border border-border-subtle bg-surface-2 p-5",
        "shadow-[var(--shadow-soft)]",
      )}
    >
      <h4
        className={cn(
          "mb-3 text-[10px] font-bold uppercase tracking-widest",
          tone === "brand" ? "text-brand" : "text-rose-400",
        )}
      >
        {label}
      </h4>
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] italic leading-relaxed text-fg-tertiary">
      {children}
    </p>
  );
}
