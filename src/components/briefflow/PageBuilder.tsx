// src/components/briefflow/PageBuilder.tsx
import { useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { isSupabaseConfigured, saveAssetToLibrary } from "@/lib/supabase";
import { buildPollinationsUrl } from "@/lib/pollinations";
import { BuilderHeader } from "./builder/BuilderHeader";
import { GeneratingBanner } from "./builder/GeneratingBanner";
import { CampaignTabs } from "./builder/CampaignTabs";
import { DiscoveryPlanView } from "./builder/DiscoveryPlanView";
import { BuilderEmptyState } from "./builder/BuilderEmptyState";
import type { BuilderState } from "@/types/builder";

interface Props {
  onRefine: (prompt: string) => void;
}

export function PageBuilder({ onRefine }: Props) {
  const {
    builder,
    loading,
    generatingLabel,
    patchBuilder,
    setBuilder,
  } = useBriefflowStore();

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Guards mecânicos anti-duplo clique
  const isSavingRef = useRef(false);
  const isExportingRef = useRef(false);

  const hasContent = builder.type !== "none";
  const isSaveable =
    hasContent &&
    builder.type !== "discovery_plan" &&
    (builder.type === "campaign"
      ? Boolean(builder.campaignAssets?.length)
      : true);

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      toast.error("Biblioteca não configurada", { duration: 4000 });
      return;
    }
    if (isSavingRef.current) return;
    
    isSavingRef.current = true;
    setIsSaving(true);
    
    // Força o React a desenhar o botão em estado de "Salvar..."
    await new Promise((resolve) => setTimeout(resolve, 150));
    
    toast.info("Salvando campanha na biblioteca...", { duration: 3000 });
    
    try {
      await saveAssetToLibrary("Campanha AI", builder);
      toast.success("Salvo na biblioteca com sucesso!", { duration: 4000 });
    } catch {
      toast.error("Erro ao salvar a campanha", { duration: 4000 });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (builder.type !== "campaign" || !builder.campaignAssets || isExportingRef.current) return;
    
    isExportingRef.current = true;
    setIsExporting(true);
    
    // GATILHO UX: Pausa real de 150ms. Isso tira a pressão da Thread principal,
    // garantindo que o navegador desenhe o Spinner na tela ANTES de congelar processando os blobs.
    await new Promise((resolve) => setTimeout(resolve, 150)); 
    
    // Dispara um toast independente (sem tracking ID) para garantir o sumiço
    toast.info("Preparando arquivos para download...", { duration: 3000 });
    
    try {
      let textContent = "=== CAMPANHA BRIEFLOW ===\n\n";

      for (const asset of builder.campaignAssets) {
        const c = asset.content as any;
        textContent += `--- PEÇA: ${asset.type.toUpperCase()} ---\n`;
        if (c.title) textContent += `Título: ${c.title}\n`;
        if (c.subtitle) textContent += `Subtítulo: ${c.subtitle}\n`;
        if (c.body) textContent += `Corpo:\n${c.body}\n`;
        if (c.caption) textContent += `Legenda:\n${c.caption}\n`;
        if (c.hashtags?.length) textContent += `Hashtags: ${c.hashtags.join(" ")}\n`;
        if (c.cta) textContent += `CTA: ${c.cta}\n`;
        textContent += `\n`;

        let imgUrl = c.productImageUrl;
        if (!imgUrl && c.imagePrompt) {
            const w = asset.type === 'social' ? 1080 : 1200;
            const h = asset.type === 'social' ? 1350 : 600;
            imgUrl = buildPollinationsUrl(c.imagePrompt, { width: w, height: h, seed: c.imageSeed });
        }

        if (imgUrl) {
          try {
            const response = await fetch(imgUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `brieflow-${asset.type}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          } catch (imgErr) {
            window.open(imgUrl, '_blank');
          }
        }
      }

      const blobText = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const textUrl = URL.createObjectURL(blobText);
      const aText = document.createElement("a");
      aText.href = textUrl;
      aText.download = "copy_campanha.txt";
      document.body.appendChild(aText);
      aText.click();
      document.body.removeChild(aText);

      // Toast de conclusão disparado nativamente, respeitando a duração
      toast.success("Download concluído com sucesso!", { duration: 4000 });
    } catch (e) {
      toast.error("Erro ao exportar arquivos.", { duration: 4000 });
      console.error(e);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const handleAssetPatch = (
    assetId: string,
    patch: Partial<BuilderState>,
  ) => {
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
        onExport={handleExport}
        onSave={handleSave}
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

        {/* Spacer ampliado (pb-40) para o Botão do Chat NUNCA pisar na interface móvel */}
        <div className="relative mx-auto max-w-5xl space-y-10 pb-40">
          {loading && generatingLabel && builder.type === "campaign" && (
            <GeneratingBanner label={generatingLabel} />
          )}

          {builder.type === "campaign" && builder.campaignAssets && (
            <div className="fade-in-up">
              <CampaignTabs
                assets={builder.campaignAssets}
                onAssetChange={handleAssetPatch}
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

          {builder.type === "none" && <BuilderEmptyState />}
        </div>
      </div>
    </div>
  );
}