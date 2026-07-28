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

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { brandContext } = useBriefflowStore();
  const { handleSend } = useBriefflowAgent();
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <>
      <main className={cn("flex h-[100dvh] w-screen overflow-hidden bg-surface-0 flex-col lg:flex-row")}>
        <aside className={cn("hidden lg:flex lg:h-full lg:w-[420px] lg:shrink-0 lg:flex-col border-r border-border-subtle bg-surface-1")}>
          {brandContext.site?.colors && <BrandPalette colors={brandContext.site.colors} />}
          <ChatPanel onSend={(t) => handleSend(t, false)} />
        </aside>
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-surface-0">
          <PageBuilder onRefine={(p) => handleSend(p, true)} />
          <div className="lg:hidden">
            <Sheet open={mobileChatOpen} onOpenChange={setMobileChatOpen}>
              <SheetTrigger asChild>
                <Button size="lg" className={cn("fixed bottom-5 right-5 z-40 h-12 gap-2 rounded-full pl-4 pr-5 bg-brand text-brand-fg shadow-[var(--shadow-brand)] hover:brightness-110 transition-all")}>
                  <MessageSquare className="size-4" /> Chat com IA
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[92dvh] border-t border-border-strong bg-surface-1 p-0">
                {brandContext.site?.colors && <BrandPalette colors={brandContext.site.colors} />}
                <ChatPanel onSend={(t) => handleSend(t, false)} />
              </SheetContent>
            </Sheet>
          </div>
        </section>
      </main>
      <Toaster richColors position="top-right" theme="dark" />
    </>
  );
}