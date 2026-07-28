import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Editable } from "@/components/briefflow/Editable";
import type { BuilderState, DiscoveryPlan } from "@/types/builder";
import { cn } from "@/lib/utils";

const safeText = (v: unknown): string => (typeof v === "string" ? v : v ? String(v) : "");

interface Props {
  plan: DiscoveryPlan;
  loading?: boolean;
  onPatch: (patch: Partial<BuilderState>) => void;
  onApprove: () => void;
}

export function DiscoveryPlanView({ plan, loading, onPatch, onApprove }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 scale-in">
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
        <Card label="Contexto principal" tone="brand">
          <Editable
            as="p"
            multiline
            value={safeText(plan.detectedContext)}
            onChange={(v) => onPatch({ discoveryPlan: { ...plan, detectedContext: v } })}
            className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg-secondary"
          />
        </Card>
        <Card label="Falta validar" tone="danger">
          <Editable
            as="p"
            multiline
            value={safeText(plan.missingInfo)}
            onChange={(v) => onPatch({ discoveryPlan: { ...plan, missingInfo: v } })}
            className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg-secondary"
          />
        </Card>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={onApprove}
          disabled={loading}
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
}: {
  label: string;
  tone: "brand" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
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
