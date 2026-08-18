// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { ChatPanel } from "@/components/briefflow/ChatPanel";
import { PageBuilder } from "@/components/briefflow/PageBuilder";
import { BrandPalette } from "@/components/briefflow/BrandPalette";
import { useBriefflowStore } from "@/store/briefflow";
import { useBriefflowAgent } from "@/hooks/useBriefflowAgent";
import { cn } from "@/lib/utils";
import { AuthModal } from "@/components/briefflow/AuthModal";
import { ProfileSettingsModal } from "@/components/briefflow/ProfileSettingsModal";
import { LibraryModal } from "@/components/briefflow/LibraryModal";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { brandContext, authOpen, setAuthOpen } = useBriefflowStore();
  const { handleSend } = useBriefflowAgent();
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    // UX: Adição de animate-in fade-in para entrada suave da aplicação
    <main className="flex h-[100dvh] w-screen overflow-hidden bg-surface-0 animate-in fade-in duration-700">
      {/* Painel 1: Chat com IA (Desktop) */}
      <aside className={cn("hidden lg:flex lg:h-full lg:w-[380px] lg:shrink-0 lg:flex-col border-r border-border-subtle bg-surface-1 transition-all duration-300 shadow-xl z-10")}>
        {brandContext.site?.colors && <BrandPalette colors={brandContext.site.colors} />}
        <ChatPanel onSend={(t) => handleSend(t, false)} />
      </aside>

      {/* Painel 2: Canvas Page Builder */}
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-surface-0">
        <PageBuilder onRefine={(p) => handleSend(p, true)} onOpenSettings={() => setSettingsOpen(true)} />

        {/* Gatilho do Chat no Mobile */}
        <div className="lg:hidden">
          <Sheet open={mobileChatOpen} onOpenChange={setMobileChatOpen}>
            <SheetTrigger asChild>
              <Button size="lg" className={cn("fixed bottom-5 right-5 z-40 h-14 gap-2 rounded-full pl-5 pr-6 bg-brand text-brand-fg shadow-[var(--shadow-brand)] hover:scale-105 transition-all duration-300 active:scale-95")}>
                <MessageSquare className="size-5" /> Falar com IA
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[92dvh] border-t border-border-strong bg-surface-1 p-0 rounded-t-[1.5rem] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
              {brandContext.site?.colors && <BrandPalette colors={brandContext.site.colors} />}
              <ChatPanel onSend={(t) => handleSend(t, false)} />
            </SheetContent>
          </Sheet>
        </div>
      </section>

      {/* Modais Globais */}
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <ProfileSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <LibraryModal />
      <Toaster richColors position="top-right" theme="dark" />
    </main>
  );
}