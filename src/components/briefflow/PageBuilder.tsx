// src/components/briefflow/PageBuilder.tsx
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import {
  isSupabaseConfigured,
  saveAssetToLibrary,
  type SavedLibraryAsset,
} from "@/lib/supabase";
import { getBuilderCampaignBrandName } from "@/lib/campaignGeneration";
import { CORE_MATERIAL_TYPES } from "@/types/brief";
import { captureWorkspaceScope } from "@/lib/workspaceScope";

import { Button } from "@/components/ui/button";
import { CONTENT_FORMATS } from "@/lib/plans";
import { catalogOwner } from "@/lib/productCatalog";
import { deliverableAssets, withPilotIdentity } from "@/lib/skuPilot";
import { targetAsset, type PilotTarget } from "@/lib/pilotNavigation";
import { PilotPieceEntry } from "./PilotPieceEntry";
import { CampaignProduct } from "./CampaignProduct";
import { checkSku, exportSkuDocument } from "@/lib/skuDelivery";
import { BuilderHeader } from "./builder/BuilderHeader";
import { GeneratingBanner } from "./builder/GeneratingBanner";
import { DiscoveryPlanView } from "./builder/DiscoveryPlanView";
import { BuilderEmptyState } from "./builder/BuilderEmptyState";
import { CampaignTabs } from "./builder/CampaignTabs";
import { EditorialReview } from "./builder/EditorialReview";

import type { BuilderState, CampaignAsset } from "@/types/builder";

const DesignExporter = lazy(() =>
  import("./DesignExporter").then((module) => ({
    default: module.DesignExporter,
  })),
);

interface Props {
  onGenerateCampaign: () => void | Promise<void>;
  onRetry: (channel: CampaignAsset["type"]) => void | Promise<void>;
  onRefine?: (
    channel: CampaignAsset["type"],
    instruction: string,
  ) => void | Promise<void>;
  onOpenSettings?: () => void;
  onOpenChat?: () => void;
  onOpenContentCatalog?: () => void;
}

