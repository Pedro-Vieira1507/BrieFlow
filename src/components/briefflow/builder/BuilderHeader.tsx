// src/components/briefflow/builder/BuilderHeader.tsx
import { useEffect, useState } from "react";
import { Loader2, Save, Download, UserCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuthModal } from "../AuthModal";
import { supabase } from "@/lib/supabase";
import { useBriefflowStore } from "@/store/briefflow";

interface Props {
  isSaveable: boolean;
  isSaving: boolean;
  isExporting: boolean;
  loading?: boolean;
  onExport: () => void;
  onSave: () => void;
}

export function BuilderHeader({
  isSaveable,
  isSaving,
  isExporting,
  loading,
  onExport,
  onSave,
}: Props) {
  const [authOpen, setAuthOpen] = useState(false);
  const { user, setUser } = useBriefflowStore();

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
              alt="Logo BrieFlow"
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
          {/* BOTÃO EXPORTAR */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!isSaveable || loading || isExporting}
            className="border-border-strong bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary disabled:opacity-50 transition-all"
          >
            {isExporting ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <Download className="mr-2 size-3.5" />
            )}
            Exportar
          </Button>

          {/* BOTÃO SALVAR */}
          <Button
            size="sm"
            disabled={!isSaveable || loading || isSaving}
            onClick={() => {
              if (!user) {
                setAuthOpen(true);
              } else {
                onSave();
              }
            }}
            className={cn(
              "bg-brand text-brand-fg hover:brightness-110 transition-all",
              "shadow-[var(--shadow-brand)] disabled:shadow-none disabled:opacity-50",
            )}
          >
            {isSaving ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-2 size-3.5" />
            )}
            Salvar
          </Button>

          {/* MENUS DO USUÁRIO */}
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

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}