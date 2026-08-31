import {
  ArrowRight,
  Download,
  MessageSquare,
  Sparkles,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function BuilderEmptyState({ onOpenChat }: { onOpenChat?: () => void }) {
  const steps = [
    {
      icon: MessageSquare,
      index: "01",
      title: "Contexto",
      copy: "Compartilhe produto, público e objetivo.",
    },
    {
      icon: Wand2,
      index: "02",
      title: "Direção",
      copy: "Revise a estratégia antes da geração.",
    },
    {
      icon: Download,
      index: "03",
      title: "Entrega",
      copy: "Ajuste no canvas e exporte cada formato.",
    },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-170px)] max-w-4xl flex-col items-center justify-center px-1 py-8 text-center fade-in-up lg:min-h-[620px]">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-muted px-3 py-1.5 text-[11px] font-semibold text-brand shadow-[0_12px_40px_-18px_var(--brand-glow)]">
        <span className="size-1.5 rounded-full bg-brand shadow-[0_0_10px_var(--brand-glow)]" />
        Estúdio de campanhas com IA
      </div>

      <div className="relative mb-7 grid size-20 place-items-center rounded-[26px] border border-white/8 bg-gradient-to-b from-surface-2 to-surface-1 shadow-[0_24px_80px_-28px_var(--brand-glow)]">
        <div
          aria-hidden
          className="absolute inset-2 rounded-[20px] bg-brand/8 blur-xl"
        />
        <Sparkles className="relative size-8 text-brand" />
      </div>

      <h2 className="max-w-3xl text-balance font-display text-3xl font-semibold tracking-[-0.045em] text-fg-primary sm:text-4xl lg:text-[46px] lg:leading-[1.08]">
        Uma campanha completa, do briefing ao arquivo final.
      </h2>
      <p className="mt-5 max-w-2xl text-pretty text-sm leading-6 text-fg-secondary sm:text-base sm:leading-7">
        Descreva o objetivo ou envie o link do produto. O BrieFlow organiza a
        estratégia e monta banner, e-mail e social em um único fluxo editável.
      </p>

      <Button
        onClick={onOpenChat}
        className="mt-7 h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-fg shadow-[var(--shadow-brand)] transition hover:-translate-y-0.5 hover:brightness-110 lg:hidden"
      >
        Começar no assistente <ArrowRight className="ml-2 size-4" />
      </Button>

      <div className="mt-10 grid w-full grid-cols-1 overflow-hidden rounded-2xl border border-border-subtle bg-surface-1/55 text-left shadow-[var(--shadow-soft)] backdrop-blur-xl sm:grid-cols-3">
        {steps.map(({ icon: Icon, index, title, copy }, position) => (
          <div
            key={title}
            className={`group p-5 sm:p-6 ${
              position
                ? "border-t border-border-subtle sm:border-l sm:border-t-0"
                : ""
            }`}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface-2 text-fg-secondary transition group-hover:border-brand/25 group-hover:text-brand">
                <Icon className="size-4" />
              </span>
              <span className="font-mono text-[10px] font-semibold text-fg-muted">
                {index}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-fg-primary">{title}</h3>
            <p className="mt-1.5 text-xs leading-5 text-fg-tertiary">{copy}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
