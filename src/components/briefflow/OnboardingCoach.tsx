import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  MessageSquareText,
  PanelsTopLeft,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBriefflowStore } from "@/store/briefflow";

const STORAGE_KEY = "brieflow:onboarding:creative-studio:v3";
const BRIEFING_TEMPLATE =
  "Minha marca é [nome]. Vendemos [produto/serviço] para [público]. O objetivo desta campanha é [ação desejada]. Os fatos que precisam aparecer são: [fatos confirmados]. O tom deve ser [tom]. Não invente preços, resultados, clientes ou condições que eu não informar.";

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
      "O BrieFlow organiza uma direção criativa única e só depois adapta banner, social, e-mail, WhatsApp e documentos. Você continua no controle da promessa e dos fatos.",
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
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
    if (action === "briefing") onStartBriefing();
    if (action === "formats") onOpenFormats();
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(BRIEFING_TEMPLATE);
      setCopied(true);
      toast.success("Modelo de briefing copiado");
    } catch {
      toast.error("Não foi possível copiar o modelo");
    }
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
          setStep(0);
          setCopied(false);
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[600px] overflow-y-auto rounded-[24px] border-border-strong bg-surface-1 p-0 text-fg-primary shadow-[var(--shadow-elevated)]">
        <div className="border-b border-border-subtle px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <div className="mb-5 flex items-center justify-between gap-4 pr-8">
            <div
              role="progressbar"
              aria-label="Progresso do guia rápido"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={step + 1}
              aria-valuetext={`Etapa ${step + 1} de ${STEPS.length}`}
              className="flex items-center gap-2"
            >
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
            <span className="text-xs font-semibold text-fg-muted">
              Guia rápido · {step + 1}/{STEPS.length}
            </span>
          </div>

          <DialogHeader className="text-left">
            <div className="mb-4 grid size-11 place-items-center rounded-2xl border border-brand/20 bg-brand-muted text-brand">
              <Icon className="size-5" aria-hidden />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
              {current.eyebrow}
            </p>
            <DialogTitle className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {current.title}
            </DialogTitle>
            <DialogDescription className="mt-3 text-sm leading-6 text-fg-secondary sm:text-[15px]">
              {current.description}
            </DialogDescription>
          </DialogHeader>

          {step === 0 ? (
            <div className="mt-5 rounded-2xl border border-border-subtle bg-surface-2/75 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-muted text-brand">
                  <ClipboardCheck className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg-primary">
                    Modelo para um briefing melhor
                  </p>
                  <p className="mt-1 text-sm leading-6 text-fg-tertiary">
                    Marca + oferta + público + objetivo + fatos confirmados +
                    tom. Isso reduz retrabalho e ajuda a IA a não inventar
                    informações.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void copyTemplate()}
                    className="mt-3 min-h-10 rounded-xl px-3 text-sm text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
                  >
                    {copied ? (
                      <CheckCircle2 className="mr-2 size-4" aria-hidden />
                    ) : (
                      <Copy className="mr-2 size-4" aria-hidden />
                    )}
                    {copied ? "Modelo copiado" : "Copiar modelo de briefing"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <button
            type="button"
            onClick={() => finish()}
            className="order-3 min-h-11 rounded-xl px-3 text-sm font-medium text-fg-tertiary transition hover:bg-surface-2 hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:order-1"
          >
            Pular guia
          </button>

          <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                className="min-h-11 rounded-xl border-border-strong bg-surface-2 text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
              >
                <ArrowLeft className="mr-2 size-4" aria-hidden /> Voltar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => finish("formats")}
                className="min-h-11 rounded-xl border-border-strong bg-surface-2 text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
              >
                Ver formatos
              </Button>
            )}

            {isLast ? (
              <Button
                type="button"
                onClick={() => finish("briefing")}
                className="min-h-11 rounded-xl bg-brand px-5 font-semibold text-brand-fg shadow-[var(--shadow-brand)]"
              >
                <CheckCircle2 className="mr-2 size-4" aria-hidden /> Começar
                briefing
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() =>
                  setStep((value) => Math.min(STEPS.length - 1, value + 1))
                }
                className="min-h-11 rounded-xl bg-brand px-5 font-semibold text-brand-fg shadow-[var(--shadow-brand)]"
              >
                Próximo <ArrowRight className="ml-2 size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
