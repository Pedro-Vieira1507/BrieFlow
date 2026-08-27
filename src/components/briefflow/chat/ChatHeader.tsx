import { cn } from "@/lib/utils";

const STEPS = ["Marca", "Objetivo", "Público", "Produtos", "Aprovação"];

interface Props {
  currentStep: number;
  showStepper: boolean;
}

export function ChatHeader({ currentStep, showStepper }: Props) {
  return (
    <header className="flex min-h-[76px] items-center justify-between border-b border-border-subtle px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative grid size-10 place-items-center overflow-hidden rounded-[14px]",
            "border border-white/8 bg-gradient-to-br from-surface-3 to-surface-2",
            "shadow-[0_12px_32px_-16px_var(--brand-glow)]",
          )}
        >
          <span className="absolute inset-0 bg-brand/8" />
          <img
            src="/assets/icone-brieflow.png"
            alt="BrieFlow"
            className="relative size-8"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div>
          <h1 className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">
            BrieFlow
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-fg-tertiary">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]" />
            Diretor criativo online
          </p>
        </div>
      </div>

      {showStepper && (
        <div
          className="flex flex-col items-end gap-1.5"
          aria-label={`Etapa ${currentStep} de 5: ${STEPS[currentStep - 1]}`}
        >
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-fg-tertiary">
            {currentStep}/5 ·{" "}
            <span className="text-brand">{STEPS[currentStep - 1]}</span>
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 w-3.5 rounded-full transition-all duration-300",
                  s <= currentStep
                    ? "bg-brand shadow-[0_0_8px_var(--brand-glow)]"
                    : "bg-white/8",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
