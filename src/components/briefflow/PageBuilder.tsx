// components/briefflow/PageBuilder.tsx
import { useState, useEffect } from "react";
import type { BuilderState, CampaignAsset } from "@/types/builder";
import { EmailPreview } from "./EmailPreview";
import { SocialPreview } from "./SocialPreview";
import { BannerPreview } from "./BannerPreview";
import { Editable } from "./Editable";
import { Button } from "@/components/ui/button";
import { Sparkles, BarChart, Save, Loader2, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { saveAssetToLibrary } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  loading?: boolean;
  onRefine: (prompt: string) => void;
  scores?: { persuasion: number; clarity: number; seo: number };
}

const safeRenderText = (content: any): string => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    return Object.entries(content).map(([k, v]) => `• ${v}`).join("\n");
  }
  return String(content);
};

// 💡 SISTEMA DE ABAS ESTABILIZADO: Só renderiza se a asset existir no array!
function CampaignTabs({ assets }: { assets: CampaignAsset[] }) {
  const hasBanner = assets.some(a => a.type === 'banner');
  const hasEmail = assets.some(a => a.type === 'email');
  const hasSocial = assets.some(a => a.type === 'social');

  const [activeTab, setActiveTab] = useState("banner");

  useEffect(() => {
     if (hasSocial) setActiveTab("social");
     else if (hasEmail) setActiveTab("email");
     else if (hasBanner) setActiveTab("banner");
  }, [assets.length]);

  return (
     <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
       <TabsList className="grid w-full grid-cols-3 h-14 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-xl mb-6 shadow-inner">
         <TabsTrigger value="banner" disabled={!hasBanner} className="rounded-lg font-bold tracking-wide uppercase text-[10px] sm:text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm disabled:opacity-40">
            {hasBanner ? "Banner" : "⏳ Criando Banner..."}
         </TabsTrigger>
         <TabsTrigger value="email" disabled={!hasEmail} className="rounded-lg font-bold tracking-wide uppercase text-[10px] sm:text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm disabled:opacity-40">
            {hasEmail ? "E-mail Mkt" : "⏳ E-mail..."}
         </TabsTrigger>
         <TabsTrigger value="social" disabled={!hasSocial} className="rounded-lg font-bold tracking-wide uppercase text-[10px] sm:text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm disabled:opacity-40">
            {hasSocial ? "Post Social" : "⏳ Social..."}
         </TabsTrigger>
       </TabsList>
       
       {assets.map(asset => (
         <TabsContent key={asset.id} value={asset.type} className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0 w-full">
             <div className="p-4 sm:p-8 border border-border/60 rounded-3xl bg-white dark:bg-[#0c0c0e] shadow-sm relative group overflow-hidden w-full">
                 {asset.type === 'email' && <EmailPreview state={asset.content} onChange={() => {}} />}
                 {asset.type === 'banner' && <BannerPreview state={asset.content} onChange={() => {}} />}
                 {asset.type === 'social' && <SocialPreview state={asset.content} onChange={() => {}} />}
             </div>
         </TabsContent>
       ))}
     </Tabs>
  );
}

