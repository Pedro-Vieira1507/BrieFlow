// routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChatPanel, type ChatMessage } from "@/components/briefflow/ChatPanel";
import { PageBuilder } from "@/components/briefflow/PageBuilder";
import { sendToOllama, type ChatTurn } from "@/lib/ollama";
import type { BuilderState, BrandContext } from "@/types/builder";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Home,
});

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [builder, setBuilder] = useState<BuilderState>({ type: "none" });
  const [scores, setScores] = useState<{persuasion: number, clarity: number, seo: number} | undefined>();
  const [loading, setLoading] = useState(false);
  
  const [brandContext, setBrandContext] = useState<BrandContext>({
    persona: "Profissionais e empresas",
    tone: "Profissional, inovador e persuasivo",
    framework: "AIDA (Atenção, Interesse, Desejo, Ação)",
  });

  const handleSend = async (text: string, isHiddenAction = false) => {
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    
    const nextMessages = isHiddenAction ? messages : [...messages, userMsg];
    
    if (!isHiddenAction) setMessages(nextMessages);
    setLoading(true);

    const history: ChatTurn[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await sendToOllama(history, brandContext);
      if (!isHiddenAction) {
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: res.chat }]);
      }
      if (res.builder && res.builder.type !== "none") {
        setBuilder({ ...res.builder, imageSeed: Math.floor(Math.random() * 1_000_000) });
      }
      if(res.scores) {
          setScores(res.scores)
      }
    } catch (err) {
      toast.error(`Falha ao conectar: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="flex h-[100dvh] w-screen flex-col overflow-hidden lg:flex-row">
        <section className="flex h-1/2 shrink-0 flex-col border-b lg:h-full lg:w-[420px] lg:border-b-0 lg:border-r">
          <ChatPanel 
            messages={messages} 
            onSend={(t) => handleSend(t, false)} 
            loading={loading}
            brandContext={brandContext}
            setBrandContext={setBrandContext}
          />
        </section>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background relative">
          <PageBuilder
            state={builder}
            onChange={(patch) => setBuilder((prev) => ({ ...prev, ...patch }))}
            loading={loading}
            onRefine={(prompt) => handleSend(prompt, true)}
            scores={scores}
          />
        </section>
      </main>
      <Toaster richColors position="top-right" />
    </>
  );
}