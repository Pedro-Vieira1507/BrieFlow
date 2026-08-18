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
        <SidebarHeader className="p-5">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                size="lg" 
                onClick={handleNewBriefing}
                // Design: Gradiente sutil e sombra destacada para o botão principal
                className="bg-gradient-to-r from-brand to-indigo-500 text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 flex justify-center font-bold tracking-wide rounded-xl py-6"
              >
                <PlusCircle className="size-5 mr-2" /> Novo Briefing
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="px-3">
            <SidebarGroupLabel className="text-fg-muted font-semibold text-xs tracking-wider uppercase mb-2">Campanhas Recentes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {history.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-fg-tertiary italic bg-surface-2/50 rounded-lg border border-dashed border-border-subtle">
                    Nenhuma campanha salva ainda.
                  </div>
                ) : (
                  history.slice(0, 8).map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton className="text-fg-secondary hover:text-fg-primary hover:bg-surface-2 transition-all rounded-lg py-5">
                        <History className="size-4 mr-3 opacity-70" />
                        <span className="truncate font-medium">{item.name || "Campanha sem nome"}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 border-t border-border-subtle bg-surface-1/50 backdrop-blur-sm">
          {user ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" className="w-full justify-between bg-surface-2 hover:bg-surface-3 border border-border-subtle rounded-xl transition-all">
                      <div className="flex items-center gap-3 truncate">
                        <div className="size-8 rounded-full bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                          {user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col items-start truncate">
                          <span className="text-sm font-semibold text-fg-primary truncate max-w-[120px]">{user.email}</span>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-brand">
                            Plano {plan ? planLabel(plan.plan) : "Gratuito"}
                          </span>
                        </div>
                      </div>
                      <MoreVertical className="size-4 text-fg-muted" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="end" className="w-56 bg-surface-2 border-border-strong text-fg-primary shadow-2xl rounded-xl p-1.5">
                    <DropdownMenuItem className="cursor-pointer hover:bg-surface-3 rounded-lg py-2.5 font-medium" onClick={() => setSettingsOpen(true)}>
                      <Settings className="mr-2 size-4 text-fg-muted" /> Configurações
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer hover:bg-rose-500/10 hover:text-rose-400 rounded-lg py-2.5 font-medium mt-1" onClick={handleSignOut}>
                      <LogOut className="mr-2 size-4 opacity-80" /> Sair
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
                  className="w-full justify-center bg-surface-2 hover:bg-surface-3 border border-border-subtle text-fg-primary font-semibold rounded-xl py-5 transition-all"
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
        <AlertDialogContent className="bg-surface-1 border-border-strong text-fg-primary shadow-2xl rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Descartar campanha atual?</AlertDialogTitle>
            <AlertDialogDescription className="text-fg-secondary text-sm">
              Você tem alterações no canvas que não foram salvas na biblioteca. Ao iniciar um novo briefing, todo o progresso atual será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="border-border-strong bg-surface-2 text-fg-secondary hover:bg-surface-3 hover:text-fg-primary rounded-xl font-medium">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                reset();
                setConfirmResetOpen(false);
              }}
              className="bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-900/20 rounded-xl font-medium"
            >
              Sim, descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}