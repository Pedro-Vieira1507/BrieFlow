import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Building2,
  Check,
  CreditCard,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  Zap,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { planLabel, useCredits } from "@/hooks/useCredits";
import { CONTENT_FORMATS, PLAN_CATALOG, type PlanId } from "@/lib/plans";
import { invokeEdgeFunction } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SELLABLE_PLANS = [
  "basic",
  "pro",
  "agency",
] as const satisfies readonly PlanId[];

const PLAN_COPY: Record<
  (typeof SELLABLE_PLANS)[number],
  { description: string; highlights: string[] }
> = {
  basic: {
    description: "Para profissionais que publicam com frequência.",
    highlights: ["Ficha técnica, blog e WhatsApp", "Biblioteca com 250 itens"],
  },
  pro: {
    description: "Para times com produção audiovisual e comercial.",
    highlights: ["Reels, vídeos e apresentações", "Até 5 integrantes"],
  },
  agency: {
    description: "Para agências e operações com várias marcas.",
    highlights: ["Podcast e todos os formatos", "Até 25 integrantes"],
  },
};

export function ProfileSettingsModal({ open, onOpenChange }: Props) {
  const { brandContext, setBrandContext, user } = useBriefflowStore();
  const { plan, creditsPercent } = useCredits();
  const [persona, setPersona] = useState(brandContext.persona);
  const [tone, setTone] = useState(brandContext.tone);
  const [framework, setFramework] = useState(brandContext.framework);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [billingAction, setBillingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPersona(brandContext.persona);
    setTone(brandContext.tone);
    setFramework(brandContext.framework);
    setIsUpgrading(false);
    setBillingAction(null);
  }, [open, brandContext]);

  const handleSave = () => {
    setBrandContext({ ...brandContext, persona, tone, framework });
    onOpenChange(false);
    toast.success("Preferências atualizadas.");
  };

  const openBilling = async (
    action: "checkout" | "portal",
    selectedPlan?: PlanId,
  ) => {
    if (!user) {
      toast.error("Entre na sua conta para gerenciar a assinatura.");
      return;
    }
    const actionKey = `${action}:${selectedPlan ?? "current"}`;
    setBillingAction(actionKey);
    try {
      const response = await invokeEdgeFunction<{ url: string }>("billing", {
        action,
        plan: selectedPlan,
        request_id: crypto.randomUUID(),
      });
      if (!response.url) throw new Error("URL de pagamento não recebida.");
      window.location.assign(response.url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o faturamento.",
      );
      setBillingAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[94dvh] w-[calc(100vw-24px)] overflow-y-auto rounded-[24px] border-border-strong bg-surface-1 text-fg-primary shadow-[var(--shadow-elevated)]",
          isUpgrading ? "sm:max-w-[820px]" : "sm:max-w-[560px]",
        )}
      >
        {!isUpgrading ? (
          <DialogHeader className="pb-3 text-left">
            <div className="mb-3 grid size-10 place-items-center rounded-xl border border-brand/20 bg-brand-muted text-brand">
              <SlidersHorizontal className="size-4" />
            </div>
            <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
              Configurações
            </DialogTitle>
            <DialogDescription className="text-fg-tertiary">
              Ajuste a direção padrão e acompanhe seu plano.
            </DialogDescription>
          </DialogHeader>
        ) : null}

        {!isUpgrading ? (
          <Tabs defaultValue="ai" className="mt-1 w-full">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl border border-border-subtle bg-surface-2 p-1">
              <TabsTrigger
                value="ai"
                className="rounded-lg text-xs font-semibold sm:text-sm"
              >
                <Bot className="mr-2 size-4" /> Preferências de IA
              </TabsTrigger>
              <TabsTrigger
                value="billing"
                className="rounded-lg text-xs font-semibold sm:text-sm"
              >
                <CreditCard className="mr-2 size-4" /> Assinatura
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-6 space-y-5 px-1">
              {[
                {
                  label: "Persona padrão",
                  value: persona,
                  setter: setPersona,
                  placeholder: "Ex.: Diretora de Marketing",
                },
                {
                  label: "Tom de voz",
                  value: tone,
                  setter: setTone,
                  placeholder: "Ex.: Profissional, próximo e objetivo",
                },
                {
                  label: "Framework de copy",
                  value: framework,
                  setter: setFramework,
                  placeholder: "Ex.: AIDA, PAS",
                },
              ].map((field) => (
                <div key={field.label} className="space-y-2">
                  <Label className="font-semibold text-fg-secondary">
                    {field.label}
                  </Label>
                  <Input
                    value={field.value}
                    onChange={(event) => field.setter(event.target.value)}
                    className="h-11 rounded-xl border-border-subtle bg-surface-2 text-fg-primary focus-visible:ring-brand"
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSave}
                  className="h-11 w-full rounded-xl bg-brand px-6 font-semibold text-brand-fg sm:w-auto"
                >
                  <Sparkles className="mr-2 size-4" /> Salvar preferências
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="billing" className="mt-6 space-y-5 px-1">
              <div className="rounded-2xl border border-border-strong bg-gradient-to-b from-surface-2 to-surface-1 p-6">
                <div className="mb-6 flex items-start justify-between gap-4 border-b border-border-subtle pb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                      Plano atual
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold text-brand">
                      {plan ? planLabel(plan.plan) : "Gratuito"}
                    </p>
                  </div>
                  <p className="max-w-[240px] truncate rounded-full bg-surface-3 px-3 py-1 text-xs text-fg-secondary">
                    {user?.email ?? "Não logado"}
                  </p>
                </div>

                <div className="flex items-end justify-between">
                  <span className="text-sm text-fg-secondary">
                    Créditos mensais
                  </span>
                  <strong className="text-lg">
                    {plan
                      ? `${plan.creditsRemaining} / ${plan.creditsMonthly}`
                      : "0 / 0"}
                  </strong>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full bg-gradient-to-r from-brand to-indigo-500 transition-all"
                    style={{ width: `${Math.min(100, creditsPercent || 0)}%` }}
                  />
                </div>

                {plan?.allowedFormats?.length ? (
                  <p className="mt-4 text-xs leading-5 text-fg-muted">
                    {plan.allowedFormats
                      .map((format) => CONTENT_FORMATS[format].shortLabel)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => setIsUpgrading(true)}
                  className="h-11 flex-1 rounded-xl bg-fg-primary font-bold text-surface-0 hover:bg-white"
                >
                  <Zap className="mr-2 size-4" /> Comparar planos
                </Button>
                {plan && plan.plan !== "free" ? (
                  <Button
                    variant="outline"
                    disabled={billingAction === "portal:current"}
                    onClick={() => void openBilling("portal")}
                    className="h-11 rounded-xl border-border-strong bg-surface-2"
                  >
                    {billingAction === "portal:current" && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Gerenciar cobrança
                  </Button>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6 py-2 animate-in slide-in-from-right-8 duration-300">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsUpgrading(false)}
                aria-label="Voltar para assinatura"
                className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface-2 text-fg-muted hover:text-fg-primary"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div>
                <h3 className="font-display text-2xl font-bold">
                  Escolha seu plano
                </h3>
                <p className="text-sm text-fg-tertiary">
                  Preço e impostos são confirmados no checkout seguro.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {SELLABLE_PLANS.map((planId) => {
                const definition = PLAN_CATALOG[planId];
                const copy = PLAN_COPY[planId];
                const isCurrent = plan?.plan === planId;
                const loading = billingAction === `checkout:${planId}`;
                return (
                  <div
                    key={planId}
                    className={cn(
                      "flex flex-col rounded-2xl border bg-surface-2/55 p-5",
                      planId === "pro"
                        ? "border-brand/70 shadow-[var(--shadow-brand)]"
                        : "border-border-strong",
                    )}
                  >
                    <div className="mb-4 flex items-center gap-2">
                      {planId === "agency" ? (
                        <Building2 className="size-5 text-brand" />
                      ) : (
                        <Zap className="size-5 text-brand" />
                      )}
                      <h4 className="text-lg font-bold">{definition.label}</h4>
                    </div>
                    <p className="min-h-10 text-xs leading-5 text-fg-tertiary">
                      {copy.description}
                    </p>
                    <p className="mt-5 text-3xl font-black">
                      {definition.monthlyCredits.toLocaleString("pt-BR")}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-fg-muted">
                      créditos por mês
                    </p>
                    <ul className="my-5 flex-1 space-y-3 text-xs leading-5 text-fg-secondary">
                      {copy.highlights.map((highlight) => (
                        <li key={highlight} className="flex gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-brand" />{" "}
                          {highlight}
                        </li>
                      ))}
                    </ul>
                    <Button
                      disabled={isCurrent || Boolean(billingAction)}
                      onClick={() => void openBilling("checkout", planId)}
                      variant={planId === "pro" ? "default" : "outline"}
                      className="h-11 rounded-xl"
                    >
                      {loading && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      {isCurrent
                        ? "Plano atual"
                        : `Escolher ${definition.label}`}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
