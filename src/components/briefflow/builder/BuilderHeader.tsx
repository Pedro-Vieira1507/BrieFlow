import { useEffect, useState } from "react";
import { Loader2, Save, Download, MessageSquare, SearchCheck, UserCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AuthModal } from "../AuthModal";
import { supabase } from "@/lib/supabase";
import { useBriefflowStore } from "@/store/briefflow";

interface Props {
  isSaveable: boolean;
  isSaving: boolean;
  loading?: boolean;
  scores?: { persuasion: number; clarity: number; seo: number };
  onExport: () => void;
  onSave: () => void;
}

export function BuilderHeader({
  isSaveable,
  isSaving,
  loading,
  scores,
  onExport,
  onSave,
}: Props) {
  const [authOpen, setAuthOpen] = useState(false);
  const { user, setUser } = useBriefflowStore();

  // Escuta as mudanças de login/logout em tempo real
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [setUser]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3",
          "border-b border-border-subtle px-6 py-4 lg:px-8",
          "glass-strong",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 border border-border-strong">
            <img
              src="/assets/icone-brieflow.png"
              alt=""
              className="size-7"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">
              Painel de peças
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
              Live preview
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {scores && isSaveable && (
            <TooltipProvider>
              <div
                className={cn(
                  "mx-1 hidden h-8 items-center gap-4 border-x border-border-strong px-3",
                  "text-[11px] font-semibold uppercase tracking-wider text-fg-tertiary md:flex",
                )}
              >
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-rose-500" />
                    {scores.persuasion}
                  </TooltipTrigger>
                  <TooltipContent>Índice de persuasão da copy</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1.5">
                    <SearchCheck className="size-3.5 text-brand" />
                    {scores.clarity}
                  </TooltipTrigger>
                  <TooltipContent>Clareza e legibilidade</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!isSaveable}
            className="border-border-strong bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary"
          >
            <Download className="mr-2 size-3.5" />
            Exportar
          </Button>

          <Button
            size="sm"
            disabled={!isSaveable || loading || isSaving}
            onClick={() => {
              if (!user) {
                setAuthOpen(true); // Abre o modal se não estiver logado
              } else {
                onSave(); // Salva direto se já estiver logado
              }
            }}
            className={cn(
              "bg-brand text-brand-fg hover:brightness-110 transition-all",
              "shadow-[var(--shadow-brand)] disabled:shadow-none",
            )}
          >
            {isSaving ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-2 size-3.5" />
            )}
            Salvar
          </Button>

          {/* NOVO: Menu do Usuário */}
          {user ? (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => supabase?.auth.signOut()} 
              title="Sair da conta"
              className="text-fg-muted hover:text-rose-400 hover:bg-rose-400/10 ml-2"
            >
              <LogOut className="size-4" />
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setAuthOpen(true)} 
              title="Fazer Login"
              className="text-fg-muted hover:text-brand hover:bg-brand/10 ml-2"
            >
              <UserCircle className="size-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Renderiza o modal invisível que será aberto pelo estado authOpen */}
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}