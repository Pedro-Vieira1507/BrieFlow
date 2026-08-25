// src/components/briefflow/PageBuilder.tsx
import { DesignExporter } from "./DesignExporter";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { isSupabaseConfigured, saveAssetToLibrary } from "@/lib/supabase";

import { BuilderHeader } from "./builder/BuilderHeader";
import { GeneratingBanner } from "./builder/GeneratingBanner";
import { BannerPreview } from "./BannerPreview";
import { EmailPreview } from "./EmailPreview";
import { SocialPreview } from "./SocialPreview";
import { DiscoveryPlanView } from "./builder/DiscoveryPlanView";
import { BuilderEmptyState } from "./builder/BuilderEmptyState";

import type { BuilderState, CampaignAsset } from "@/types/builder";

import { Monitor, Mail, Instagram } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  onRefine: (prompt: string) => void;
  onOpenSettings?: () => void;
}

export function PageBuilder({ onRefine, onOpenSettings }: Props) {
  const { user, builder, loading, generatingLabel, patchBuilder, setBuilder } =
    useBriefflowStore();

  const [activeTab, setActiveTab] = useState<CampaignAsset["type"]>("banner");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [designExporterOpen, setDesignExporterOpen] = useState(false);

  const isSavingRef = useRef(false);

  const hasContent = builder.type !== "none";
  const isSaveable =
    hasContent &&
    builder.type !== "discovery_plan" &&
    (builder.type === "campaign"
      ? Boolean(builder.campaignAssets?.length)
      : true);

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      toast.error("Biblioteca não configurada");
      return;
    }
    if (!user) {
      toast.error("Acesso restrito", {
        description:
          "Faça login no perfil no topo da tela para salvar sua campanha.",
      });
      return;
    }
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const toastId = toast.loading("Salvando campanha na biblioteca...");
    try {
      await saveAssetToLibrary("Campanha AI", builder);
      toast.success("Salvo na biblioteca com sucesso!", { id: toastId });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar a campanha", { id: toastId });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleExportClick = () => {
    setDesignExporterOpen(true);
  };

  const handleAssetPatch = (assetId: string, patch: Partial<BuilderState>) => {
    if (builder.type !== "campaign" || !builder.campaignAssets) return;
    const next = builder.campaignAssets.map((a) =>
      a.id === assetId ? { ...a, content: { ...a.content, ...patch } } : a,
    );
    setBuilder({ ...builder, campaignAssets: next });
  };

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <BuilderHeader
        isSaveable={isSaveable}
        isSaving={isSaving}
        isExporting={isExporting}
        loading={loading}
        onExport={handleExportClick}
        onSave={handleSave}
        onOpenSettings={onOpenSettings}
      />

      <div
        className={cn(
          "relative flex-1 overflow-y-auto p-6 lg:p-12",
          loading && builder.type === "discovery_plan"
            ? "pointer-events-none opacity-60"
            : "",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "var(--gradient-radial-brand)" }}
        />

        <div className="relative mx-auto max-w-5xl space-y-10 pb-40">
          {loading && generatingLabel && builder.type === "campaign" && (
            <GeneratingBanner label={generatingLabel} />
          )}

          {builder.type === "campaign" && builder.campaignAssets && (
            <div className="fade-in-up">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as CampaignAsset["type"])}
                className="w-full"
              >
                <div className="flex justify-center mb-8">
                  <TabsList className="bg-surface-2 border border-border-subtle p-1 h-12 w-full max-w-[400px]">
                    <TabsTrigger
                      value="banner"
                      className="flex-1 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-brand data-[state=active]:text-white transition-all duration-200"
                    >
                      <Monitor className="size-3.5 mr-2" /> Banner
                    </TabsTrigger>
                    <TabsTrigger
                      value="email"
                      className="flex-1 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-brand data-[state=active]:text-white transition-all duration-200"
                    >
                      <Mail className="size-3.5 mr-2" /> E-mail
                    </TabsTrigger>
                    <TabsTrigger
                      value="social"
                      className="flex-1 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-brand data-[state=active]:text-white transition-all duration-200"
                    >
                      <Instagram className="size-3.5 mr-2" /> Social
                    </TabsTrigger>
                  </TabsList>
                </div>

                {builder.campaignAssets.map((asset) => (
                  <TabsContent
                    key={asset.id}
                    value={asset.type}
                    className="mt-0 outline-none animate-in fade-in duration-300"
                  >
                    {asset.type === "banner" && (
                      <BannerPreview
                        state={asset.content}
                        onChange={(patch) => handleAssetPatch(asset.id, patch)}
                      />
                    )}
                    {asset.type === "email" && (
                      <EmailPreview
                        state={asset.content}
                        onChange={(patch) => handleAssetPatch(asset.id, patch)}
                      />
                    )}
                    {asset.type === "social" && (
                      <SocialPreview
                        state={asset.content}
                        onChange={(patch) => handleAssetPatch(asset.id, patch)}
                      />
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          {builder.type === "discovery_plan" && builder.discoveryPlan && (
            <DiscoveryPlanView
              plan={builder.discoveryPlan}
              loading={loading}
              onPatch={patchBuilder}
              onApprove={() =>
                onRefine(
                  "Aprovado. Gere os materiais do ecossistema agora. Seja um designer criativo.",
                )
              }
            />
          )}

          {builder.type === "none" && <BuilderEmptyState />}
        </div>
      </div>

      <DesignExporter
        open={designExporterOpen}
        onOpenChange={setDesignExporterOpen}
        state={builder}
        initialTab={activeTab}
        onExportingChange={setIsExporting}
      />
    </div>
  );
}
