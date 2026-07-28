import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Quero um banner e post de carrinho abandonado: https://exemplo.com",
  "Preciso de um e-mail marketing de reativação com cupom VOLTA10",
];

export function ChatEmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="mt-8 flex flex-col items-center px-2 text-center fade-in-up">
      <div
        className={cn(
          "mb-6 grid size-20 place-items-center rounded-2xl",
          "bg-brand-muted ring-1 ring-brand/30",
          "shadow-[0_0_60px_var(--brand-glow)]",
        )}
      >
        <Sparkles className="size-9 text-brand" />
      </div>
      <h3 className="mb-2 font-display text-[22px] font-semibold tracking-tight text-fg-primary">
        Comece com um briefing
      </h3>
      <p className="mb-7 max-w-[280px] text-[13px] leading-relaxed text-fg-tertiary">
        Cole a URL do produto ou descreva o objetivo. Eu investigo a marca,
        estruturo o plano e crio banner, e-mail e post lado a lado.
      </p>

      <div className="flex w-full flex-col gap-2.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className={cn(
              "group rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-left",
              "text-[13px] leading-relaxed text-fg-tertiary",
              "transition-all hover:border-border-strong hover:bg-surface-3 hover:text-fg-secondary",
            )}
          >
            <span className="text-brand/70 group-hover:text-brand transition-colors">
              →{" "}
            </span>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
