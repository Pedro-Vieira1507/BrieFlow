import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MessageSquareText,
  PanelsTopLeft,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBriefflowStore } from "@/store/briefflow";

const STORAGE_KEY = "brieflow:onboarding:creative-studio:v2";

interface Props {
  onStartBriefing: () => void;
  onOpenFormats: () => void;
}

const STEPS = [
  {
    eyebrow: "1 · Contexto antes da copy",
    title: "Comece com um briefing curto e factual",
    description:
      "Diga o que a marca vende, para quem, qual objetivo importa e quais fatos precisam aparecer. Link e foto real do produto podem entrar pelo assistente.",
    icon: MessageSquareText,
  },
  {
    eyebrow: "2 · Direção antes da produção",
    title: "Aprove a ideia da campanha antes de gerar as peças",
    description:
      "O BrieFlow organiza uma direção criativa única e só depois adapta o papel de banner, social, e-mail, WhatsApp e documentos. Você continua no controle da promessa e dos fatos.",
    icon: Sparkles,
  },
  {
    eyebrow: "3 · Revisão antes da saída",
    title: "Edite, salve e exporte quando estiver pronto",
    description:
      "Revise cada canal, regenere só o que precisa, guarde a campanha na biblioteca e exporte o formato final sem perder o restante do trabalho.",
    icon: PanelsTopLeft,
  },
] as const;

export function OnboardingCoach({ onStartBriefing, onOpenFormats }: Props) {
  const { builder, messages } = useBriefflowStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const hasStarted = useMemo(
    () => builder.type !== "none" || messages.length > 0,
    [builder.type, messages.length],
  );

  useEffect(() => {
    if (hasStarted || typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "done") return;

    const timer = window.setTimeout(() => setOpen(true), 350);
    return () => window.clearTimeout(timer);
  }, [hasStarted]);

  const finish = (action?: "briefing" | "formats") => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "done");
    }
    setOpen(false);
    setStep(0);
    if (action === "briefing") onStartBriefing();
    if (action === "formats") onOpenFormats();
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, "done");
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-24px)] max-w-[560px] rounded-[24px] border-border-strong bg-surface-1 p-0 text-fg-primary shadow-[var(--shadow-elevated)]">
        <div className="border-b border-border-subtle px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <div className="mb-5 flex items-center justify-between gap-4 pr-8">
            <div className="flex items-center gap-2" aria-label={`Etapa ${step + 1} de ${STEPS.length}`}>
              {STEPS.map((_, index) => (
                <span
                  key={index}
                  aria-hidden
                  className={`h-1.5 rounded-full transition-all ${
                    index === step
                      ? "w-8 bg-brand"
                      : index < step
                        ? "w-4 bg-brand/55"
                        : "w-4 bg-white/10"
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-semibold text-fg-muted">
              Guia rápido
            </span>
          </div>

          <DialogHeader className="text-left">
            <div className="mb-4 grid size-11 place-items-center rounded-2xl border border-brand/20 bg-brand-muted text-brand">
              <Icon className="size-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
              {current.eyebrow}
            </p>
            <DialogTitle className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {current.title}
            </DialogTitle>
            <DialogDescription className="mt-3 text-sm leading-6 text-fg-secondary">
              {current.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <button
            type="button"
            onClick={() => finish()}
            className="order-2 min-h-11 rounded-xl px-3 text-sm font-medium text-fg-tertiary transition hover:bg-surface-2 hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:order-1"
          >
            Pular guia
          </button>

          <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row">
            {step === 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => finish("formats")}
                className="min-h-11 rounded-xl border-border-strong bg-surface-2 text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
              >
                Ver formatos
              </Button>
            ) : null}

            {isLast ? (
              <Button
                type="button"
                onClick={() => finish("briefing")}
                className="min-h-11 rounded-xl bg-brand px-5 font-semibold text-brand-fg shadow-[var(--shadow-brand)]"
              >
                <CheckCircle2 className="mr-2 size-4" /> Começar briefing
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
                className="min-h-11 rounded-xl bg-brand px-5 font-semibold text-brand-fg shadow-[var(--shadow-brand)]"
              >
                Próximo <ArrowRight className="ml-2 size-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
