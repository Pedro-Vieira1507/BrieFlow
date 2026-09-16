// src/components/briefflow/PageBuilder.tsx
import { DesignExporter } from "./DesignExporter";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import {
  isSupabaseConfigured,
  saveAssetToLibrary,
  uploadFinalReel,
} from "@/lib/supabase";
import { getBuilderCampaignBrandName } from "@/lib/campaignGeneration";
import { downloadBlob, sanitizeFilenamePart } from "@/lib/export-utils";
import {
  exportSlidesPowerPoint,
  exportTechnicalSheetPdf,
} from "@/lib/documentExport";
import { formatStructuredContentText } from "@/lib/structuredContent";
import { CORE_MATERIAL_TYPES } from "@/types/brief";

import { BuilderHeader } from "./builder/BuilderHeader";
import { GeneratingBanner } from "./builder/GeneratingBanner";
import { DiscoveryPlanView } from "./builder/DiscoveryPlanView";
import { BuilderEmptyState } from "./builder/BuilderEmptyState";
import { CampaignTabs } from "./builder/CampaignTabs";

import type {
  BuilderState,
  CampaignAsset,
  MediaRenderState,
} from "@/types/builder";

interface Props {
  onGenerateCampaign: () => void | Promise<void>;
  onRetry: (channel: CampaignAsset["type"]) => void | Promise<void>;
  onOpenSettings?: () => void;
  onOpenChat?: () => void;
  onOpenContentCatalog?: () => void;
}

export function PageBuilder({
  onGenerateCampaign,
  onRetry,
  onOpenSettings,
  onOpenChat,
  onOpenContentCatalog,
}: Props) {
  const {
    user,
    builder,
    loading,
    generatingLabel,
    patchBuilder,
    setAuthOpen,
    activeLibraryAssetId,
    setActiveLibraryAssetId,
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
      const brandName = getBuilderCampaignBrandName(builder);
      const savedAsset = await saveAssetToLibrary(
        brandName ? `Campanha ${brandName}` : "Campanha AI",
        builder,
        activeLibraryAssetId,
      );
      setActiveLibraryAssetId(savedAsset.id);
      toast.success(
        activeLibraryAssetId
          ? "Campanha atualizada na biblioteca!"
          : "Salvo na biblioteca com sucesso!",
        { id: toastId },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar a campanha",
        { id: toastId },
      );
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleExportClick = async () => {
    if (!(CORE_MATERIAL_TYPES as readonly string[]).includes(activeTab)) {
      const asset =
        builder.type === "campaign"
          ? builder.campaignAssets?.find((entry) => entry.type === activeTab)
          : undefined;
      const document = asset?.content.structuredContent;
      if (!asset || !document) {
        toast.error("Conteúdo não encontrado para exportação.");
        return;
      }

      if (["reel", "video", "podcast"].includes(activeTab)) {
        const media = asset.content.mediaRender;
        if (media?.status !== "ready" || !media.url) {
          toast.error("A mídia final ainda não está pronta para exportação.");
          return;
        }

        setIsExporting(true);
        try {
          const response = await fetch(media.url);
          if (!response.ok) throw new Error("media_download_failed");
          const blob = await response.blob();
          const extension =
            activeTab === "podcast"
              ? media.mimeType?.includes("wav")
                ? "wav"
                : "mp3"
              : media.mimeType?.includes("webm")
                ? "webm"
                : "mp4";
          const brand = asset.content.brandName || document.title;
          downloadBlob(
            blob,
            `${activeTab}_${sanitizeFilenamePart(brand)}.${extension}`,
          );
          toast.success(
            activeTab === "podcast" ? "Podcast exportado." : "Vídeo exportado.",
          );
        } catch {
          toast.error("Não foi possível baixar a mídia final.");
        } finally {
          setIsExporting(false);
        }
        return;
      }

      if (activeTab === "slides" || activeTab === "technical_sheet") {
        setIsExporting(true);
        try {
          if (activeTab === "slides") {
            await exportSlidesPowerPoint(
              document,
              asset.content.brandName,
              asset.content.themeColor,
              asset.content.secondaryColor,
            );
            toast.success("PowerPoint exportado com sucesso.");
          } else {
            await exportTechnicalSheetPdf(
              document,
              asset.content.brandName,
              asset.content.themeColor,
              asset.content.secondaryColor,
            );
            toast.success("Ficha técnica exportada em PDF.");
          }
        } catch (error) {
          console.error("Falha na exportação do documento:", error);
          toast.error("Não foi possível gerar o arquivo final.");
        } finally {
          setIsExporting(false);
        }
        return;
      }

      const brand = asset.content.brandName || document.title;
      downloadBlob(
        new Blob([formatStructuredContentText(document)], {
          type: "text/plain;charset=utf-8",
        }),
        `${activeTab}_${sanitizeFilenamePart(brand)}.txt`,
      );
      toast.success("Conteúdo exportado em TXT.");
      return;
    }
    setDesignExporterOpen(true);
  };

  const handleAssetPatch = (assetId: string, patch: Partial<BuilderState>) => {
    if (builder.type !== "campaign" || !builder.campaignAssets) return;
    const next = builder.campaignAssets.map((a) =>
      a.id === assetId ? { ...a, content: { ...a.content, ...patch } } : a,
    );
    setBuilder({ ...builder, campaignAssets: next });
  };

  const handleImportReel = async (assetId: string, file: File) => {
    if (!user) {
      setAuthOpen(true);
      throw new Error("Entre na sua conta para salvar o Reel.");
    }

    const uploaded = await uploadFinalReel(file);
    const mediaRender: MediaRenderState = {
      kind: "video",
      status: "ready",
      provider: "zsky",
      taskId: `zsky:manual:${Date.now()}`,
      url: uploaded.url,
      mimeType: uploaded.mimeType,
      generatedAt: new Date().toISOString(),
    };
    const currentBuilder = useBriefflowStore.getState().builder;
    if (currentBuilder.type !== "campaign" || !currentBuilder.campaignAssets) {
      throw new Error("A campanha atual não está disponível.");
    }

    const nextBuilder: BuilderState = {
      ...currentBuilder,
      campaignAssets: currentBuilder.campaignAssets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              content: {
                ...asset.content,
                generationError: undefined,
                mediaRender,
              },
            }
          : asset,
      ),
    };
    setBuilder(nextBuilder);

    try {
      const brandName = getBuilderCampaignBrandName(nextBuilder);
      const savedAsset = await saveAssetToLibrary(
        brandName ? `Campanha ${brandName}` : "Campanha com Reel",
        nextBuilder,
        activeLibraryAssetId,
      );
      setActiveLibraryAssetId(savedAsset.id);
    } catch (error) {
      throw new Error(
        `O vídeo foi importado no Canvas, mas a Biblioteca não confirmou o salvamento. ${
          error instanceof Error ? error.message : "Use Salvar na Biblioteca."
        }`,
      );
    }
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
        onOpenContentCatalog={onOpenContentCatalog}
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
                onImportReel={handleImportReel}
              />
            </div>
          )}

          {builder.type === "discovery_plan" && builder.discoveryPlan && (
            <DiscoveryPlanView
              plan={builder.discoveryPlan}
              loading={loading}
              onPatch={patchBuilder}
              onApprove={() => void onGenerateCampaign()}
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
        initialTab={
          (CORE_MATERIAL_TYPES as readonly string[]).includes(activeTab)
            ? (activeTab as (typeof CORE_MATERIAL_TYPES)[number])
            : undefined
        }
        onExportingChange={setIsExporting}
      />
    </div>
  );
}
