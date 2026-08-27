import { ArrowUpRight, Link2, Mail, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  {
    icon: Link2,
    label: "Analisar produto",
    prompt: "Quero criar uma campanha completa a partir do link de um produto.",
  },
  {
    icon: Mail,
    label: "Campanha de reativação",
    prompt:
      "Preciso de uma campanha de reativação com e-mail, banner e post social.",
  },
];

export function ChatEmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="mx-auto mt-5 flex max-w-[330px] flex-col items-center px-1 text-center fade-in-up sm:mt-8">
      <div
        className={cn(
          "mb-6 grid size-16 place-items-center rounded-[22px]",
          "border border-brand/20 bg-brand-muted",
          "shadow-[0_18px_55px_-24px_var(--brand-glow)]",
        )}
      >
        <Sparkles className="size-7 text-brand" />
      </div>
      <span className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
        Nova campanha
      </span>
      <h3 className="font-display text-[24px] font-semibold tracking-[-0.035em] text-fg-primary">
        O que vamos criar hoje?
      </h3>
      <p className="mb-7 mt-3 max-w-[300px] text-[13px] leading-5 text-fg-tertiary">
        Envie um link ou descreva a ação. Eu organizo o briefing antes de gerar
        qualquer peça.
      </p>

      <div className="flex w-full flex-col gap-2">
        {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(prompt)}
            className={cn(
              "group flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface-2/70 px-3.5 py-3 text-left",
              "text-[12px] font-medium text-fg-secondary",
              "transition-all hover:-translate-y-px hover:border-brand/25 hover:bg-surface-3 hover:text-fg-primary",
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-border-subtle bg-surface-1 text-fg-tertiary transition group-hover:text-brand">
              <Icon className="size-3.5" />
            </span>
            <span className="flex-1">{label}</span>
            <ArrowUpRight className="size-3.5 text-fg-muted transition group-hover:text-brand" />
          </button>
        ))}
      </div>
    </div>
  );
}
