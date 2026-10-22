// src/components/briefflow/builder/BuilderHeader.tsx
import { useState } from "react";
import {
  Loader2,
  Save,
  Download,
  Settings,
  FolderKanban,
  LogOut,
  LogIn,
  PlusCircle,
  PanelsTopLeft,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { useCredits, planLabel } from "@/hooks/useCredits";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  isSaveable: boolean;
  isSaving: boolean;
  isExporting: boolean;
  loading?: boolean;
  onExport: () => void;
  onSave: () => void;
  onOpenSettings?: () => void;
  onOpenContentCatalog?: () => void;
}

export function BuilderHeader({
  isSaveable,
  isSaving,
  isExporting,
  loading,
  onExport,
  onSave,
  onOpenSettings,
  onOpenContentCatalog,
}: Props) {
  const {
    user,
    reset,
    workspaceDirty,
    activeLibraryAssetId,
    setAuthOpen,
    setLibraryOpen,
  } = useBriefflowStore();
  const { plan } = useCredits();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
  };

  const handleNewBriefing = () => {
    if (workspaceDirty) {
      setConfirmResetOpen(true);
      return;
    }
    reset();
  };

  const saveState = workspaceDirty
    ? {
        label: "Não salvo",
        title: "Existem alterações ainda não salvas na biblioteca",
        dot: "bg-amber-300",
        badge: "border-amber-300/20 bg-amber-300/10 text-amber-200",
      }
    : activeLibraryAssetId
      ? {
          label: "Salvo",
          title: "Campanha sincronizada com a biblioteca",
          dot: "bg-emerald-400",
          badge: "border-emerald-400/15 bg-emerald-400/8 text-emerald-300/90",
        }
      : {
          label: "Novo",
          title: "Novo briefing ainda não salvo na biblioteca",
          dot: "bg-fg-muted",
          badge: "border-border-strong bg-surface-2 text-fg-tertiary",
        };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-20 flex min-h-[68px] items-center justify-between gap-2",
          "border-b border-border-subtle px-3 py-2.5 sm:px-4 lg:px-6",
          "bg-surface-1/82 shadow-[0_14px_40px_-34px_rgba(0,0,0,0.85)] backdrop-blur-2xl",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="hidden size-9 shrink-0 place-items-center rounded-xl border border-border-subtle bg-surface-2 text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:grid">
            <PanelsTopLeft className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-display text-[14px] font-semibold tracking-tight text-fg-primary sm:text-[15px]">
                Estúdio criativo
              </h2>
              <span
                role="status"
                aria-live="polite"
                title={saveState.title}
                className={cn(
                  "hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold md:inline-flex",
                  saveState.badge,
                )}
              >
                <span className={cn("size-1.5 rounded-full", saveState.dot)} />
                {saveState.label}
              </span>
            </div>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted sm:text-[11px]">
              Briefing → direção → entrega
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Abrir central de formatos"
            title="Criar outro formato"
            onClick={onOpenContentCatalog}
            disabled={loading}
            className="size-11 rounded-xl border-border-strong bg-surface-1/50 p-0 text-fg-secondary transition hover:border-brand/30 hover:bg-surface-2 hover:text-fg-primary focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 sm:h-9 sm:w-auto sm:px-3"
          >
            <LayoutGrid className="size-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Formatos</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            aria-label="Exportar campanha"
            title="Exportar campanha"
            onClick={onExport}
            disabled={!isSaveable || loading || isExporting}
            className="size-11 rounded-xl border-border-strong bg-surface-1/50 p-0 text-fg-secondary transition hover:border-brand/30 hover:bg-surface-2 hover:text-fg-primary focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 sm:h-9 sm:w-auto sm:px-3"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin sm:mr-2" />
            ) : (
              <Download className="size-3.5 sm:mr-2" />
            )}
            <span className="hidden sm:inline">Exportar</span>
          </Button>

          <Button
            size="sm"
            disabled={!isSaveable || loading || isSaving}
            onClick={onSave}
            aria-label="Salvar na biblioteca"
            title="Salvar na biblioteca"
            className={cn(
              "size-11 rounded-xl bg-brand p-0 text-xs font-semibold text-brand-fg transition hover:-translate-y-px hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/80 sm:h-9 sm:w-auto sm:px-3",
              "shadow-[var(--shadow-brand)] disabled:translate-y-0 disabled:shadow-none disabled:opacity-40",
            )}
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin sm:mr-2" />
            ) : (
              <Save className="size-3.5 sm:mr-2" />
            )}
            <span className="hidden sm:inline">Salvar</span>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-0.5 flex size-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-brand to-violet-500 text-xs font-bold text-white shadow-[var(--shadow-brand)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:ml-1"
                  title={user.email ?? "Perfil"}
                  aria-label="Abrir menu do perfil"
                >
                  {user.email?.charAt(0).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="end"
                className="w-56 border-border-strong bg-surface-2 p-1 text-fg-primary shadow-2xl"
              >
                <div className="border-b border-border-subtle px-3 py-2.5">
                  <p className="truncate text-xs font-bold text-fg-primary">
                    {user.email}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                    Plano {plan ? planLabel(plan.plan) : "Gratuito"}
                  </p>
                </div>

                <DropdownMenuItem
                  className="my-0.5 cursor-pointer text-xs font-medium text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
                  onClick={handleNewBriefing}
                >
                  <PlusCircle className="mr-2 size-4 text-brand" /> Novo
                  Briefing
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="my-0.5 cursor-pointer text-xs font-medium text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
                  onClick={() => setLibraryOpen(true)}
                >
                  <FolderKanban className="mr-2 size-4 text-brand" /> Biblioteca
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="my-0.5 cursor-pointer text-xs font-medium text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
                  onClick={onOpenSettings}
                >
                  <Settings className="mr-2 size-4 text-fg-muted" />{" "}
                  Configurações
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-border-subtle" />

                <DropdownMenuItem
                  className="cursor-pointer text-xs font-medium text-rose-400/90 hover:bg-rose-500/10 hover:text-rose-400"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 size-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAuthOpen(true)}
              aria-label="Entrar no BrieFlow"
              className="ml-0.5 size-11 rounded-xl border-border-strong bg-surface-2 p-0 text-fg-secondary hover:text-fg-primary focus-visible:ring-2 focus-visible:ring-brand sm:ml-1 sm:h-9 sm:w-auto sm:px-3"
            >
              <LogIn className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Entrar</span>
            </Button>
          )}
        </div>
      </header>

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent className="border-border-strong bg-surface-1 text-fg-primary shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações atuais?</AlertDialogTitle>
            <AlertDialogDescription className="text-fg-secondary">
              Existem alterações que ainda não foram salvas na biblioteca. Ao
              iniciar um novo briefing, esse progresso será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border-strong bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                reset();
                setConfirmResetOpen(false);
              }}
              className="bg-rose-600 text-white shadow-md hover:bg-rose-700"
            >
              Sim, descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
