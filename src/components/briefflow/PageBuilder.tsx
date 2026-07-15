import { useState, useEffect } from "react";
import type { BuilderState } from "@/types/builder";
import { EmailPreview } from "./EmailPreview";
import { SocialPreview } from "./SocialPreview";
import { BannerPreview } from "./BannerPreview";
import { Button } from "@/components/ui/button";
import { FileText, Mail, Sparkles, Wand2, Scissors, Zap, BarChart, Save, Loader2, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { saveAssetToLibrary } from "@/lib/supabase";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  loading?: boolean;
  onRefine: (prompt: string) => void;
  scores?: { persuasion: number; clarity: number; seo: number };
}

function toPlainText(s: BuilderState): string {
  return [s.title, s.subtitle, s.body, s.caption, s.cta, s.hashtags?.join(" ")].filter(Boolean).join("\n\n");
}

function exportToGmail(s: BuilderState) {
  const subject = encodeURIComponent(s.title ?? "Campanha BrieFlow");
  const body = encodeURIComponent(toPlainText(s));
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, "_blank");
}

function exportToDocs(s: BuilderState) {
  navigator.clipboard.writeText(toPlainText(s)).then(() => {
    toast.success("Conteúdo copiado. Cole no Google Docs (Ctrl+V).");
    window.open("https://docs.google.com/document/create", "_blank");
  });
}

// FUNÇÃO SALVA-VIDAS: Impede o React de quebrar caso a IA retorne objetos aninhados onde deveria ser texto puro
const safeRenderText = (content: any): string => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    return Object.entries(content)
      .map(([key, value]) => `• ${key}: ${value}`)
      .join("\n");
  }
  return String(content);
};

