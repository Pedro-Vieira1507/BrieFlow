// src/components/briefflow/builder/DiscoveryPlanView.tsx
import { DiscoveryPlan, BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { Editable } from "../Editable";
import { Sparkles, Target, Users, Megaphone, Tag, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  plan: DiscoveryPlan;
  loading: boolean;
  onPatch: (patch: Partial<BuilderState>) => void;
  onApprove: () => void;
}

export function DiscoveryPlanView({ plan, loading, onPatch, onApprove }: Props) {
  const handleEdit = (key: keyof DiscoveryPlan, value: string) => {
    onPatch({ discoveryPlan: { ...plan, [key]: value } });
  };

  return (
    <div className={cn("mx-auto max-w-3xl space-y-6 animate-in slide-in-from-bottom-6 fade-in duration-500", loading && "opacity-50 pointer-events-none")}>
      
      <div className="text-center mb-8">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-fg-primary mb-2">Plano de Campanha</h2>
        <p className="text-fg-secondary">Confirme os dados extraídos antes de gerarmos as artes.</p>
      </div>

      <div className="bg-surface-1 border border-border-strong rounded-[24px] shadow-xl overflow-hidden">
        {/* Cabeçalho do Card */}
        <div className="bg-surface-2 p-6 border-b border-border-subtle flex items-start gap-4">
          <div className="size-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <Target className="size-6" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest text-fg-muted mb-1">Marca / Produto</div>
            <Editable
              as="h3"
              value={plan.brandName || "Marca não identificada"}
              onChange={(v) => handleEdit("brandName", v)}
              className="text-xl font-bold text-fg-primary"
            />
            {plan.product && (
              <Editable
                as="p"
                value={plan.product}
                onChange={(v) => handleEdit("product", v)}
                className="text-sm text-fg-secondary mt-1"
              />
            )}
          </div>
        </div>

        {/* Corpo do Card com Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-fg-muted mb-1">
              <Users className="size-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Público-Alvo</span>
            </div>
            <div className="bg-surface-2/50 border border-border-subtle rounded-xl p-3">
              <Editable
                as="p"
                multiline
                value={plan.audience || "Público geral"}
                onChange={(v) => handleEdit("audience", v)}
                className="text-sm text-fg-primary leading-relaxed"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-fg-muted mb-1">
              <Tag className="size-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Oferta Especial</span>
            </div>
            <div className="bg-brand/5 border border-brand/20 rounded-xl p-3">
              <Editable
                as="p"
                value={plan.offer || "Sem oferta definida"}
                onChange={(v) => handleEdit("offer", v)}
                className="text-sm font-semibold text-brand leading-relaxed"
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center gap-2 text-fg-muted mb-1">
              <Megaphone className="size-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Estratégia Proposta</span>
            </div>
            <div className="bg-surface-2/50 border border-border-subtle rounded-xl p-4">
              <Editable
                as="p"
                multiline
                value={plan.proposedStrategy || "Criar peças de conscientização."}
                onChange={(v) => handleEdit("proposedStrategy", v)}
                className="text-sm text-fg-primary leading-relaxed"
              />
            </div>
          </div>

        </div>
      </div>

      <div className="flex justify-center pt-4 pb-10">
        <Button 
          size="lg" 
          onClick={onApprove} 
          disabled={loading}
          // UX: Call to Action super destacado com gradiente e animação de pulse
          className="bg-gradient-to-r from-brand to-indigo-500 text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.6)] hover:shadow-[0_15px_40px_-10px_rgba(99,102,241,0.8)] hover:scale-105 active:scale-95 transition-all duration-300 rounded-full px-10 h-14 font-bold text-base border border-white/10"
        >
          <Sparkles className="size-5 mr-2" />
          Gerar Artes da Campanha
        </Button>
      </div>

    </div>
  );
}