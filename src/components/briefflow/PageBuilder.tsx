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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

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

  const executeExport = async () => {
    if (builder.type !== "campaign" || !builder.campaignAssets || isExportingRef.current) return;
    
    isExportingRef.current = true;
    setIsExporting(true);
    
    await new Promise((resolve) => setTimeout(resolve, 150));
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
      
      toast.success("Download concluído com sucesso!", { duration: 4000 });
    } catch (e) {
      toast.error("Erro ao exportar arquivos.", { duration: 4000 });
      console.error(e);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
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
        onExport={() => setExportDialogOpen(true)}
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

      {/* Modal de Confirmação de Exportação */}
      <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <AlertDialogContent className="bg-surface-1 border-border-strong text-fg-primary shadow-2xl sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">Exportar Campanha</AlertDialogTitle>
            <AlertDialogDescription className="text-fg-secondary mt-2 leading-relaxed">
              O download de <strong>{builder.campaignAssets?.length || 0} imagens em alta resolução</strong> e <strong>1 arquivo de texto</strong> contendo as copys completas iniciará automaticamente. 
              <br /><br />
              <span className="text-amber-500 font-medium">Nota: Seu navegador pode solicitar permissão para baixar múltiplos arquivos. Certifique-se de aceitar.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="border-border-strong bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setExportDialogOpen(false);
                executeExport();
              }}
              className="bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)]"
            >
              Confirmar Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}