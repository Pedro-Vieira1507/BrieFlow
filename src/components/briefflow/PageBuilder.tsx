// src/components/briefflow/PageBuilder.tsx
import { DesignExporter } from "./DesignExporter";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { isSupabaseConfigured, saveAssetToLibrary } from "@/lib/supabase";

import { BuilderHeader } from "./builder/BuilderHeader";
import { GeneratingBanner } from "./builder/GeneratingBanner";
import { DiscoveryPlanView } from "./builder/DiscoveryPlanView";
import { BuilderEmptyState } from "./builder/BuilderEmptyState";
import { CampaignTabs } from "./builder/CampaignTabs";

import type { BuilderState, CampaignAsset } from "@/types/builder";

interface Props {
  onRefine: (prompt: string) => void;
  onRetry: (channel: CampaignAsset["type"]) => void | Promise<void>;
  onOpenSettings?: () => void;
  onOpenChat?: () => void;
}

export function PageBuilder({ onRefine, onRetry, onOpenSettings, onOpenChat }: Props) {
  const {
    user,
    builder,
    loading,
    generatingLabel,
    patchBuilder,
    setAuthOpen,
    setBuilder,
  } = useBriefflowStore();

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
      setAuthOpen(true);
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
    <div className="flex h-full min-h-0 flex-col bg-transparent">
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
          "builder-scroll relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-10 xl:px-12",
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

        <div className="relative mx-auto max-w-6xl space-y-8 pb-32 lg:space-y-10 lg:pb-24">
          {loading && generatingLabel && builder.type === "campaign" && (
            <GeneratingBanner label={generatingLabel} />
          )}

          {builder.type === "campaign" && builder.campaignAssets && (
            <div className="fade-in-up">
              <CampaignTabs
                assets={builder.campaignAssets}
                onAssetChange={handleAssetPatch}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                loading={loading}
                onRetry={onRetry}
              />
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

          {builder.type === "none" && (
            <BuilderEmptyState onOpenChat={onOpenChat} />
          )}
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
