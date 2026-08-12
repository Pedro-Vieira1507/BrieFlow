// src/components/briefflow/CreditsBar.tsx
import { useCredits, planLabel } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function CreditsBar({ className }: Props) {
  const { plan, loading, isLow, creditsPercent } = useCredits();

  if (loading || !plan) return null;

  return (
    <div className={cn("px-5 py-3 border-b border-border-subtle bg-surface-2 flex flex-col gap-2", className)}>
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
        <span className="text-fg-secondary">
          Créditos ({planLabel(plan.plan)})
        </span>
        <span className={cn(isLow ? "text-rose-400" : "text-fg-primary")}>
          {plan.creditsRemaining} / {plan.creditsMonthly}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn(
            "h-full transition-all duration-500",
            isLow ? "bg-rose-500" : "bg-brand"
          )}
          style={{ width: `${Math.min(100, creditsPercent)}%` }}
        />
      </div>
    </div>
  );
}