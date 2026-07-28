import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function BuilderEmptyState() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center text-center">
      <div
        className={cn(
          "mb-5 grid size-16 place-items-center rounded-2xl",
          "bg-surface-2 border border-border-subtle",
        )}
        aria-hidden
      >
        <Sparkles className="size-7 text-fg-muted" />
      </div>
      <h3 className="text-lg font-semibold text-fg-secondary">
        Área de criação
      </h3>
      <p className="mt-2 max-w-xs text-sm text-fg-muted">
        Descreva a peça no chat. O preview aparece aqui em tempo real.
      </p>
    </div>
  );
}
