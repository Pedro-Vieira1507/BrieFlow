// src/components/briefflow/LibraryModal.tsx
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBriefflowStore } from "@/store/briefflow";
import { getSavedAssets, deleteSavedAsset } from "@/lib/supabase";
import { CampaignTabs } from "@/components/briefflow/builder/CampaignTabs";
import { Loader2, Trash2, ArrowRight, FolderKanban, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BuilderState, CampaignAsset } from "@/types/builder";

export function LibraryModal() {
  const { libraryOpen, setLibraryOpen, setBuilder, user } = useBriefflowStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<CampaignAsset["type"]>("banner");

  const loadLibrary = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getSavedAssets();
      setItems(data || []);
      setSelectedIndex(0);
    } catch (err: any) {
      toast.error("Erro ao carregar a biblioteca", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (libraryOpen && user) {
      loadLibrary();
    }
  }, [libraryOpen, user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSavedAsset(id);
      toast.success("Campanha removida da biblioteca");
      const updated = items.filter((item) => item.id !== id);
      setItems(updated);
      if (selectedIndex >= updated.length) {
        setSelectedIndex(Math.max(0, updated.length - 1));
      }
    } catch (err: any) {
      toast.error("Erro ao excluir campanha", { description: err.message });
    }
  };

  const handleApplyToCanvas = (state: BuilderState) => {
    setBuilder(state);
    toast.success("Campanha carregada no Canvas com sucesso!");
    setLibraryOpen(false);
  };

  const selectedItem = items[selectedIndex];
  const selectedState: BuilderState | undefined = selectedItem?.content;
  const campaignAssets = selectedState?.type === "campaign" ? selectedState.campaignAssets : undefined;

  const handleAssetPatch = (assetId: string, patch: Partial<BuilderState>) => {
    if (!selectedState || !campaignAssets) return;
    const nextAssets = campaignAssets.map((a) =>
      a.id === assetId ? { ...a, content: { ...a.content, ...patch } } : a
    );
    const nextState: BuilderState = { ...selectedState, campaignAssets: nextAssets };
    const updatedItems = [...items];
    updatedItems[selectedIndex] = { ...selectedItem, content: nextState };
    setItems(updatedItems);
  };

  return (
    <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
      <DialogContent className="sm:max-w-[1000px] w-[95vw] h-[88vh] bg-surface-1 border-border-strong text-fg-primary shadow-2xl p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border-subtle flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <FolderKanban className="size-5 text-brand" /> Sua Biblioteca
            </DialogTitle>
            <DialogDescription className="text-fg-tertiary mt-1">
              Visualize suas campanhas salvas separadas por abas e recarregue-as no Canvas quando quiser.
            </DialogDescription>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-fg-muted">
            <Loader2 className="size-8 animate-spin text-brand mb-3" />
            <p className="text-xs uppercase font-bold tracking-widest">Carregando conteúdos salvos...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="size-16 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center mb-4 text-fg-muted">
              <Sparkles className="size-8" />
            </div>
            <h3 className="font-semibold text-lg text-fg-primary mb-1">Nenhuma campanha salva</h3>
            <p className="text-sm text-fg-tertiary max-w-sm">
              Crie uma nova campanha no chat e clique em "Salvar na Biblioteca" no topo da tela para guardá-la aqui.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* PAINEL LATERAL DE CAMPANHAS SALVAS */}
            <div className="w-full md:w-[280px] shrink-0 border-r border-border-subtle bg-surface-2/40 overflow-y-auto p-3 space-y-2">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                Campanhas Salvas ({items.length})
              </div>
              {items.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const dateStr = item.created_at
                  ? new Date(item.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                const brand = item.content?.brandName || item.name || "Campanha sem nome";

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedIndex(idx)}
                    className={cn(
                      "group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5",
                      isSelected
                        ? "bg-surface-3 border-brand shadow-md"
                        : "bg-surface-2/80 border-border-subtle hover:border-border-strong hover:bg-surface-3/50"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-xs text-fg-primary truncate max-w-[170px]">
                        {brand}
                      </span>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="text-fg-muted hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Excluir da biblioteca"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-fg-tertiary">
                      <Calendar className="size-3" />
                      <span>{dateStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ÁREA DE VISUALIZAÇÃO COM ABAS */}
            <div className="flex-1 flex flex-col min-w-0 bg-surface-0 overflow-y-auto p-6 relative">
              {selectedState && campaignAssets && campaignAssets.length > 0 ? (
                <div className="space-y-6 pb-20">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
                    <div>
                      <h4 className="font-display font-semibold text-lg text-fg-primary">
                        {selectedState.brandName || selectedItem.name || "Campanha Salva"}
                      </h4>
                      <p className="text-xs text-fg-muted mt-0.5">
                        Alterne entre as abas para ver cada peça ou recarregue no Canvas para editar.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleApplyToCanvas(selectedState)}
                      className="bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)] text-xs font-semibold"
                    >
                      Carregar no Canvas <ArrowRight className="ml-1.5 size-4" />
                    </Button>
                  </div>

                  {/* PREVIEW SEPARADO POR ABAS (BANNER, E-MAIL, SOCIAL) */}
                  <CampaignTabs
                    assets={campaignAssets}
                    onAssetChange={handleAssetPatch}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-fg-muted">
                  <p className="text-sm">Selecione uma campanha à esquerda para visualizar.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}