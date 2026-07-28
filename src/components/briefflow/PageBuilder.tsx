import { useState } from "react";
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
    scores,
    patchBuilder,
    setBuilder,
  } = useBriefflowStore();

  const [isSaving, setIsSaving] = useState(false);

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
    
    // Cria um toast de carregamento na tela e guarda o ID dele
    const toastId = toast.loading("Salvando campanha na biblioteca...");
    setIsSaving(true);
    
    try {
      await saveAssetToLibrary("Campanha AI", builder);
      // Atualiza o MESMO toast para sucesso
      toast.success("Salvo na biblioteca com sucesso!", { id: toastId });
    } catch {
      // Atualiza o MESMO toast para erro
      toast.error("Erro ao salvar a campanha", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (builder.type !== "campaign" || !builder.campaignAssets) return;
    
    // Toast com estado progressivo para não empilhar na tela
    const toastId = toast.loading("Preparando arquivos para download...");
    
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

        // Descobre qual imagem salvar (A que o usuário fez upload ou a da IA)
        let imgUrl = c.productImageUrl;
        if (!imgUrl && c.imagePrompt) {
            const w = asset.type === 'social' ? 1080 : 1200;
            const h = asset.type === 'social' ? 1350 : 600;
            imgUrl = buildPollinationsUrl(c.imagePrompt, { width: w, height: h, seed: c.imageSeed });
        }

        // Força o download da imagem via blob
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
            // Fallback se o navegador bloquear o CORS nativo
            window.open(imgUrl, '_blank');
          }
        }
      }

      // Baixa o arquivo de texto com a Copy de todas as peças
      const blobText = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const textUrl = URL.createObjectURL(blobText);
      const aText = document.createElement("a");
      aText.href = textUrl;
      aText.download = "copy_campanha.txt";
      document.body.appendChild(aText);
      aText.click();
      document.body.removeChild(aText);

      // Finaliza o carregamento indicando sucesso
      toast.success("Download concluído com sucesso!", { id: toastId });
    } catch (e) {
      toast.error("Erro ao exportar arquivos.", { id: toastId });
      console.error(e);
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
        loading={loading}
        scores={scores}
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
        {/* Halo de fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "var(--gradient-radial-brand)" }}
        />

        <div className="relative mx-auto max-w-5xl space-y-10">
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