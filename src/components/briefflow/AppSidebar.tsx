// src/components/briefflow/AppSidebar.tsx
import { useEffect, useState } from "react";
import { PlusCircle, Settings, LogOut, History, MoreVertical, LogIn } from "lucide-react";
import { 
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, 
  SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupContent, SidebarGroupLabel 
} from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useBriefflowStore } from "@/store/briefflow";
import { getSavedAssets } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { AuthModal } from "./AuthModal";
import { ProfileSettingsModal } from "./ProfileSettingsModal";
import { useCredits, planLabel } from "@/hooks/useCredits";

export function AppSidebar() {
  const { user, reset, builder, authOpen, setAuthOpen } = useBriefflowStore();
  const [history, setHistory] = useState<any[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const { plan } = useCredits();

  useEffect(() => {
    if (user) {
      getSavedAssets().then((data) => setHistory(data || [])).catch(() => {});
    } else {
      setHistory([]);
    }
  }, [user]);

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
      <Sidebar className="border-r border-border-subtle bg-surface-1">
        <SidebarHeader className="p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                size="lg" 
                onClick={handleNewBriefing}
                className="bg-brand text-brand-fg hover:brightness-110 hover:bg-brand transition-all shadow-[var(--shadow-brand)] flex justify-center font-semibold tracking-wide"
              >
                <PlusCircle className="size-5 mr-2" /> Novo Briefing
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-fg-muted font-semibold">Campanhas Recentes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {history.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-fg-tertiary italic">
                    Nenhuma campanha salva ainda.
                  </div>
                ) : (
                  history.slice(0, 8).map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton className="text-fg-secondary hover:text-fg-primary hover:bg-surface-2 transition-colors">
                        <History className="size-4 mr-2" />
                        <span className="truncate">{item.name || "Campanha sem nome"}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 border-t border-border-subtle">
          {user ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" className="w-full justify-between bg-surface-2 hover:bg-surface-3 border border-border-subtle">
                      <div className="flex items-center gap-2 truncate">
                        <div className="size-7 rounded-full bg-brand flex items-center justify-center text-white font-bold text-xs">
                          {user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col items-start truncate">
                          <span className="text-xs font-medium text-fg-primary truncate max-w-[120px]">{user.email}</span>
                          <span className="text-[10px] text-fg-muted">
                            Plano {plan ? planLabel(plan.plan) : "Gratuito"}
                          </span>
                        </div>
                      </div>
                      <MoreVertical className="size-4 text-fg-muted" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="end" className="w-56 bg-surface-2 border-border-strong text-fg-primary shadow-xl">
                    <DropdownMenuItem className="cursor-pointer hover:bg-surface-3" onClick={() => setSettingsOpen(true)}>
                      <Settings className="mr-2 size-4" /> Configurações
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer hover:bg-rose-500/10 hover:text-rose-400" onClick={handleSignOut}>
                      <LogOut className="mr-2 size-4" /> Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => setAuthOpen(true)}
                  className="w-full justify-center bg-surface-2 hover:bg-surface-3 border border-border-subtle text-fg-secondary"
                >
                  <LogIn className="mr-2 size-4" /> Fazer Login
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarFooter>
      </Sidebar>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <ProfileSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

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