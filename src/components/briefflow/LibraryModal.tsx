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
  renameSavedAsset,
  updateSavedAssetStatus,
  type LibraryAssetStatus,
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
  Search,
  CopyPlus,
  PencilLine,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getBuilderCampaignBrandName } from "@/lib/campaignGeneration";
import type { BuilderState, CampaignAsset } from "@/types/builder";

function getLibraryItemLabel(item: SavedLibraryAsset): string {
  return (
    getBuilderCampaignBrandName(item.content) ||
    item.name ||
    "Campanha sem nome"
  );
}

const LIBRARY_STATUS_OPTIONS: Array<{
  value: LibraryAssetStatus;
  label: string;
}> = [
  { value: "draft", label: "Rascunho" },
  { value: "review", label: "Em revisão" },
  { value: "approved", label: "Aprovada" },
];

function libraryStatusLabel(status: LibraryAssetStatus): string {
  return (
    LIBRARY_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    "Rascunho"
  );
}

export function LibraryModal() {
  const {
    libraryOpen,
    setLibraryOpen,
    setBuilder,
    user,
    setActiveLibraryAssetId,
  } = useBriefflowStore();
  const [items, setItems] = useState<SavedLibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<SavedAssetsCursor | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LibraryAssetStatus>(
    "all",
  );
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<CampaignAsset["type"]>("banner");
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const loadRequestRef = useRef(0);

  const loadLibrary = useCallback(async () => {
    if (!user) return;
    const request = ++loadRequestRef.current;
    const requestedUserId = user.id;
    setItems([]);
    setNextCursor(null);
    setLoading(true);
    setQuery("");
    setStatusFilter("all");
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
      setQuery("");
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

  const handleApplyToCanvas = (item: SavedLibraryAsset) => {
    setBuilder(item.content);
    setActiveLibraryAssetId(item.id);
    toast.success("Campanha carregada no Canvas com sucesso!");
    setLibraryOpen(false);
  };

  const handleDuplicateToCanvas = (item: SavedLibraryAsset) => {
    setBuilder(item.content);
    setActiveLibraryAssetId(null);
    toast.success("Cópia carregada no Canvas", {
      description: "Ao salvar, ela será criada como uma nova campanha.",
    });
    setLibraryOpen(false);
  };

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const visibleEntries = items
    .map((item, index) => ({ item, index, label: getLibraryItemLabel(item) }))
    .filter(({ item, label }) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${label} ${item.name} ${item.type}`.toLocaleLowerCase(
        "pt-BR",
      );
      return haystack.includes(normalizedQuery);
    });

  useEffect(() => {
    if (visibleEntries.length === 0) return;
    if (!visibleEntries.some(({ index }) => index === selectedIndex)) {
      setSelectedIndex(visibleEntries[0].index);
    }
  }, [normalizedQuery, selectedIndex, statusFilter, visibleEntries]);

  const selectedItem = items[selectedIndex];
  const selectedState: BuilderState | undefined = selectedItem?.content;
  const campaignAssets =
    selectedState?.type === "campaign"
      ? selectedState.campaignAssets
      : undefined;

  const beginRename = () => {
    if (!selectedItem) return;
    setNameDraft(selectedItem.name || getLibraryItemLabel(selectedItem));
    setEditingName(true);
  };

  const confirmRename = async () => {
    if (!selectedItem || renaming) return;
    const nextName = nameDraft.trim();
    if (!nextName) {
      toast.error("Digite um nome para a campanha");
      return;
    }
    setRenaming(true);
    try {
      const renamed = await renameSavedAsset(selectedItem.id, nextName);
      setItems((current) =>
        current.map((item) =>
          item.id === selectedItem.id ? { ...item, ...renamed } : item,
        ),
      );
      setEditingName(false);
      toast.success("Campanha renomeada");
    } catch (error) {
      toast.error("Não foi possível renomear a campanha", {
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente em instantes.",
      });
    } finally {
      setRenaming(false);
    }
  };

  const handleStatusChange = async (status: LibraryAssetStatus) => {
    if (!selectedItem || updatingStatus || selectedItem.status === status)
      return;
    setUpdatingStatus(true);
    try {
      const updated = await updateSavedAssetStatus(selectedItem.id, status);
      setItems((current) =>
        current.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
      toast.success(`Status alterado para ${libraryStatusLabel(status)}`);
    } catch (error) {
      toast.error("Não foi possível alterar o status", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

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
                  Biblioteca privada: busque, reabra ou crie uma cópia sem
                  alterar o original.
                </span>
              </DialogDescription>
            </div>
          </DialogHeader>

          {loading ? (
            <div
              className="flex flex-1 flex-col items-center justify-center py-20 text-fg-muted"
              role="status"
            >
              <Loader2 className="mb-3 size-8 animate-spin text-brand" />
              <p className="text-xs font-medium text-fg-tertiary">
                Carregando campanhas...
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-border-subtle bg-surface-2 text-fg-muted">
                <Sparkles className="size-8" />
              </div>
              <h3 className="mb-1 text-lg font-semibold text-fg-primary">
                Nenhuma campanha salva
              </h3>
              <p className="max-w-sm text-sm text-fg-tertiary">
                Crie uma nova campanha no chat e clique em "Salvar na
                Biblioteca" no topo da tela para guardá-la aqui.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
              <div className="flex max-h-[260px] w-full shrink-0 flex-col border-b border-border-subtle bg-surface-2/35 md:max-h-none md:w-[300px] md:border-b-0 md:border-r">
                <div className="shrink-0 border-b border-border-subtle p-3">
                  <label htmlFor="library-search" className="sr-only">
                    Buscar campanhas salvas
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
                    <input
                      id="library-search"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar campanha..."
                      className="h-11 w-full rounded-xl border border-border-strong bg-surface-1 pl-9 pr-9 text-sm text-fg-primary outline-none transition placeholder:text-fg-muted focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
                    />
                    {query ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Limpar busca"
                        className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-fg-muted transition hover:bg-surface-3 hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <label htmlFor="library-status-filter" className="sr-only">
                      Filtrar campanhas por status
                    </label>
                    <select
                      id="library-status-filter"
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as "all" | LibraryAssetStatus,
                        )
                      }
                      className="h-10 w-full rounded-xl border border-border-subtle bg-surface-1 px-3 text-xs font-semibold text-fg-secondary outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
                    >
                      <option value="all">Todos os status</option>
                      {LIBRARY_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p
                    className="mt-2 px-1 text-xs font-semibold uppercase tracking-[0.13em] text-fg-muted"
                    aria-live="polite"
                  >
                    {visibleEntries.length} de {items.length} campanhas
                    {nextCursor ? " carregadas" : ""}
                  </p>
                </div>

                <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto p-3 md:flex-col md:overflow-x-hidden md:overflow-y-auto">
                  {visibleEntries.length === 0 ? (
                    <div className="flex min-w-[220px] flex-1 items-center justify-center rounded-xl border border-dashed border-border-strong p-5 text-center text-xs leading-5 text-fg-tertiary md:min-w-0">
                      Nenhuma campanha corresponde a “{query.trim()}”.
                    </div>
                  ) : null}

                  {visibleEntries.map(({ item, index, label }) => {
                    const isSelected = index === selectedIndex;
                    const dateValue = item.updated_at || item.created_at;
                    const dateStr = dateValue
                      ? new Date(dateValue).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "group relative flex min-w-[220px] items-start gap-1 rounded-xl border transition-all duration-200 md:min-w-0",
                          isSelected
                            ? "border-brand bg-surface-3 shadow-md"
                            : "border-border-subtle bg-surface-2/80 hover:border-border-strong hover:bg-surface-3/50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedIndex(index)}
                          aria-current={isSelected ? "true" : undefined}
                          className="min-w-0 flex-1 rounded-xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          <span className="block truncate text-xs font-semibold text-fg-primary">
                            {label}
                          </span>
                          <span className="mt-1.5 inline-flex rounded-full border border-border-subtle bg-surface-1 px-2 py-0.5 text-[10px] font-semibold text-fg-secondary">
                            {libraryStatusLabel(item.status)}
                          </span>
                          <span
                            className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-tertiary"
                            title="Última edição"
                          >
                            <Calendar className="size-3" aria-hidden />
                            {dateStr}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) =>
                            requestDelete(item.id, label, event)
                          }
                          className="mr-2 mt-2 rounded-md p-1.5 text-fg-muted opacity-100 transition-colors hover:bg-rose-500/10 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                          title="Excluir da biblioteca"
                          aria-label={`Excluir ${label}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
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
              </div>

              <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-surface-0 p-4 sm:p-6">
                {selectedState &&
                campaignAssets &&
                campaignAssets.length > 0 ? (
                  <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
                      <div className="min-w-0 flex-1">
                        {editingName ? (
                          <div className="flex max-w-xl items-center gap-2">
                            <label
                              htmlFor="library-campaign-name"
                              className="sr-only"
                            >
                              Nome da campanha
                            </label>
                            <input
                              id="library-campaign-name"
                              value={nameDraft}
                              maxLength={120}
                              autoFocus
                              onChange={(event) =>
                                setNameDraft(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void confirmRename();
                                if (event.key === "Escape")
                                  setEditingName(false);
                              }}
                              className="h-11 min-w-0 flex-1 rounded-xl border border-brand/40 bg-surface-1 px-3 text-base font-semibold text-fg-primary outline-none focus:ring-2 focus:ring-brand/30 sm:text-sm"
                            />
                            <button
                              type="button"
                              disabled={renaming}
                              onClick={() => void confirmRename()}
                              aria-label="Salvar novo nome"
                              className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                            >
                              {renaming ? (
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <Check className="size-4" aria-hidden />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={renaming}
                              onClick={() => setEditingName(false)}
                              aria-label="Cancelar renomeação"
                              className="grid size-11 shrink-0 place-items-center rounded-xl border border-border-strong bg-surface-2 text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                            >
                              <X className="size-4" aria-hidden />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className="truncate font-display text-lg font-semibold text-fg-primary">
                              {selectedItem.name ||
                                getBuilderCampaignBrandName(selectedState) ||
                                "Campanha Salva"}
                            </h4>
                            <button
                              type="button"
                              onClick={beginRename}
                              aria-label="Renomear campanha"
                              title="Renomear campanha"
                              className="grid size-10 shrink-0 place-items-center rounded-xl text-fg-muted transition hover:bg-surface-2 hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            >
                              <PencilLine className="size-4" aria-hidden />
                            </button>
                          </div>
                        )}
                        <p className="mt-1 text-xs leading-5 text-fg-muted">
                          Reabra para continuar o original ou crie uma cópia
                          para testar outra direção.
                        </p>
                        <div
                          className="mt-3 flex flex-wrap items-center gap-2"
                          aria-label="Status da campanha"
                        >
                          {LIBRARY_STATUS_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={
                                selectedItem.status === option.value
                              }
                              disabled={updatingStatus}
                              onClick={() =>
                                void handleStatusChange(option.value)
                              }
                              className={cn(
                                "min-h-9 rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50",
                                selectedItem.status === option.value
                                  ? "border-brand/40 bg-brand-muted text-brand"
                                  : "border-border-subtle bg-surface-2 text-fg-secondary hover:border-border-strong hover:text-fg-primary",
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateToCanvas(selectedItem)}
                          className="w-full rounded-xl border-border-strong bg-surface-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 hover:text-fg-primary sm:w-auto"
                        >
                          <CopyPlus className="mr-1.5 size-4" /> Criar cópia
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleApplyToCanvas(selectedItem)}
                          className="w-full rounded-xl bg-brand text-xs font-semibold text-brand-fg shadow-[var(--shadow-brand)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] sm:w-auto"
                        >
                          Continuar original
                          <ArrowRight className="ml-1.5 size-4" />
                        </Button>
                      </div>
                    </div>

                    <CampaignTabs
                      assets={campaignAssets}
                      onAssetChange={handleAssetPatch}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-fg-muted">
                    <p className="text-sm">
                      Selecione uma campanha para visualizar.
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
