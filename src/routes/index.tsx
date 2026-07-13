import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChatPanel, type ChatMessage } from "@/components/briefflow/ChatPanel";
import { PageBuilder } from "@/components/briefflow/PageBuilder";
import { sendToOllama, type ChatTurn } from "@/lib/ollama";
import type { BuilderState } from "@/types/builder";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BrieFlow | Live Page Builder para Marketing" },
      {
        name: "description",
        content:
          "Crie campanhas de e-mail, posts e banners com IA e edite tudo ao vivo no BrieFlow.",
      },
      { property: "og:title", content: "BrieFlow" },
      {
        property: "og:description",
        content: "Chat inteligente + Live Page Builder para marketing digital.",
      },
    ],
  }),
  component: Home,
});

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [builder, setBuilder] = useState<BuilderState>({ type: "none" });
  const [loading, setLoading] = useState(false);

  const handleSend = async (text: string) => {
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    const history: ChatTurn[] = nextMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await sendToOllama(history);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: res.chat },
      ]);

      if (res.builder && res.builder.type !== "none") {
        setBuilder({ ...res.builder, imageSeed: Math.floor(Math.random() * 1_000_000) });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Falha ao contatar o servidor: ${msg}`);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: `Não consegui contatar o servidor Ollama. Verifique VITE_OLLAMA_API_URL. (${msg})`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="flex h-[100dvh] w-screen flex-col overflow-hidden lg:flex-row">
        
        <section className="flex h-1/2 shrink-0 flex-col border-b lg:h-full lg:w-[420px] lg:border-b-0 lg:border-r">
          <ChatPanel messages={messages} onSend={handleSend} loading={loading} />
        </section>

        {/* A classe min-w-0 aqui é o que resolve o overflow e permite o banner escalar */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <PageBuilder
            state={builder}
            onChange={(patch) => setBuilder((prev) => ({ ...prev, ...patch }))}
          />
        </section>

      </main>
      <Toaster richColors position="top-right" />
    </>
  );
}