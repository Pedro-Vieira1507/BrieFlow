// src/components/briefflow/LibraryModal.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { useBriefflowStore } from "@/store/briefflow";
import {
  deleteSavedAsset,
  getSavedAssetsPage,
  type SavedAssetsCursor,
  type SavedLibraryAsset,
} from "@/lib/supabase";
import { CampaignTabs } from "@/components/briefflow/builder/CampaignTabs";
import {
  Loader2,
  Trash2,
  ArrowRight,
  FolderKanban,
  Calendar,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getBuilderCampaignBrandName } from "@/lib/campaignGeneration";
import type { BuilderState, CampaignAsset } from "@/types/builder";

export function LibraryModal() {
  const { libraryOpen, setLibraryOpen, setBuilder, user } = useBriefflowStore();
  const [items, setItems] = useState<SavedLibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<SavedAssetsCursor | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<CampaignAsset["type"]>("banner");
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const loadRequestRef = useRef(0);

  const loadLibrary = useCallback(async () => {
    if (!user) return;
    const request = ++loadRequestRef.current;
    const requestedUserId = user.id;
    setItems([]);
    setNextCursor(null);
    setLoading(true);
    try {
      const page = await getSavedAssetsPage();
      if (
        request !== loadRequestRef.current ||
        useBriefflowStore.getState().user?.id !== requestedUserId
      )
        return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setSelectedIndex(0);
    } catch (error) {
      if (request !== loadRequestRef.current) return;
      toast.error("Erro ao carregar a biblioteca", {
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente em instantes.",
      });
    } finally {
      if (request === loadRequestRef.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (libraryOpen && user) {
      void loadLibrary();
    } else if (!user) {
      loadRequestRef.current += 1;
      setItems([]);
      setNextCursor(null);
      setSelectedIndex(0);
    }
  }, [libraryOpen, loadLibrary, user]);

  const loadMore = async () => {
    if (!user || !nextCursor || loadingMore) return;
    const request = loadRequestRef.current;
    const requestedUserId = user.id;
    setLoadingMore(true);
    try {
      const page = await getSavedAssetsPage({ cursor: nextCursor });
      if (
        request !== loadRequestRef.current ||
        useBriefflowStore.getState().user?.id !== requestedUserId
      )
        return;
      setItems((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...page.items.filter((item) => !knownIds.has(item.id)),
        ];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (request !== loadRequestRef.current) return;
      toast.error("Erro ao carregar mais campanhas", {
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente em instantes.",
      });
    } finally {
      if (request === loadRequestRef.current) setLoadingMore(false);
    }
  };

  const requestDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteSavedAsset(pendingDelete.id);
      toast.success("Campanha removida da biblioteca");
      const removedIndex = items.findIndex(
        (item) => item.id === pendingDelete.id,
      );
      const updated = items.filter((item) => item.id !== pendingDelete.id);
      setItems(updated);
      setSelectedIndex((current) => {
        if (removedIndex >= 0 && removedIndex < current) return current - 1;
        return Math.min(current, Math.max(0, updated.length - 1));
      });
      setPendingDelete(null);
    } catch (error) {
      toast.error("Erro ao excluir campanha", {
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente em instantes.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleApplyToCanvas = (state: BuilderState) => {
    setBuilder(state);
    toast.success("Campanha carregada no Canvas com sucesso!");
    setLibraryOpen(false);
  };

  const selectedItem = items[selectedIndex];
  const selectedState: BuilderState | undefined = selectedItem?.content;
  const campaignAssets =
    selectedState?.type === "campaign"
      ? selectedState.campaignAssets
      : undefined;

  const handleAssetPatch = (assetId: string, patch: Partial<BuilderState>) => {
    if (!selectedState || !campaignAssets) return;
    const nextAssets = campaignAssets.map((a) =>
      a.id === assetId ? { ...a, content: { ...a.content, ...patch } } : a,
    );
    const nextState: BuilderState = {
      ...selectedState,
      campaignAssets: nextAssets,
    };
    const updatedItems = [...items];
    updatedItems[selectedIndex] = { ...selectedItem, content: nextState };
    setItems(updatedItems);
  };

  return (
    <>
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none border-border-strong bg-surface-1 p-0 text-fg-primary shadow-[var(--shadow-elevated)] sm:h-[90vh] sm:w-[96vw] sm:max-w-[1080px] sm:rounded-[24px]">
          <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border-subtle bg-surface-1/95 p-5 pr-14 text-left backdrop-blur-xl sm:p-6 sm:pr-14">
            <div>
              <DialogTitle className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight">
                <span className="grid size-9 place-items-center rounded-xl border border-brand/20 bg-brand-muted text-brand">
                  <FolderKanban className="size-4" />
                </span>
                Biblioteca
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl text-xs leading-5 text-fg-tertiary sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                  Biblioteca privada: somente este login pode acessar estes
                  conteúdos.
                </span>
              </DialogDescription>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-fg-muted">
              <Loader2 className="size-8 animate-spin text-brand mb-3" />
              <p className="text-xs font-medium text-fg-tertiary">
                Carregando campanhas...
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
              <div className="size-16 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center mb-4 text-fg-muted">
                <Sparkles className="size-8" />
              </div>
              <h3 className="font-semibold text-lg text-fg-primary mb-1">
                Nenhuma campanha salva
              </h3>
              <p className="text-sm text-fg-tertiary max-w-sm">
                Crie uma nova campanha no chat e clique em "Salvar na
                Biblioteca" no topo da tela para guardá-la aqui.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
              {/* PAINEL LATERAL DE CAMPANHAS SALVAS */}
              <div className="flex max-h-52 w-full shrink-0 gap-2 overflow-x-auto border-b border-border-subtle bg-surface-2/35 p-3 md:max-h-none md:w-[286px] md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-b-0 md:border-r">
                <div className="hidden px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-fg-muted md:block">
                  Campanhas salvas ({items.length}
                  {nextCursor ? "+" : ""})
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
                  const brand =
                    getBuilderCampaignBrandName(item.content) ||
                    item.name ||
                    "Campanha sem nome";

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedIndex(idx)}
                      // UX: Efeito tátil de clique (active:scale-[0.98])
                      className={cn(
                        "group relative flex min-w-[220px] cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition-all duration-200 active:scale-[0.98] md:min-w-0",
                        isSelected
                          ? "bg-surface-3 border-brand shadow-md"
                          : "bg-surface-2/80 border-border-subtle hover:border-border-strong hover:bg-surface-3/50",
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-xs text-fg-primary truncate max-w-[170px]">
                          {brand}
                        </span>
                        <button
                          onClick={(e) => requestDelete(item.id, brand, e)}
                          className="rounded-md p-1 text-fg-muted opacity-100 transition-colors hover:bg-rose-500/10 hover:text-rose-400 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                          title="Excluir da biblioteca"
                          aria-label={`Excluir ${brand}`}
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
                {nextCursor && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                    className="min-w-[150px] shrink-0 rounded-xl border-border-strong bg-surface-2 text-xs text-fg-secondary hover:bg-surface-3 hover:text-fg-primary md:min-w-0"
                  >
                    {loadingMore && (
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                    )}
                    Carregar mais
                  </Button>
                )}
              </div>

              {/* ÁREA DE VISUALIZAÇÃO COM ABAS */}
              <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-surface-0 p-4 sm:p-6">
                {selectedState &&
                campaignAssets &&
                campaignAssets.length > 0 ? (
                  <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
                      <div>
                        <h4 className="font-display font-semibold text-lg text-fg-primary">
                          {getBuilderCampaignBrandName(selectedState) ||
                            selectedItem.name ||
                            "Campanha Salva"}
                        </h4>
                        <p className="text-xs text-fg-muted mt-0.5">
                          Alterne entre as abas para ver cada peça ou recarregue
                          no Canvas para editar.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleApplyToCanvas(selectedState)}
                        className="w-full rounded-xl bg-brand text-xs font-semibold text-brand-fg shadow-[var(--shadow-brand)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] sm:w-auto"
                      >
                        Carregar no Canvas{" "}
                        <ArrowRight className="ml-1.5 size-4" />
                      </Button>
                    </div>

                    {/* PREVIEW SEPARADO POR ABAS */}
                    <CampaignTabs
                      assets={campaignAssets}
                      onAssetChange={handleAssetPatch}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-fg-muted">
                    <p className="text-sm">
                      Selecione uma campanha à esquerda para visualizar.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-24px)] max-w-[430px] rounded-[22px] border-border-strong bg-surface-1 text-fg-primary shadow-[var(--shadow-elevated)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-fg-tertiary">
              “{pendingDelete?.name}” será removida permanentemente da
              biblioteca. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 gap-2">
            <AlertDialogCancel
              disabled={deleting}
              className="rounded-xl border-border-strong bg-surface-2 text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-500"
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Excluir campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
