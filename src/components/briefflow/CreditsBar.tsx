// src/components/briefflow/CreditsBar.tsx
//
// Exibe os créditos restantes do usuário no topo do painel.
import { useCredits, planLabel } from "@/hooks/useCredits";

export function CreditsBar() {
  const { plan, loading, isLow, isPastDue, creditsPercent } = useCredits();

  if (loading || !plan) return null;

  const barColor = isPastDue
    ? "bg-red-500"
    : isLow
    ? "bg-amber-400"
    : "bg-emerald-500";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
      <span className="shrink-0 font-medium text-foreground">
        {planLabel(plan.plan)}
      </span>
      <div className="relative flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, creditsPercent)}%` }}
        />
      </div>
      <span
        className={`shrink-0 tabular-nums ${
          isPastDue ? "text-red-500" : isLow ? "text-amber-500" : "text-muted-foreground"
        }`}
      >
        {isPastDue
          ? "Pagamento pendente"
          : `${plan.creditsRemaining}/${plan.creditsMonthly} créditos`}
      </span>
    </div>
  );
}
