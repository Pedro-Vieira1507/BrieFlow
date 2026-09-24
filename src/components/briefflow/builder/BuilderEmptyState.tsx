import {
  ArrowUpRight,
  Check,
  Layers3,
  MessageSquareText,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function BuilderEmptyState({ onOpenChat }: { onOpenChat?: () => void }) {
  return (
    <div className="mx-auto max-w-5xl py-3 sm:py-8 fade-in-up">
      <div className="mb-8 flex items-center gap-2 text-xs font-medium text-fg-secondary">
        <span className="size-2 rounded-full bg-brand" /> Seu estúdio, do
        briefing à revisão
      </div>
      <div className="grid items-center gap-8 xl:grid-cols-[1.1fr_1fr] xl:gap-12">
        <div>
          <h2 className="max-w-xl text-balance font-display text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-fg-primary sm:text-5xl">
            Uma ideia forte.
            <br />
            <span className="text-brand">Uma campanha inteira.</span>
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-fg-secondary sm:text-base">
            Conte o que você vende, para quem e o que quer alcançar. Organize a
            direção criativa, crie suas peças e refine cada detalhe em um só
            lugar.
          </p>
          <Button
            onClick={onOpenChat}
            className="mt-7 h-12 rounded-xl bg-brand px-6 font-semibold text-brand-fg"
          >
            Começar meu briefing <ArrowUpRight className="ml-2 size-4" />
          </Button>
          <p className="mt-3 text-xs leading-5 text-fg-tertiary">
            Já tem uma referência? Envie o link ou a foto real do produto pelo
            assistente.
          </p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border-strong bg-surface-1 shadow-[var(--shadow-elevated)]">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <span className="text-xs font-semibold text-fg-primary">
              Uma direção. Vários pontos de contato.
            </span>
            <Layers3 className="size-4 text-brand" />
          </div>
          <div className="m-4 rounded-2xl bg-[#dfeee5] p-6 text-[#12362e] sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]">
              Do detalhe ao conceito
            </p>
            <p className="mt-8 max-w-[260px] font-display text-3xl font-semibold leading-[1.1] tracking-tight">
              O que torna sua marca a escolha certa?
            </p>
            <div className="mt-7 flex items-center justify-between border-t border-[#12362e]/20 pt-4 text-xs">
              <span>Produto · Público · Propósito</span>
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {[
              "Banner e social",
              "E-mail e WhatsApp",
              "Slides em PPTX",
              "Ficha técnica em PDF",
            ].map((label) => (
              <span
                key={label}
                className="rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-[11px] text-fg-secondary"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: MessageSquareText,
            title: "01 · Um briefing claro",
            copy: "Marca, público, objetivo e fatos confirmados antes da criação.",
          },
          {
            icon: Sparkles,
            title: "02 · Uma ideia por campanha",
            copy: "Peças conectadas, com linguagem adaptada a cada canal.",
          },
          {
            icon: PencilLine,
            title: "03 · Sua revisão, seu controle",
            copy: "Edite os textos, confira os alertas e exporte o formato certo.",
          },
        ].map(({ icon: Icon, title, copy }) => (
          <div
            key={title}
            className="rounded-2xl border border-border-subtle bg-surface-1/60 p-4 sm:p-5"
          >
            <Icon className="mb-4 size-5 text-brand" />
            <h3 className="text-sm font-semibold text-fg-primary">{title}</h3>
            <p className="mt-2 text-xs leading-5 text-fg-tertiary">{copy}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs text-fg-muted">
        <Check className="size-3.5" /> Você aprova a direção antes de gerar a
        campanha.
      </p>
    </div>
  );
}