export function PageBuilder({ state, onChange, loading, onRefine, scores }: Props) {
  const hasContent = state.type !== "none";
  const [isSaving, setIsSaving] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Efeito para alternar a classe .dark no HTML dinamicamente
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const handleSaveToLibrary = async () => {
    if (!state.title) {
      toast.error("O ativo precisa ter um título para ser salvo.");
      return;
    }
    
    setIsSaving(true);
    try {
      await saveAssetToLibrary(state.title, state);
      toast.success("Ativo salvo na sua Biblioteca com sucesso!");
    } catch (error) {
      toast.error("Falha ao salvar no banco de dados.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col relative bg-background transition-colors">
      
      {/* HEADER DE COMANDOS */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-8 py-5 backdrop-blur-md z-10 sticky top-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold tracking-tight text-foreground">Workspace</h2>
            <p className="truncate text-xs font-medium text-muted-foreground">Clique nos elementos para edição inline</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
           
           {/* DARK MODE TOGGLE */}
           <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)} className="rounded-full">
             {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
           </Button>

           {/* SCORING SIMULADO DE PERFOMANCE */}
           {scores && (
               <div className="hidden md:flex items-center gap-4 mx-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-x border-border/50 px-4 h-8">
                   <span className="flex items-center gap-1.5" title="Persuasão"><BarChart className="size-3.5 text-emerald-500"/> {scores.persuasion}</span>
                   <span className="flex items-center gap-1.5" title="Clareza"><BarChart className="size-3.5 text-blue-500"/> {scores.clarity}</span>
               </div>
           )}
          
          <Button variant="outline" size="sm" disabled={!hasContent || loading || isSaving} onClick={handleSaveToLibrary} className="font-semibold shadow-sm transition-all hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 border-border">
            {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Salvar Asset
          </Button>

          <Button variant="outline" size="sm" disabled={!hasContent || loading} onClick={() => exportToGmail(state)} className="shadow-sm border-border">
            <Mail className="mr-2 size-4" /> Gmail
          </Button>
          <Button size="sm" disabled={!hasContent || loading} onClick={() => exportToDocs(state)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-md hover:scale-[1.02] transition-transform disabled:hover:scale-100">
            <FileText className="mr-2 size-4" /> Docs
          </Button>
        </div>
      </header>
      
      {/* CANVAS DE CONTEÚDO */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#040405] p-6 lg:p-12 relative transition-colors">
        <div className="mx-auto max-w-5xl"> 
          {loading ? (
            <div className="animate-pulse space-y-6">
              <div className="h-[300px] w-full rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-5 shadow-sm">
                 <Skeleton className="h-5 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-md" />
                 <Skeleton className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              </div>
            </div>
          ) : (
            <div className="space-y-12"> 
              
              {/* ASSETS INDIVIDUAIS */}
              {state.type === "email" && <EmailPreview state={state} onChange={onChange} />}
              {state.type === "social" && <SocialPreview state={state} onChange={onChange} />}
              {state.type === "banner" && <BannerPreview state={state} onChange={onChange} />}
              
              {/* MODO CAMPANHA 360 (LISTA DE ASSETS) */}
              {state.type === "campaign" && (
                  <div className="space-y-10">
                      <h3 className="font-display text-2xl font-bold tracking-tight border-b border-border/50 pb-4 text-foreground">Campanha Gerada</h3>
                      {state.campaignAssets?.map(asset => (
                          <div key={asset.id} className="p-6 md:p-8 border border-border/60 rounded-2xl bg-white dark:bg-[#0c0c0e] shadow-sm relative group overflow-hidden">
                               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800" />
                               <div className="flex items-center justify-between mb-6">
                                 <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full">{asset.type}</div>
                               </div>
                               {asset.type === 'email' && <EmailPreview state={asset.content} onChange={() => {}} />}
                               {asset.type === 'banner' && <BannerPreview state={asset.content} onChange={() => {}} />}
                               {asset.type === 'social' && <SocialPreview state={asset.content} onChange={() => {}} />}
                          </div>
                      ))}
                  </div>
              )}

              {/* MODO DESCOBERTA (O PLANO ESTRATÉGICO DO AGENTE ANTES DE GERAR) */}
              {state.type === "discovery_plan" && state.discoveryPlan && (
                <div className="mx-auto w-full max-w-3xl space-y-6 animate-in fade-in zoom-in-95 duration-500">
                   <div className="mb-8 flex flex-col items-center justify-center text-center">
                      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 shadow-inner">
                        <Sparkles className="size-8" />
                      </div>
                      <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">Plano Estratégico Pronto</h3>
                      <p className="mt-2 text-sm text-muted-foreground">O agente investigou sua marca e propõe o seguinte ecossistema.</p>
                   </div>

                   <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
                         <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Contexto Detectado</h4>
                         {/* Utilizando o safeRenderText para blindar a UI contra JSON malformado da IA */}
                         <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">{safeRenderText(state.discoveryPlan.detectedContext)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
                         <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">O que precisamos confirmar</h4>
                         <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">{safeRenderText(state.discoveryPlan.missingInfo)}</p>
                      </div>
                   </div>
                   
                   <div className="rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">Assets Recomendados</h4>
                       <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">{safeRenderText(state.discoveryPlan.proposedStrategy)}</p>
                   </div>

                   <div className="flex justify-end pt-4">
                      {/* O botão que ordena a IA a sair do estado de descoberta e ir para execução */}
                      <Button onClick={() => onRefine("Plano Aprovado. Por favor, crie e gere todos os assets da campanha conforme proposto.")} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 h-11 px-8 shadow-lg hover:scale-105 transition-transform">
                         Aprovar & Gerar Campanha
                      </Button>
                   </div>
                </div>
              )}

              {/* CANVAS VAZIO */}
              {state.type === "none" && <EmptyState />}
            </div>
          )}
        </div>
      </div>

      {/* BARRA FLUTUANTE DE REFINAMENTO RÁPIDO (Apenas para Assets/Campanhas, não para o Plano) */}
      {hasContent && state.type !== "discovery_plan" && !loading && (
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/95 dark:bg-white/95 backdrop-blur-md p-1.5 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/5 animate-in slide-in-from-bottom-8">
           <div className="px-4 text-[11px] font-bold tracking-widest text-slate-300 dark:text-slate-600 flex items-center gap-2 border-r border-slate-700 dark:border-slate-300 uppercase">
             <Wand2 className="size-3.5 text-white dark:text-slate-900" /> IA
           </div>
           <Button variant="ghost" size="sm" onClick={() => onRefine("Mantenha a mesma arte, mas escreva textos mais curtos e diretos.")} className="h-9 rounded-full text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-900 transition-colors">
             <Scissors className="mr-2 size-3.5" /> Encurtar Texto
           </Button>
           <Button variant="ghost" size="sm" onClick={() => onRefine("Mantenha a mesma arte, mas mude as copys usando gatilhos mentais fortes de escassez e urgência para ser muito mais persuasivo.")} className="h-9 rounded-full text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-900 transition-colors">
             <Zap className="mr-2 size-3.5 text-amber-400 dark:text-amber-500" /> Mais Persuasivo
           </Button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[65vh] flex-col items-center justify-center text-center">
      <div className="mb-8 grid size-24 place-items-center rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl ring-1 ring-border/50">
        <Sparkles className="size-10" />
      </div>
      <h3 className="font-display text-3xl font-bold tracking-tight text-foreground">Peça uma campanha no chat</h3>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
        Use o painel lateral para definir a sua intenção de campanha. O agente analisará seu Brand Kit, propondo um plano estratégico antes de gerar os ativos.
      </p>
    </div>
  );
}