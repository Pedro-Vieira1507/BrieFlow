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

  useEffect(() => {
    if (open) {
      setPersona(brandContext.persona);
      setTone(brandContext.tone);
      setFramework(brandContext.framework);
      setIsUpgrading(false); 
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
      <DialogContent className={cn("bg-surface-1 border-border-strong text-fg-primary shadow-2xl transition-all rounded-2xl", isUpgrading ? "sm:max-w-[600px]" : "sm:max-w-[500px]")}>
        
        {!isUpgrading && (
          <DialogHeader className="pb-2">
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              Configurações da Conta
            </DialogTitle>
            <DialogDescription className="text-fg-tertiary">
              Ajuste suas preferências de geração de IA e acompanhe seu plano.
            </DialogDescription>
          </DialogHeader>
        )}

        {!isUpgrading ? (
          <Tabs defaultValue="ai" className="mt-2 w-full">
            <TabsList className="grid w-full grid-cols-2 bg-surface-2 border border-border-subtle rounded-xl p-1 h-12">
              <TabsTrigger value="ai" className="rounded-lg data-[state=active]:bg-surface-3 data-[state=active]:text-brand data-[state=active]:shadow-sm font-semibold">
                <Bot className="size-4 mr-2" /> Preferências de IA
              </TabsTrigger>
              <TabsTrigger value="billing" className="rounded-lg data-[state=active]:bg-surface-3 data-[state=active]:text-brand data-[state=active]:shadow-sm font-semibold">
                <CreditCard className="size-4 mr-2" /> Assinatura
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="space-y-5 mt-6 px-1">
              <div className="space-y-2">
                <Label className="text-fg-secondary font-semibold">Persona Padrão</Label>
                <Input 
                  value={persona} 
                  onChange={(e) => setPersona(e.target.value)} 
                  className="bg-surface-2 border-border-subtle text-fg-primary rounded-xl h-11 focus-visible:ring-brand" 
                  placeholder="Ex: Diretor de Marketing" 
                />
                <p className="text-[12px] text-fg-muted mt-1">Quem a IA deve assumir que é seu público principal.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-fg-secondary font-semibold">Tom de Voz</Label>
                <Input 
                  value={tone} 
                  onChange={(e) => setTone(e.target.value)} 
                  className="bg-surface-2 border-border-subtle text-fg-primary rounded-xl h-11 focus-visible:ring-brand" 
                  placeholder="Ex: Profissional, Criativo, Irreverente" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-fg-secondary font-semibold">Framework de Copy</Label>
                <Input 
                  value={framework} 
                  onChange={(e) => setFramework(e.target.value)} 
                  className="bg-surface-2 border-border-subtle text-fg-primary rounded-xl h-11 focus-visible:ring-brand" 
                  placeholder="Ex: AIDA, PAS" 
                />
              </div>
              <div className="pt-4 flex justify-end">
                <Button onClick={handleSave} className="bg-brand text-brand-fg hover:brightness-110 shadow-lg shadow-brand/20 rounded-xl h-11 px-6 font-bold">
                  <Sparkles className="size-4 mr-2" /> Salvar Preferências
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="billing" className="space-y-5 mt-6 px-1">
              <div className="rounded-2xl border border-border-strong bg-gradient-to-b from-surface-2 to-surface-1 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-border-subtle">
                  <div>
                    <h4 className="font-bold text-fg-primary text-sm uppercase tracking-wider mb-1">Plano Atual</h4>
                    <p className="text-xl font-display font-semibold text-brand">{plan ? planLabel(plan.plan) : "Gratuito"}</p>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-fg-primary text-sm uppercase tracking-wider mb-1">E-mail</h4>
                    <p className="text-sm font-medium text-fg-secondary bg-surface-3 px-3 py-1 rounded-full">{user?.email || "Não logado"}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-medium text-fg-secondary">Créditos de Geração</span>
                    <span className="font-bold text-lg text-fg-primary">
                      {plan ? `${plan.creditsRemaining} / ${plan.creditsMonthly}` : "0 / 0"}
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-3 shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-brand to-indigo-500 transition-all duration-1000 ease-out" 
                      style={{ width: `${Math.min(100, creditsPercent || 0)}%` }} 
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-2">
                <Button 
                  onClick={() => setIsUpgrading(true)}
                  className="w-full bg-white text-black hover:bg-slate-200 font-bold rounded-xl h-12 shadow-lg"
                >
                  <Zap className="size-4 mr-2 fill-black" /> Fazer Upgrade do Plano
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-300 py-2">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setIsUpgrading(false)} className="p-2 rounded-full bg-surface-2 hover:bg-surface-3 transition-colors text-fg-muted hover:text-fg-primary shadow-sm border border-border-subtle">
                <ArrowLeft className="size-4" />
              </button>
              <div>
                <h3 className="font-display font-bold text-fg-primary text-2xl">Escolha seu plano</h3>
                <p className="text-sm text-fg-tertiary">Cancele quando quiser. Sem compromisso.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-1 max-h-[65vh] pb-4">
              {/* Plano Pro */}
              <div className="border-2 border-brand/80 rounded-2xl p-6 bg-gradient-to-b from-brand/10 to-surface-2 relative overflow-hidden shadow-[0_10px_40px_-10px_rgba(99,102,241,0.2)] md:col-span-2">
                <div className="absolute top-0 right-0 bg-brand text-brand-fg text-[10px] font-black tracking-widest px-4 py-1.5 rounded-bl-xl uppercase shadow-md">Mais Popular</div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-brand/20 rounded-xl">
                    <Zap className="size-6 text-brand fill-brand" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xl text-fg-primary leading-none">Plano Pro</h4>
                    <p className="text-sm text-brand font-medium mt-1">O ideal para criadores</p>
                  </div>
                </div>
                <p className="text-4xl font-black text-fg-primary mb-6 tracking-tight">R$ 49,90<span className="text-base font-semibold text-fg-muted tracking-normal">/mês</span></p>
                <ul className="space-y-3.5 text-sm font-medium text-fg-secondary md:grid md:grid-cols-2 md:gap-x-4 md:space-y-0 md:gap-y-3">
                  <li className="flex items-start gap-3"><Check className="size-5 text-brand shrink-0 mt-0.5" /> 1000 créditos renovados por dia</li>
                  <li className="flex items-start gap-3"><Check className="size-5 text-brand shrink-0 mt-0.5" /> Exportação de imagens em alta resolução</li>
                  <li className="flex items-start gap-3"><Check className="size-5 text-brand shrink-0 mt-0.5" /> Respostas prioritárias e sem filas</li>
                  <li className="flex items-start gap-3"><Check className="size-5 text-brand shrink-0 mt-0.5" /> Acesso a todos os modelos premium</li>
                </ul>
                <Button onClick={handleComingSoon} className="w-full mt-8 bg-brand text-brand-fg hover:brightness-110 shadow-lg shadow-brand/25 rounded-xl h-12 font-bold text-base">Assinar Pro Agora</Button>
              </div>

              {/* Plano Gratuito */}
              <div className="border border-border-strong rounded-2xl p-6 bg-surface-2/30 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-lg text-fg-primary">Gratuito</h4>
                  {(!plan || plan?.plan === "free") && <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-3 px-2 py-1 rounded-md text-fg-muted border border-border-subtle">Atual</span>}
                </div>
                <p className="text-2xl font-black text-fg-primary mb-6">R$ 0<span className="text-sm font-medium text-fg-muted">/mês</span></p>
                <ul className="space-y-3 text-sm text-fg-secondary flex-1">
                  <li className="flex items-start gap-2"><Check className="size-4 text-fg-muted shrink-0 mt-0.5" /> 50 créditos diários</li>
                  <li className="flex items-start gap-2"><Check className="size-4 text-fg-muted shrink-0 mt-0.5" /> Geração de banners, e-mails e posts</li>
                </ul>
              </div>

              {/* Plano Agência */}
              <div className="border border-border-strong rounded-2xl p-6 bg-surface-2 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="size-5 text-fg-muted" />
                  <h4 className="font-bold text-lg text-fg-primary">Agência</h4>
                </div>
                <p className="text-2xl font-black text-fg-primary mb-6">R$ 149,90<span className="text-sm font-medium text-fg-muted">/mês</span></p>
                <ul className="space-y-3 text-sm text-fg-secondary flex-1">
                  <li className="flex items-start gap-2"><Check className="size-4 text-fg-muted shrink-0 mt-0.5" /> Créditos ILIMITADOS</li>
                  <li className="flex items-start gap-2"><Check className="size-4 text-fg-muted shrink-0 mt-0.5" /> Múltiplas marcas configuráveis</li>
                </ul>
                <Button onClick={handleComingSoon} variant="outline" className="w-full mt-6 border-border-strong text-fg-primary hover:bg-surface-3 rounded-xl h-11 font-semibold">Assinar Agência</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}