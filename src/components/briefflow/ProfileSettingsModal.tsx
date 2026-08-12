// src/components/briefflow/ProfileSettingsModal.tsx
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBriefflowStore } from "@/store/briefflow";
import { useCredits, planLabel } from "@/hooks/useCredits";
import { Bot, CreditCard, Sparkles, ArrowLeft, Check, Zap, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsModal({ open, onOpenChange }: Props) {
  const { brandContext, setBrandContext, user } = useBriefflowStore();
  const { plan, creditsPercent } = useCredits();
  const [persona, setPersona] = useState(brandContext.persona);
  const [tone, setTone] = useState(brandContext.tone);
  const [framework, setFramework] = useState(brandContext.framework);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Sincroniza o estado local quando o modal abre
  useEffect(() => {
    if (open) {
      setPersona(brandContext.persona);
      setTone(brandContext.tone);
      setFramework(brandContext.framework);
      setIsUpgrading(false); // Reseta a visão de upgrade
    }
  }, [open, brandContext]);

  const handleSave = () => {
    setBrandContext({ ...brandContext, persona, tone, framework });
    onOpenChange(false);
  };

  const handleComingSoon = () => {
    toast.info("Em Breve!", {
      description: "O gerenciamento de assinaturas estará disponível em breve.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("bg-surface-1 border-border-strong text-fg-primary shadow-2xl transition-all", isUpgrading ? "sm:max-w-[550px]" : "sm:max-w-[500px]")}>
        
        {!isUpgrading && (
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              Configurações da Conta
            </DialogTitle>
            <DialogDescription className="text-fg-tertiary">
              Ajuste suas preferências de geração de IA e acompanhe seu plano.
            </DialogDescription>
          </DialogHeader>
        )}

        {!isUpgrading ? (
          <Tabs defaultValue="ai" className="mt-4 w-full">
            <TabsList className="grid w-full grid-cols-2 bg-surface-2 border border-border-subtle">
              <TabsTrigger value="ai" className="data-[state=active]:bg-surface-3 data-[state=active]:text-brand">
                <Bot className="size-4 mr-2" /> Preferências de IA
              </TabsTrigger>
              <TabsTrigger value="billing" className="data-[state=active]:bg-surface-3 data-[state=active]:text-brand">
                <CreditCard className="size-4 mr-2" /> Assinatura
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-fg-secondary">Persona Padrão</Label>
                <Input 
                  value={persona} 
                  onChange={(e) => setPersona(e.target.value)} 
                  className="bg-surface-2 border-border-subtle text-fg-primary" 
                  placeholder="Ex: Diretor de Marketing" 
                />
                <p className="text-[11px] text-fg-muted">Quem a IA deve assumir que é seu público principal.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-fg-secondary">Tom de Voz</Label>
                <Input 
                  value={tone} 
                  onChange={(e) => setTone(e.target.value)} 
                  className="bg-surface-2 border-border-subtle text-fg-primary" 
                  placeholder="Ex: Profissional, Criativo, Irreverente" 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-fg-secondary">Framework de Copy</Label>
                <Input 
                  value={framework} 
                  onChange={(e) => setFramework(e.target.value)} 
                  className="bg-surface-2 border-border-subtle text-fg-primary" 
                  placeholder="Ex: AIDA, PAS" 
                />
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={handleSave} className="bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)]">
                  <Sparkles className="size-4 mr-2" /> Salvar Preferências
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border-strong bg-surface-2 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-fg-primary">Plano Atual</h4>
                    <p className="text-sm text-fg-secondary">{plan ? planLabel(plan.plan) : "Gratuito"}</p>
                  </div>
                  <div className="text-right">
                    <h4 className="font-semibold text-fg-primary">E-mail</h4>
                    <p className="text-sm text-fg-secondary">{user?.email || "Não logado"}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-fg-secondary">Créditos de Geração</span>
                    <span className="font-medium text-fg-primary">
                      {plan ? `${plan.creditsRemaining} / ${plan.creditsMonthly}` : "0 / 0"}
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-3">
                    <div 
                      className="h-full bg-brand transition-all duration-500" 
                      style={{ width: `${Math.min(100, creditsPercent || 0)}%` }} 
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  onClick={handleComingSoon}
                  className="w-full border-border-strong bg-surface-2 text-fg-primary hover:bg-surface-3"
                >
                  Gerenciar Assinatura
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 py-2">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setIsUpgrading(false)} className="p-1.5 rounded-full hover:bg-surface-3 transition-colors text-fg-muted hover:text-fg-primary">
                <ArrowLeft className="size-4" />
              </button>
              <h3 className="font-semibold text-fg-primary text-lg">Faça um Upgrade</h3>
            </div>
            
            <div className="grid gap-4 overflow-y-auto pr-2 max-h-[60vh] pb-4">
              {/* Plano Gratuito */}
              <div className="border border-border-strong rounded-xl p-5 bg-surface-2/50 opacity-80">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-bold text-fg-primary">Plano Gratuito</h4>
                  {(!plan || plan?.plan === "free") && <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-3 px-2 py-1 rounded-md text-fg-muted">Atual</span>}
                </div>
                <p className="text-2xl font-black text-fg-primary mb-4">R$ 0<span className="text-sm font-medium text-fg-muted">/mês</span></p>
                <ul className="space-y-2.5 text-[13px] text-fg-secondary">
                  <li className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> 50 créditos renovados todo dia</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> 1 crédito consumido por mensagem</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> Geração de banners, e-mails e posts</li>
                </ul>
              </div>

              {/* Plano Pro */}
              <div className="border-2 border-brand rounded-xl p-5 bg-surface-2 relative overflow-hidden shadow-[0_0_30px_var(--brand-glow)]">
                <div className="absolute top-0 right-0 bg-brand text-brand-fg text-[9px] font-black tracking-widest px-3 py-1 rounded-bl-lg uppercase">Mais Popular</div>
                <h4 className="font-bold text-fg-primary mb-1 flex items-center gap-2"><Zap className="size-4 text-brand fill-brand" /> Plano Pro</h4>
                <p className="text-2xl font-black text-fg-primary mb-4">R$ 49,90<span className="text-sm font-medium text-fg-muted">/mês</span></p>
                <ul className="space-y-2.5 text-[13px] text-fg-secondary">
                  <li className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> 1000 créditos renovados por dia</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> Respostas prioritárias e mais rápidas</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> Exportação de imagens em alta resolução</li>
                </ul>
                <Button onClick={handleComingSoon} className="w-full mt-5 bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)]">Assinar Pro</Button>
              </div>

              {/* Plano Agência */}
              <div className="border border-border-strong rounded-xl p-5 bg-surface-2">
                <h4 className="font-bold text-fg-primary mb-1 flex items-center gap-2"><Building2 className="size-4 text-fg-muted" /> Plano Agência</h4>
                <p className="text-2xl font-black text-fg-primary mb-4">R$ 149,90<span className="text-sm font-medium text-fg-muted">/mês</span></p>
                <ul className="space-y-2.5 text-[13px] text-fg-secondary">
                  <li className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> Créditos ILIMITADOS</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> Múltiplas marcas e perfis configuráveis</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-brand shrink-0" /> Suporte VIP via WhatsApp</li>
                </ul>
                <Button onClick={handleComingSoon} variant="outline" className="w-full mt-5 border-border-strong text-fg-primary hover:bg-surface-3">Assinar Agência</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}