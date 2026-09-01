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
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-border-subtle bg-surface-2/55 px-5 py-3 transition-colors",
        className,
      )}
    >
      <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide">
        <span className="text-fg-secondary">
          {planLabel(plan.plan)} · créditos
        </span>
        <span
          className={cn(
            "transition-colors duration-300",
            isLow ? "text-rose-400 animate-pulse" : "text-fg-primary",
          )}
        >
          {plan.creditsRemaining} / {plan.creditsMonthly}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3 shadow-inner">
        <div
          role="progressbar"
          aria-label="Créditos disponíveis"
          aria-valuemin={0}
          aria-valuemax={plan.creditsMonthly}
          aria-valuenow={plan.creditsRemaining}
          className={cn(
            "h-full transition-all duration-1000 ease-out", // UX: Transição mais orgânica
            isLow
              ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
              : "bg-brand",
          )}
          style={{ width: `${Math.min(100, creditsPercent)}%` }}
        />
      </div>
    </div>
  );
}
