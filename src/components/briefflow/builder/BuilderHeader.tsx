// src/components/briefflow/builder/BuilderHeader.tsx
import { useState } from "react";
import { Loader2, Save, Download, Settings, FolderKanban, LogOut, LogIn, PlusCircle } from "lucide-react";
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
  const { user, reset, builder, setAuthOpen, setLibraryOpen } = useBriefflowStore();
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
          "sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3",
          "border-b border-border-subtle px-4 py-3 lg:px-6 lg:py-4",
          "glass-strong",
        )}
      >
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">
              Canvas de Criação
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
              Preview em Tempo Real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!isSaveable || loading || isExporting}
            className="border-border-strong bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary disabled:opacity-50 transition-all rounded-lg text-xs"
          >
            {isExporting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Download className="mr-2 size-3.5" />}
            Exportar
          </Button>

          <Button
            size="sm"
            disabled={!isSaveable || loading || isSaving}
            onClick={onSave}
            className={cn(
              "bg-brand text-brand-fg hover:brightness-110 transition-all rounded-lg text-xs font-medium",
              "shadow-[var(--shadow-brand)] disabled:shadow-none disabled:opacity-50",
            )}
          >
            {isSaving ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Save className="mr-2 size-3.5" />}
            Salvar na Biblioteca
          </Button>

          {/* PERFIL E MENU DE OPÇÕES */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-full bg-brand text-white font-bold text-xs shadow-md border border-white/10 hover:brightness-110 transition-all ml-1 cursor-pointer"
                  title={user.email ?? "Perfil"}
                >
                  {user.email?.charAt(0).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className="w-56 bg-surface-2 border-border-strong text-fg-primary shadow-2xl p-1">
                <div className="px-3 py-2.5 border-b border-border-subtle">
                  <p className="text-xs font-bold text-fg-primary truncate">{user.email}</p>
                  <p className="text-[10px] font-medium text-fg-muted uppercase tracking-wider mt-0.5">
                    Plano {plan ? planLabel(plan.plan) : "Gratuito"}
                  </p>
                </div>

                <DropdownMenuItem
                  className="cursor-pointer hover:bg-surface-3 my-0.5 text-xs font-medium text-fg-secondary hover:text-fg-primary"
                  onClick={handleNewBriefing}
                >
                  <PlusCircle className="mr-2 size-4 text-brand" /> Novo Briefing
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
                  <Settings className="mr-2 size-4 text-fg-muted" /> Configurações
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
              className="border-border-strong bg-surface-2 text-fg-secondary hover:text-fg-primary text-xs rounded-lg ml-1"
            >
              <LogIn className="mr-1.5 size-3.5" /> Entrar
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
              Você tem alterações no canvas que não foram salvas na biblioteca. Ao iniciar um novo briefing, todo o progresso atual será perdido.
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