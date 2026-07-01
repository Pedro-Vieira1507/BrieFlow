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

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  const [streamingText, setStreamingText] = useState("");
  const [loadingIntent, setLoadingIntent] =
    useState<"image" | "email" | "datasheet" | "text" | undefined>();
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setThreads(listThreads());
    const t = getThread(threadId);
    if (!t) {
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
    async (text: string) => {
      if (!thread) return;

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
      setStreamingText("");
      setLoadingIntent(intent);

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
          // Imagens ainda usam Pollinations (gratuito) — sem streaming necessário
          const abortCtrl = new AbortController();
          abortRef.current = () => abortCtrl.abort();

          const englishPrompt = await translatePromptForImage(text, abortCtrl.signal);
          const url = buildPollinationsUrl(englishPrompt, { seed: Math.floor(Math.random() * 1e6) });

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
          setIsStreaming(false);
          setLoadingIntent(undefined);
          abortRef.current = null;
          refresh();
        } else {
          // Texto/email/datasheet — streaming via SSE
          const abort = callOllama(text, intent, {
            onToken: (token) => {
              setStreamingText((prev) => prev + token);
            },
            onDone: (fullText) => {
              let artifact: Artifact;
              let reply: string;

              if (intent === "email" || looksLikeHtml(fullText)) {
                const html = extractHtml(fullText);
                artifact = { kind: "html", html, title: "E-mail" };
                reply = "Aqui está o e-mail HTML pronto. Veja a prévia ao lado e copie o código quando quiser.";
              } else if (intent === "datasheet") {
                artifact = { kind: "markdown", markdown: fullText, title: "Ficha técnica" };
                reply = "Ficha técnica gerada! Use **Exportar PDF** no painel ao lado.";
              } else {
                artifact = { kind: "markdown", markdown: fullText };
                reply = "Pronto! Conteúdo gerado no painel ao lado.";
              }

              updateMessage(thread.id, assistantId, { content: reply, artifact });
              setIsStreaming(false);
              setStreamingText("");
              setLoadingIntent(undefined);
              abortRef.current = null;
              refresh();
            },
            onError: (msg) => {
              updateMessage(thread.id, assistantId, { content: `⚠️ ${msg}` });
              toast.error(msg);
              setIsStreaming(false);
              setStreamingText("");
              setLoadingIntent(undefined);
              abortRef.current = null;
              refresh();
            },
          });
          abortRef.current = abort;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        updateMessage(thread.id, assistantId, { content: `⚠️ ${msg}` });
        toast.error(msg);
        setIsStreaming(false);
        setStreamingText("");
        setLoadingIntent(undefined);
        abortRef.current = null;
        refresh();
      }
    },
    [thread, refresh],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.();
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
            streamingText={streamingText}
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
