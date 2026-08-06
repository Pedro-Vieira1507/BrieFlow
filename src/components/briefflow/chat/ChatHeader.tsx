import { cn } from "@/lib/utils";

const STEPS = ["Marca", "Objetivo", "Público", "Produtos", "Aprovação"];

interface Props {
  currentStep: number;
  showStepper: boolean;
}

export function ChatHeader({ currentStep, showStepper }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-border-subtle px-6 py-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            "bg-surface-3 border border-border-strong",
            "shadow-[var(--shadow-brand)]",
          )}
        >
          <img
            src="/assets/icone-brieflow.png"
            alt=""
            className="size-8"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div>
          <h1 className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">
            BrieFlow
          </h1>
          <p className="text-[11px] font-medium text-fg-tertiary">
            Diretor de Arte
          </p>
        </div>
      </div>

      {showStepper && (
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest gradient-brand-text">
            Passo {currentStep}: {STEPS[currentStep - 1]}
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 w-4 rounded-full transition-all duration-300",
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