export function PageBuilder({
  onGenerateCampaign,
  onRetry,
  onRefine,
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
    setBuilder,
    activeLibraryAssetId,
    activeLibraryUpdatedAt,
    setActiveLibraryAssetId,
  } = useBriefflowStore();

  const [activeTab, setActiveTab] = useState<CampaignAsset["type"]>("banner");
  const [isSaving, setIsSaving] = useState(false);
  const [applyingReview, setApplyingReview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [designExporterOpen, setDesignExporterOpen] = useState(false);

  const isSavingRef = useRef(false);
  const [target, setTarget] = useState<PilotTarget>();
  const heading = useRef<HTMLHeadingElement>(null);
  const openPiece = useCallback(
    (next: PilotTarget, saved?: SavedLibraryAsset) => {
      if (saved) {
        setBuilder(withPilotIdentity(saved.content, saved.id));
        setActiveLibraryAssetId(saved.id, saved.updated_at);
      }
      setActiveTab(next.piece.channel);
      setTarget(
        saved
          ? { ...next, piece: { ...next.piece, campaignName: saved.name } }
          : next,
      );
    },
    [setBuilder, setActiveLibraryAssetId],
  );
  const focusedAsset = useMemo(
    () =>
      target && target.owner === catalogOwner(user?.id)
        ? targetAsset(target, builder, activeLibraryAssetId)
        : undefined,
    [target, user?.id, builder, activeLibraryAssetId],
  );
  const visibleAssets = useMemo(
    () => (focusedAsset ? [focusedAsset] : deliverableAssets(builder)),
    [focusedAsset, builder],
  );
  // Narrow the export to the piece shown. All edits and saves use the complete original.
  const visibleCampaign = useMemo(
    () =>
      focusedAsset && builder.type === "campaign"
        ? { ...builder, campaignAssets: visibleAssets }
        : builder,
    [builder, focusedAsset, visibleAssets],
  );
  useEffect(() => {
    if (target) heading.current?.focus();
  }, [target]);

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
    const isCurrent = captureWorkspaceScope(useBriefflowStore.getState);
    const toastId = toast.loading("Salvando campanha na biblioteca...");
    try {
      const brandName = getBuilderCampaignBrandName(builder);
      const saved = await saveAssetToLibrary(
        brandName ? `Campanha ${brandName}` : "Campanha AI",
        builder,
        activeLibraryAssetId,
        user.id,
        activeLibraryUpdatedAt,
      );
      if (!isCurrent()) {
        toast.dismiss(toastId);
        return;
      }
      setActiveLibraryAssetId(saved.id, saved.updated_at, builder);
      toast.success("Salvo na biblioteca com sucesso!", { id: toastId });
    } catch (error) {
      if (!isCurrent()) {
        toast.dismiss(toastId);
        return;
      }
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
    try {
      await checkSku(visibleCampaign, activeTab);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Confira o produto da campanha.",
      );
      return;
    }
    if (!(CORE_MATERIAL_TYPES as readonly string[]).includes(activeTab)) {
      const asset = visibleAssets.find((entry) => entry.type === activeTab);
      const document = asset?.content.structuredContent;
      if (!document) {
        toast.error("Conteúdo não encontrado para exportação.");
        return;
      }
      const brand = asset.content.brandName || document.title;
      setIsExporting(true);
      const toastId = toast.loading("Preparando arquivo final...");
      try {
        const format = await exportSkuDocument(
          visibleCampaign,
          document,
          brand,
          asset.id,
        );
        toast.success(`Conteúdo exportado em ${format}.`, { id: toastId });
      } catch (error) {
        console.error("Falha ao exportar conteúdo estruturado:", error);
        toast.error("Não foi possível gerar o arquivo final.", {
          id: toastId,
        });
      } finally {
        setIsExporting(false);
      }
      return;
    }
    setDesignExporterOpen(true);
  };

  const handleAssetPatch = (assetId: string, patch: Partial<BuilderState>) => {
    if (builder.type !== "campaign") {
      if (assetId === "standalone") patchBuilder(patch);
      return;
    }
    if (!builder.campaignAssets) return;
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
        loading={loading || applyingReview}
        onExport={() => void handleExportClick()}
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
          <PilotPieceEntry onOpen={openPiece} />
          {focusedAsset && target && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3
                id="pilot-piece-heading"
                ref={heading}
                tabIndex={-1}
                className="break-words text-base font-semibold text-fg-primary outline-none"
              >
                {CONTENT_FORMATS[focusedAsset.type].shortLabel} ·{" "}
                {target.piece.campaignName}
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTarget(undefined)}
              >
                Ver campanha inteira
              </Button>
            </div>
          )}
          <CampaignProduct
            key={user?.id ?? "visitante"}
            focusRevision={focusedAsset ? target?.revision : undefined}
            onOpenPiece={openPiece}
            onReviewingChange={setApplyingReview}
          />
          {loading && generatingLabel && builder.type === "campaign" && (
            <GeneratingBanner label={generatingLabel} />
          )}

          {visibleAssets.length > 0 && (
            <div
              className="fade-in-up"
              inert={applyingReview}
              aria-busy={applyingReview}
            >
              {visibleAssets
                .filter((asset) => asset.type === activeTab)
                .map((asset) => (
                  <EditorialReview
                    key={asset.id}
                    asset={asset}
                    onOpenChat={onOpenChat}
                  />
                ))}
              <CampaignTabs
                campaign={visibleCampaign}
                assets={visibleAssets}
                onlyAvailable={Boolean(focusedAsset)}
                onAssetChange={handleAssetPatch}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                loading={loading}
                onRetry={builder.type === "campaign" ? onRetry : undefined}
                onRefine={builder.type === "campaign" ? onRefine : undefined}
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

      <Suspense fallback={null}>
        {designExporterOpen ? (
          <DesignExporter
            open={designExporterOpen}
            onOpenChange={setDesignExporterOpen}
            state={visibleCampaign}
            initialTab={
              (CORE_MATERIAL_TYPES as readonly string[]).includes(activeTab)
                ? (activeTab as (typeof CORE_MATERIAL_TYPES)[number])
                : undefined
            }
            onExportingChange={setIsExporting}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
