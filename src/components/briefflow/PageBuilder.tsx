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
import { isSupabaseConfigured, saveAssetToLibrary } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  if (typeof content === "object" && content !== null) {
    return Object.entries(content as Record<string, unknown>)
      .map(([, v]) => `• ${String(v)}`)
      .join("\n");
  }
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
  const hasBanner = assets.some((a) => a.type === "banner");
  const hasEmail = assets.some((a) => a.type === "email");
  const hasSocial = assets.some((a) => a.type === "social");

  const defaultTab =
    assets.find((a) => a.type === "banner")?.type ||
    assets.find((a) => a.type === "email")?.type ||
    assets.find((a) => a.type === "social")?.type ||
    "banner";

  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const latest = assets[assets.length - 1];
    if (latest) setActiveTab(latest.type);
  }, [assets.length]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 h-14 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-xl mb-6 shadow-inner">
        <TabsTrigger
          value="banner"
          disabled={!hasBanner}
          className="rounded-lg font-bold tracking-wide uppercase text-[10px] sm:text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm disabled:opacity-40"
        >
          {hasBanner ? "Banner" : "Banner..."}
        </TabsTrigger>
        <TabsTrigger
          value="email"
          disabled={!hasEmail}
          className="rounded-lg font-bold tracking-wide uppercase text-[10px] sm:text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm disabled:opacity-40"
        >
          {hasEmail ? "E-mail Mkt" : "E-mail..."}
        </TabsTrigger>
        <TabsTrigger
          value="social"
          disabled={!hasSocial}
          className="rounded-lg font-bold tracking-wide uppercase text-[10px] sm:text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm disabled:opacity-40"
        >
          {hasSocial ? "Post Social" : "Social..."}
        </TabsTrigger>
      </TabsList>

      {assets.map((asset) => (
        <TabsContent
          key={asset.id}
          value={asset.type}
          className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0 w-full"
        >
          <div className="p-4 sm:p-8 border border-border/60 rounded-3xl bg-white dark:bg-[#0c0c0e] shadow-sm relative group overflow-hidden w-full">
            <AssetPreview
              type={asset.type}
              content={asset.content}
              onChange={(patch) => onAssetChange(asset.id, patch)}
            />
          </div>
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
    (state.type === "campaign"
      ? Boolean(state.campaignAssets?.length)
      : true);

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
    if (!isSupabaseConfigured) {
      return toast.error("Biblioteca não configurada (Supabase).");
    }
    const name =
      state.title ||
      state.campaignAssets?.[0]?.content?.title ||
      state.discoveryPlan?.brandName ||
      "Peça BrieFlow";
    setIsSaving(true);
    try {
      await saveAssetToLibrary(name, state);
      toast.success("Ativo salvo na biblioteca!");
    } catch {
      toast.error("Erro ao salvar o ativo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssetChange = (assetId: string, patch: Partial<BuilderState>) => {
    const next = (state.campaignAssets ?? []).map((asset) =>
      asset.id === assetId
        ? { ...asset, content: { ...asset.content, ...patch } }
        : asset,
    );
    onChange({ campaignAssets: next });
  };

  const showSingleAsset =
    state.type === "email" || state.type === "social" || state.type === "banner";

  return (
    <div className="flex h-full flex-col relative bg-background transition-colors">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-8 py-5 backdrop-blur-md z-10 sticky top-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold tracking-tight text-foreground">
              Painel de Peças
            </h2>
            <p className="truncate text-xs font-medium text-muted-foreground">
              Preview premium em tempo real
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="rounded-full"
          >
            {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {scores && isSaveable && (
            <div className="hidden md:flex items-center gap-4 mx-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-x border-border/50 px-4 h-8">
              <span className="flex items-center gap-1.5">
                <BarChart className="size-3.5 text-emerald-500" /> {scores.persuasion}
              </span>
              <span className="flex items-center gap-1.5">
                <BarChart className="size-3.5 text-blue-500" /> {scores.clarity}
              </span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={!isSaveable || loading || isSaving}
            onClick={handleSaveToLibrary}
            className="font-semibold shadow-sm border-border disabled:opacity-30"
          >
            {isSaving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Salvar
          </Button>
        </div>
      </header>

      <div
        className={`flex-1 overflow-y-auto bg-slate-50 dark:bg-[#040405] p-6 lg:p-12 relative transition-colors ${
          loading && state.type === "discovery_plan" && !isGeneratingCampaign
            ? "opacity-60 pointer-events-none"
            : ""
        }`}
      >
        <div className="mx-auto max-w-5xl">
          <div className="space-y-12">
            {loading && generatingLabel && state.type === "campaign" && (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/50 bg-white/80 dark:bg-slate-900/80 px-6 py-4 shadow-sm">
                <Loader2 className="size-5 animate-spin text-slate-500" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {generatingLabel}
                </p>
              </div>
            )}

            {state.type === "campaign" && state.campaignAssets && (
              <div className="space-y-8 animate-in fade-in duration-700">
                <div className="text-center space-y-2 mb-8">
                  <h3 className="font-display text-3xl font-bold tracking-tight text-foreground">
                    Peças da Campanha
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Qualidade premium — clique nos textos para editar.
                  </p>
                </div>
                <CampaignTabs
                  assets={state.campaignAssets}
                  onAssetChange={handleAssetChange}
                />
              </div>
            )}

            {showSingleAsset && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="text-center space-y-2">
                  <h3 className="font-display text-2xl font-bold tracking-tight capitalize">
                    {state.type === "email"
                      ? "E-mail Marketing"
                      : state.type === "social"
                        ? "Post Social"
                        : "Banner"}
                  </h3>
                </div>
                <div className="p-4 sm:p-8 border border-border/60 rounded-3xl bg-white dark:bg-[#0c0c0e] shadow-sm">
                  <AssetPreview
                    type={state.type}
                    content={state}
                    onChange={onChange}
                  />
                </div>
              </div>
            )}

            {state.type === "discovery_plan" && state.discoveryPlan && (
              <div className="mx-auto w-full max-w-3xl space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="mb-8 flex flex-col items-center justify-center text-center">
                  <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-inner dark:bg-indigo-950 dark:text-indigo-300">
                    <Sparkles className="size-8" />
                  </div>
                  <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">
                    Briefing Criativo
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Acompanhe o que o agente coletou. Edite se precisar e aprove para
                    gerar as peças.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                      Contexto consolidado
                    </h4>
                    <Editable
                      as="p"
                      multiline
                      value={safeRenderText(state.discoveryPlan.detectedContext)}
                      onChange={(v) =>
                        onChange({
                          discoveryPlan: {
                            ...state.discoveryPlan!,
                            detectedContext: v,
                          },
                        })
                      }
                      className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line"
                    />
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">
                      Ainda em qualificação
                    </h4>
                    <Editable
                      as="p"
                      multiline
                      value={safeRenderText(state.discoveryPlan.missingInfo)}
                      onChange={(v) =>
                        onChange({
                          discoveryPlan: {
                            ...state.discoveryPlan!,
                            missingInfo: v,
                          },
                        })
                      }
                      className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">
                    Proposta de peças
                  </h4>
                  <Editable
                    as="p"
                    multiline
                    value={safeRenderText(state.discoveryPlan.proposedStrategy)}
                    onChange={(v) =>
                      onChange({
                        discoveryPlan: {
                          ...state.discoveryPlan!,
                          proposedStrategy: v,
                        },
                      })
                    }
                    className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line"
                  />
                </div>

                {(state.discoveryPlan.brandName ||
                  state.discoveryPlan.audience ||
                  state.discoveryPlan.offer) && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {state.discoveryPlan.brandName && (
                      <div className="rounded-xl border border-border/40 bg-white dark:bg-slate-900 px-4 py-3 text-xs">
                        <p className="uppercase tracking-widest text-slate-400 mb-1">
                          Marca
                        </p>
                        <p className="font-semibold text-foreground">
                          {state.discoveryPlan.brandName}
                        </p>
                      </div>
                    )}
                    {state.discoveryPlan.audience && (
                      <div className="rounded-xl border border-border/40 bg-white dark:bg-slate-900 px-4 py-3 text-xs">
                        <p className="uppercase tracking-widest text-slate-400 mb-1">
                          Público
                        </p>
                        <p className="font-semibold text-foreground">
                          {state.discoveryPlan.audience}
                        </p>
                      </div>
                    )}
                    {state.discoveryPlan.offer && (
                      <div className="rounded-xl border border-border/40 bg-white dark:bg-slate-900 px-4 py-3 text-xs">
                        <p className="uppercase tracking-widest text-slate-400 mb-1">
                          Oferta
                        </p>
                        <p className="font-semibold text-foreground">
                          {state.discoveryPlan.offer}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => {
                      setIsGeneratingCampaign(true);
                      onRefine(
                        "Aprovado. Gere os materiais do ecossistema agora. Foque em copy consultiva, elegante e premium.",
                      );
                    }}
                    disabled={loading}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 h-11 px-8 shadow-lg hover:scale-105 transition-transform"
                  >
                    {isGeneratingCampaign ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    {isGeneratingCampaign
                      ? "Gerando peças premium..."
                      : "Aprovar & Gerar Peças"}
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
      <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">
        Painel pronto
      </h3>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        Converse com o agente, cole o site da marca e as peças premium (banner, e-mail
        e posts) aparecerão aqui com qualidade profissional.
      </p>
    </div>
  );
}
