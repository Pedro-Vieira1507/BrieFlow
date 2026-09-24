import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { MessageSquareText, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useBriefflowAgent } from "@/hooks/useBriefflowAgent";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";

import { BrandPalette } from "./BrandPalette";
import { ChatPanel } from "./ChatPanel";
import { PageBuilder } from "./PageBuilder";
import { CONTENT_FORMATS } from "@/lib/plans";
import type { MaterialType } from "@/types/brief";
import { AuthModal } from "./AuthModal";

const LibraryModal = lazy(() =>
  import("./LibraryModal").then((module) => ({ default: module.LibraryModal })),
);
const ProfileSettingsModal = lazy(() =>
  import("./ProfileSettingsModal").then((module) => ({
    default: module.ProfileSettingsModal,
  })),
);
const ContentCatalogModal = lazy(() =>
  import("./ContentCatalogModal").then((module) => ({
    default: module.ContentCatalogModal,
  })),
);

export function WorkspaceShell() {
  const {
    brandContext,
    authOpen,
    builder,
    libraryOpen,
    messages,
    setAuthOpen,
    user,
  } = useBriefflowStore();
  const { handleSend, generateCampaign, regenerateChannel } =
    useBriefflowAgent();
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number | undefined>();

  useEffect(() => {
    if (!mobileChatOpen || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const resize = () => setKeyboardHeight(viewport.height);
    resize();
    viewport.addEventListener("resize", resize);
    return () => viewport.removeEventListener("resize", resize);
  }, [mobileChatOpen]);

  const openAssistant = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      document.querySelector<HTMLTextAreaElement>("aside textarea")?.focus();
    } else {
      setMobileChatOpen(true);
    }
  };
  const [pendingMaterial, setPendingMaterial] = useState<MaterialType | null>(
    null,
  );

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const sendFromMobile = (text: string) => {
    handleSend(text, false);
  };

  const openFormat = useCallback(
    (material: MaterialType) => {
      const hasBriefing =
        messages.some((message) => message.role === "user") ||
        Boolean(builder.discoveryPlan);
      if (!hasBriefing) {
        void handleSend(
          `Quero criar ${CONTENT_FORMATS[material].label}. Antes de gerar, conduza um briefing objetivo comigo.`,
          false,
        );
        setMobileChatOpen(true);
        return;
      }
      void regenerateChannel(material);
    },
    [builder.discoveryPlan, handleSend, messages, regenerateChannel],
  );

  useEffect(() => {
    if (!user || !pendingMaterial) return;
    const material = pendingMaterial;
    setPendingMaterial(null);
    openFormat(material);
  }, [openFormat, pendingMaterial, user]);

  const handleSelectFormat = (material: MaterialType) => {
    if (!user) {
      setPendingMaterial(material);
      setAuthOpen(true);
      return;
    }
    openFormat(material);
  };

  return (
    <main className="app-shell relative flex h-[100dvh] w-full overflow-hidden bg-surface-0 text-fg-primary">
      <div
        aria-hidden
        className="app-ambient pointer-events-none absolute inset-0"
      />

      <aside
        className={cn(
          "relative z-20 hidden h-full w-[404px] shrink-0 flex-col lg:flex",
          "border-r border-border-subtle bg-surface-1/95 shadow-[18px_0_60px_-42px_rgba(0,0,0,0.9)] backdrop-blur-2xl",
        )}
      >
        {brandContext.site?.colors && (
          <BrandPalette colors={brandContext.site.colors} />
        )}
        <ChatPanel onSend={(text) => handleSend(text, false)} />
      </aside>

      <section className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <PageBuilder
          onGenerateCampaign={generateCampaign}
          onRetry={regenerateChannel}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenChat={openAssistant}
          onOpenContentCatalog={() => setCatalogOpen(true)}
        />

        <div className="lg:hidden">
          <Sheet open={mobileChatOpen} onOpenChange={setMobileChatOpen}>
            <SheetTrigger asChild>
              <Button
                size="lg"
                aria-label="Abrir assistente BrieFlow"
                className={cn(
                  "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 h-13 rounded-2xl px-4",
                  "border border-white/10 bg-brand text-brand-fg shadow-[var(--shadow-brand)]",
                  "transition duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98]",
                )}
              >
                <span className="mr-2 grid size-7 place-items-center rounded-lg bg-white/12">
                  <MessageSquareText className="size-4" />
                </span>
                Assistente
                <Sparkles className="ml-2 size-3.5 opacity-70" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              style={
                keyboardHeight ? { maxHeight: keyboardHeight - 8 } : undefined
              }
              className="flex h-[94dvh] flex-col rounded-t-[28px] border-t border-border-strong bg-surface-1 p-0 shadow-[0_-24px_80px_rgba(0,0,0,0.55)]"
            >
              <SheetTitle className="sr-only">
                Assistente criativo BrieFlow
              </SheetTitle>
              <SheetDescription className="sr-only">
                Converse sobre o briefing e refine as peças da campanha.
              </SheetDescription>
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />
              {brandContext.site?.colors && (
                <BrandPalette colors={brandContext.site.colors} />
              )}
              <ChatPanel onSend={sendFromMobile} />
            </SheetContent>
          </Sheet>
        </div>
      </section>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <Suspense fallback={null}>
        {settingsOpen ? (
          <ProfileSettingsModal
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />
        ) : null}
        {libraryOpen ? <LibraryModal /> : null}
        {catalogOpen ? (
          <ContentCatalogModal
            open={catalogOpen}
            onOpenChange={setCatalogOpen}
            onSelect={handleSelectFormat}
          />
        ) : null}
      </Suspense>
      <Toaster
        richColors
        position="top-right"
        offset={{ top: 80 }}
        mobileOffset={{ top: 80 }}
        theme="dark"
      />
    </main>
  );
}
