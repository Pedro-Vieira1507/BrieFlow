import { useState, useEffect } from "react";
import type { BuilderState, CampaignAsset } from "@/types/builder";
import { EmailPreview } from "./EmailPreview";
import { SocialPreview } from "./SocialPreview";
import { BannerPreview } from "./BannerPreview";
import { Editable } from "./Editable";
import { Button } from "@/components/ui/button";
import { Sparkles, Save, Loader2, Download, SearchCheck, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured, saveAssetToLibrary } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  loading?: boolean;
  onRefine: (prompt: string) => void;
  scores?: { persuasion: number; clarity: number; seo: number };
  generatingLabel?: string;
}

const safeRenderText = (content: unknown): string => {
  if (!content) return "";
  if (typeof content === "string") return content;
  return String(content);
};

function AssetPreview({
  type,
  content,
  onChange,
}: {
  type: "email" | "social" | "banner";
  content: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}) {
  if (type === "email") return <EmailPreview state={content} onChange={onChange} />;
  if (type === "banner") return <BannerPreview state={content} onChange={onChange} />;
  return <SocialPreview state={content} onChange={onChange} />;
}

function CampaignTabs({
  assets,
  onAssetChange,
}: {
  assets: CampaignAsset[];
  onAssetChange: (assetId: string, patch: Partial<BuilderState>) => void;
}) {
  const defaultTab = assets[0]?.type || "banner";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (assets.length) setActiveTab(assets[assets.length - 1].type);
  }, [assets.length]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 h-14 bg-[#18181B] p-1.5 rounded-2xl mb-8 border border-white/5 shadow-inner">
        <TabsTrigger
          value="banner"
          disabled={!assets.some((a) => a.type === "banner")}
          className="rounded-xl font-bold tracking-wide uppercase text-[10px] data-[state=active]:bg-[#27272A] data-[state=active]:text-white text-white/50"
        >
          Banner
        </TabsTrigger>
        <TabsTrigger
          value="email"
          disabled={!assets.some((a) => a.type === "email")}
          className="rounded-xl font-bold tracking-wide uppercase text-[10px] data-[state=active]:bg-[#27272A] data-[state=active]:text-white text-white/50"
        >
          E-mail
        </TabsTrigger>
        <TabsTrigger
          value="social"
          disabled={!assets.some((a) => a.type === "social")}
          className="rounded-xl font-bold tracking-wide uppercase text-[10px] data-[state=active]:bg-[#27272A] data-[state=active]:text-white text-white/50"
        >
          Social
        </TabsTrigger>
      </TabsList>
      {assets.map((asset) => (
        <TabsContent
          key={asset.id}
          value={asset.type}
          className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0 w-full"
        >
          <AssetPreview
            type={asset.type}
            content={asset.content}
            onChange={(patch) => onAssetChange(asset.id, patch)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function PageBuilder({
  state,
  onChange,
  loading,
  onRefine,
  scores,
  generatingLabel,
}: Props) {
  const hasContent = state.type !== "none";
  const isSaveable =
    hasContent &&
    state.type !== "discovery_plan" &&
    (state.type === "campaign" ? Boolean(state.campaignAssets?.length) : true);
  const [isSaving, setIsSaving] = useState(false);

  // For a Dark Mode global (Glassmorphism AI Look)
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleSaveToLibrary = async () => {
    if (!isSupabaseConfigured) return toast.error("Biblioteca não configurada.");
    setIsSaving(true);
    try {
      await saveAssetToLibrary("Campanha AI", state);
      toast.success("Salvo na biblioteca!");
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col relative bg-[#050505]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[#09090B]/80 px-8 py-5 backdrop-blur-xl z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 border border-white/10 text-white">
            <img
              src="/assets/icone-brieflow.png"
              alt="BrieFlow Logo"
              className="size-8"
            />
          </div>
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-white">
              Painel de Peças
            </h2>
            <p className="text-[11px] font-medium text-white/40 uppercase tracking-widest">
              Live Preview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {scores && isSaveable && (
            <TooltipProvider>
              <div className="hidden md:flex items-center gap-4 mx-2 text-[11px] font-bold uppercase tracking-wider text-white/50 border-x border-white/10 px-4 h-8">
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-rose-500" /> {scores.persuasion}
                  </TooltipTrigger>
                  <TooltipContent>Índice de Persuasão da Copy</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1.5">
                    <SearchCheck className="size-3.5 text-blue-500" /> {scores.clarity}
                  </TooltipTrigger>
                  <TooltipContent>Clareza e Legibilidade</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("Download iniciado! (Mock)")}
            disabled={!isSaveable}
            className="border-white/10 bg-transparent text-white hover:bg-white/5"
          >
            <Download className="mr-2 size-3.5" /> Exportar
          </Button>
          <Button
            size="sm"
            disabled={!isSaveable || loading || isSaving}
            onClick={handleSaveToLibrary}
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
          >
            {isSaving ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-2 size-3.5" />
            )} Salvar
          </Button>
        </div>
      </header>
      <div className={`flex-1 overflow-y-auto p-6 lg:p-12 relative ${loading && state.type === "discovery_plan" ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="mx-auto max-w-5xl">
          <div className="space-y-12">
            {loading && generatingLabel && state.type === "campaign" && (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-6 py-4 backdrop-blur-md">
                <Loader2 className="size-5 animate-spin text-blue-400" />
                <p className="text-sm font-bold tracking-wide text-blue-100">{generatingLabel}</p>
              </div>
            )}
            
            {state.type === "campaign" && state.campaignAssets && (
              <div className="space-y-8 animate-in fade-in duration-700">
                <CampaignTabs assets={state.campaignAssets} onAssetChange={(id, patch) => {
                  const next = state.campaignAssets!.map(a => a.id === id ? { ...a, content: { ...a.content, ...patch } } : a);
                  onChange({ campaignAssets: next });
                }} />
              </div>
            )}

            {state.type === "discovery_plan" && state.discoveryPlan && (
              <div className="mx-auto w-full max-w-3xl space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="mb-8 flex flex-col items-center justify-center text-center">
                  <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
                    <Sparkles className="size-8" />
                  </div>
                  <h3 className="font-display text-2xl font-bold tracking-tight text-white">Briefing Estruturado</h3>
                  <p className="mt-2 text-sm text-white/50">Edite o que o agente deduziu antes de gerar as artes finais.</p>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/5 bg-[#121215] p-6 shadow-xl">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">Contexto Principal</h4>
                    <Editable as="p" multiline value={safeRenderText(state.discoveryPlan.detectedContext)} onChange={(v) => onChange({ discoveryPlan: { ...state.discoveryPlan!, detectedContext: v }})} className="text-[14px] leading-relaxed text-white/80 whitespace-pre-line" />
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-[#121215] p-6 shadow-xl">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-3">Falta Validar</h4>
                    <Editable as="p" multiline value={safeRenderText(state.discoveryPlan.missingInfo)} onChange={(v) => onChange({ discoveryPlan: { ...state.discoveryPlan!, missingInfo: v }})} className="text-[14px] leading-relaxed text-white/80 whitespace-pre-line" />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={() => onRefine("Aprovado. Gere os materiais do ecossistema agora. Seja um designer criativo.")} disabled={loading} className="bg-white text-black h-12 px-10 font-bold tracking-wide rounded-xl shadow-xl hover:scale-105 transition-transform">
                    Aprovar e Gerar Peças
                  </Button>
                </div>
              </div>
            )}

            {state.type === "none" && (
              <div className="flex h-[60vh] flex-col items-center justify-center text-center opacity-40">
                <Sparkles className="size-12 mb-4 text-white" />
                <h3 className="text-xl font-bold text-white">Área de Criação</h3>
                <p className="text-sm mt-2">O preview das peças aparecerá aqui.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}