export function PageBuilder({ state, onChange, loading, onRefine, scores }: Props) {
  const hasContent = state.type !== "none";
  const isSaveable = hasContent && state.type !== "discovery_plan";
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  useEffect(() => {
    if (!loading) setIsGeneratingCampaign(false);
  }, [loading]);

  const handleSaveToLibrary = async () => {
    if (!state.title) return toast.error("O ativo precisa ter um título.");
    setIsSaving(true);
    try {
      await saveAssetToLibrary(state.title, state);
      toast.success("Ativo salvo!");
    } catch { toast.error("Erro ao salvar."); } 
    finally { setIsSaving(false); }
  };

  return (
    <div className="flex h-full flex-col relative bg-background transition-colors">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-8 py-5 backdrop-blur-md z-10 sticky top-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold tracking-tight text-foreground">Workspace de Criação</h2>
            <p className="truncate text-xs font-medium text-muted-foreground">Estratégia e Assets em Tempo Real</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
           <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)} className="rounded-full">
             {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
           </Button>

           {scores && isSaveable && (
               <div className="hidden md:flex items-center gap-4 mx-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-x border-border/50 px-4 h-8">
                   <span className="flex items-center gap-1.5"><BarChart className="size-3.5 text-emerald-500"/> {scores.persuasion}</span>
                   <span className="flex items-center gap-1.5"><BarChart className="size-3.5 text-blue-500"/> {scores.clarity}</span>
               </div>
           )}
          
          <Button variant="outline" size="sm" disabled={!isSaveable || loading || isSaving} onClick={handleSaveToLibrary} className="font-semibold shadow-sm border-border disabled:opacity-30">
            {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Salvar
          </Button>
        </div>
      </header>
      
      <div className={`flex-1 overflow-y-auto bg-slate-50 dark:bg-[#040405] p-6 lg:p-12 relative transition-colors ${loading && state.type === "discovery_plan" && !isGeneratingCampaign ? "opacity-60 pointer-events-none" : ""}`}>
        <div className="mx-auto max-w-5xl"> 
             <div className="space-y-12">
               
              {/* O SISTEMA DE ABAS DA CAMPANHA GERADA */}
              {state.type === "campaign" && state.campaignAssets && (
                  <div className="space-y-8 animate-in fade-in duration-700">
                      <div className="text-center space-y-2 mb-8">
                          <h3 className="font-display text-3xl font-bold tracking-tight text-foreground">Ecossistema de Campanha</h3>
                          <p className="text-muted-foreground text-sm">Os materiais solicitados estão sendo sincronizados abaixo.</p>
                      </div>

                      <CampaignTabs assets={state.campaignAssets} />
                  </div>
              )}

              {/* PLANO DE DESCOBERTA EDITÁVEL */}
              {state.type === "discovery_plan" && state.discoveryPlan && (
                <div className="mx-auto w-full max-w-3xl space-y-6 animate-in fade-in zoom-in-95 duration-500">
                   <div className="mb-8 flex flex-col items-center justify-center text-center">
                      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-inner">
                        <Sparkles className="size-8" />
                      </div>
                      <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">Estratégia Mapeada</h3>
                      <p className="mt-2 text-sm text-muted-foreground">Acompanhe a construção do contexto ou clique para editar.</p>
                   </div>

                   <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
                         <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Contexto Consolidado</h4>
                         <Editable
                            as="p"
                            multiline
                            value={safeRenderText(state.discoveryPlan.detectedContext)}
                            onChange={(v) => onChange({ discoveryPlan: { ...state.discoveryPlan!, detectedContext: v } })}
                            className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line"
                         />
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
                         <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">Em Qualificação</h4>
                         <Editable
                            as="p"
                            multiline
                            value={safeRenderText(state.discoveryPlan.missingInfo)}
                            onChange={(v) => onChange({ discoveryPlan: { ...state.discoveryPlan!, missingInfo: v } })}
                            className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line"
                         />
                      </div>
                   </div>
                   
                   <div className="rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">Proposta de Execução</h4>
                       <Editable
                          as="p"
                          multiline
                          value={safeRenderText(state.discoveryPlan.proposedStrategy)}
                          onChange={(v) => onChange({ discoveryPlan: { ...state.discoveryPlan!, proposedStrategy: v } })}
                          className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line"
                       />
                   </div>

                   <div className="flex justify-end pt-4">
                      <Button 
                         onClick={() => {
                            setIsGeneratingCampaign(true);
                            onRefine("Aprovado. Gere os materiais do ecossistema agora. Foque em copy consultiva e elegante.");
                         }} 
                         disabled={loading}
                         className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 h-11 px-8 shadow-lg hover:scale-105 transition-transform"
                      >
                         {isGeneratingCampaign ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                         {isGeneratingCampaign ? "Orquestrando I.A..." : "Aprovar & Iniciar Geração"}
                      </Button>
                   </div>
                </div>
              )}

              {state.type === "none" && <EmptyState />}
             </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[65vh] flex-col items-center justify-center text-center">
      <div className="mb-8 grid size-24 place-items-center rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl">
        <Sparkles className="size-10" />
      </div>
      <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">Aguardando Início</h3>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        Selecione um cenário no chat ao lado para darmos início à qualificação estratégica e construção das peças.
      </p>
    </div>
  );
}