import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { ArtifactPanel } from "@/components/ArtifactPanel";
import { ThreadList } from "@/components/ThreadList";
import {
  type Artifact,
  type Message,
  type Thread,
  appendMessage,
  createThread,
  deleteThread,
  getThread,
  listThreads,
  updateMessage,
} from "@/lib/chat-storage";
import {
  buildPollinationsUrl,
  callOllama,
  detectIntent,
  looksLikeHtml,
  translatePromptForImage,
} from "@/lib/agent";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversa — Marketing AI" },
      { name: "description", content: "Chat com agente de marketing e painel de artefatos." },
    ],
  }),
  component: ChatRoute,
});

function ChatRoute() {
  const { threadId } = useParams({ from: "/chat/$threadId" });
  const navigate = useNavigate();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [thread, setThread] = useState<Thread | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingIntent, setLoadingIntent] =
    useState<"image" | "email" | "datasheet" | "text" | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate on mount and when route changes
  useEffect(() => {
    setThreads(listThreads());
    const t = getThread(threadId);
    if (!t) {
      // Unknown threadId — create one and replace
      const fresh = createThread();
      navigate({ to: "/chat/$threadId", params: { threadId: fresh.id }, replace: true });
      return;
    }
    setThread(t);
  }, [threadId, navigate]);

  const refresh = useCallback(() => {
    setThreads(listThreads());
    setThread(getThread(threadId));
  }, [threadId]);

  const lastArtifact: Artifact | undefined = useMemo(() => {
    if (!thread) return undefined;
    for (let i = thread.messages.length - 1; i >= 0; i--) {
      const a = thread.messages[i].artifact;
      if (a) return a;
    }
    return undefined;
  }, [thread]);

  const handleSend = useCallback(
    async (text: string) =>generateId() (!thread) return;
      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      appendMessage(thread.id, userMsg);
      refresh();

      const intent = detectIntent(text);
      setIsStreaming(true);
      setLoadingIntent(intent);
      const contgenerateId() AbortController();
      abortRef.current = controller;

      const assistantId = generateId();
      const placeholder: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };
      appendMessage(thread.id, placeholder);
      refresh();

      try {
        if (intent === "image") {
          const englishPrompt = await translatePromptForImage(text, controller.signal);
          const url = buildPollinationsUrl(englishPrompt, { seed: Math.floor(Math.random() * 1e6) });
          // Pre-load before declaring success
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Falha ao carregar imagem do Pollinations"));
            img.src = url;
          });
          updateMessage(thread.id, assistantId, {
            content: "Aqui está a imagem que você pediu! Use o botão **Baixar imagem** no painel ao lado.",
            artifact: { kind: "image", url, prompt: englishPrompt },
          });
        } else {
          const raw = await callOllama(text, intent, controller.signal);
          let artifact: Artifact;
          let reply: string;

          if (intent === "email" || looksLikeHtml(raw)) {
            const html = extractHtml(raw);
            artifact = { kind: "html", html, title: "E-mail" };
            reply = "Aqui está o e-mail HTML pronto. Veja a prévia ao lado e copie o código quando quiser.";
          } else if (intent === "datasheet") {
            artifact = { kind: "markdown", markdown: raw, title: "Ficha técnica" };
            reply = "Ficha técnica gerada! Use **Exportar PDF** no painel ao lado.";
          } else {
            artifact = { kind: "markdown", markdown: raw };
            reply = "Pronto! Conteúdo gerado no painel ao lado.";
          }

          updateMessage(thread.id, assistantId, { content: reply, artifact });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        updateMessage(thread.id, assistantId, {
          content: `⚠️ ${msg}`,
        });
        toast.error(msg);
      } finally {
        setIsStreaming(false);
        setLoadingIntent(undefined);
        abortRef.current = null;
        refresh();
      }
    },
    [thread, refresh],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleNew = useCallback(() => {
    const t = createThread();
    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
  }, [navigate]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteThread(id);
      refresh();
    },
    [refresh],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ThreadList
        threads={threads}
        activeId={threadId}
        onNew={handleNew}
        onDelete={handleDelete}
      />
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(380px,1fr)_minmax(420px,1.2fr)]">
        <section className="flex h-screen flex-col border-r border-border bg-background/40">
          <ChatPanel
            messages={thread?.messages ?? []}
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
          />
        </section>
        <section className="hidden h-screen flex-col bg-card/30 lg:flex">
          <ArtifactPanel
            artifact={isStreaming ? undefined : lastArtifact}
            loading={isStreaming}
            loadingIntent={loadingIntent}
          />
        </section>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}

function extractHtml(raw: string): string {
  const fence = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return raw.trim();
}
