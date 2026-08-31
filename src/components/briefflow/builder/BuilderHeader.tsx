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
}

export function BuilderHeader({
  isSaveable,
  isSaving,
  isExporting,
  loading,
  onExport,
  onSave,
  onOpenSettings,
}: Props) {
  const { user, reset, builder, setAuthOpen, setLibraryOpen } =
    useBriefflowStore();
  const { plan } = useCredits();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
  };

  const handleNewBriefing = () => {
    if (builder.type !== "none") {
      setConfirmResetOpen(true);
    } else {
      reset();
    }
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
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/8 px-2 py-0.5 text-[9px] font-semibold text-emerald-300/90 md:inline-flex">
                <span className="size-1 rounded-full bg-emerald-400" /> Ao vivo
              </span>
            </div>
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-fg-muted sm:text-[10px]">
              Canvas em tempo real
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Exportar campanha"
            title="Exportar campanha"
            onClick={onExport}
            disabled={!isSaveable || loading || isExporting}
            className="size-9 rounded-xl border-border-strong bg-surface-1/50 p-0 text-fg-secondary transition hover:border-brand/30 hover:bg-surface-2 hover:text-fg-primary disabled:opacity-40 sm:h-9 sm:w-auto sm:px-3"
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
              "size-9 rounded-xl bg-brand p-0 text-xs font-semibold text-brand-fg transition hover:-translate-y-px hover:brightness-110 sm:h-9 sm:w-auto sm:px-3",
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

          {/* PERFIL E MENU DE OPÇÕES */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-0.5 flex size-9 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-brand to-violet-500 text-xs font-bold text-white shadow-[var(--shadow-brand)] transition hover:brightness-110 sm:ml-1"
                  title={user.email ?? "Perfil"}
                  aria-label="Abrir menu do perfil"
                >
                  {user.email?.charAt(0).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="end"
                className="w-56 bg-surface-2 border-border-strong text-fg-primary shadow-2xl p-1"
              >
                <div className="px-3 py-2.5 border-b border-border-subtle">
                  <p className="text-xs font-bold text-fg-primary truncate">
                    {user.email}
                  </p>
                  <p className="text-[10px] font-medium text-fg-muted uppercase tracking-wider mt-0.5">
                    Plano {plan ? planLabel(plan.plan) : "Gratuito"}
                  </p>
                </div>

                <DropdownMenuItem
                  className="cursor-pointer hover:bg-surface-3 my-0.5 text-xs font-medium text-fg-secondary hover:text-fg-primary"
                  onClick={handleNewBriefing}
                >
                  <PlusCircle className="mr-2 size-4 text-brand" /> Novo
                  Briefing
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="cursor-pointer hover:bg-surface-3 my-0.5 text-xs font-medium text-fg-secondary hover:text-fg-primary"
                  onClick={() => setLibraryOpen(true)}
                >
                  <FolderKanban className="mr-2 size-4 text-brand" /> Biblioteca
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="cursor-pointer hover:bg-surface-3 my-0.5 text-xs font-medium text-fg-secondary hover:text-fg-primary"
                  onClick={onOpenSettings}
                >
                  <Settings className="mr-2 size-4 text-fg-muted" />{" "}
                  Configurações
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-border-subtle my-1" />

                <DropdownMenuItem
                  className="cursor-pointer hover:bg-rose-500/10 hover:text-rose-400 text-xs font-medium text-rose-400/90"
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
              className="ml-0.5 size-9 rounded-xl border-border-strong bg-surface-2 p-0 text-fg-secondary hover:text-fg-primary sm:ml-1 sm:h-9 sm:w-auto sm:px-3"
            >
              <LogIn className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Entrar</span>
            </Button>
          )}
        </div>
      </header>

      {/* MODAL DE CONFIRMAÇÃO DE NOVO BRIEFING */}
      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent className="bg-surface-1 border-border-strong text-fg-primary shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar campanha atual?</AlertDialogTitle>
            <AlertDialogDescription className="text-fg-secondary">
              Você tem alterações no canvas que não foram salvas na biblioteca.
              Ao iniciar um novo briefing, todo o progresso atual será perdido.
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
              className="bg-rose-600 text-white hover:bg-rose-700 shadow-md"
            >
              Sim, descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
