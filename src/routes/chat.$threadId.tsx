import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { ArtifactPanel } from "@/components/ArtifactPanel";
import { ThreadList } from "@/components/ThreadList";
import {
  type Artifact,
  type Message,
  type Thread,
  type ContentType,
  appendMessage,
  createThread,
  deleteThread,
  getThread,
  listThreads,
  updateMessage,
  setThreadContentType,
} from "@/lib/chat-storage";
import {
  buildPollinationsUrl,
  callOllama,
  detectIntent,
  detectCopyObjective,
  detectFunnelStage,
  suggestTone,
  detectMissingBriefing,
  buildBriefingQuestions,
  looksLikeHtml,
  translatePromptForImage,
} from "@/lib/agent";
import {
  type BrandProfile,
  getBrandProfile,
  saveBrandProfile,
  brandContextBlock,
  extractBrandInfo,
  isBrandSetupRequest,
} from "@/lib/brand-memory";
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
      { title: "Conversa — BrieFlow" },
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
    useState<"image" | "email" | "banner" | "instagram" | "datasheet" | "text" | undefined | string>();
  const [loadingStage, setLoadingStage] = useState<
    "classifying" | "planning" | "generating" | "validating" | "rendering" | undefined
  >();
  const [brandProfile, setBrandProfile] = useState<BrandProfile | undefined>();
  
  const currentUserPrompt = useRef<string>("");
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | undefined>();
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
    setBrandProfile(getBrandProfile(threadId));
    setSelectedArtifact(undefined);
  }, [threadId, navigate]);

  const refresh = useCallback(() => {
    setThreads(listThreads());
    setThread(getThread(threadId));
    setBrandProfile(getBrandProfile(threadId));
  }, [threadId]);

  const lastArtifact: Artifact | undefined = useMemo(() => {
    if (!thread) return undefined;
    for (let i = thread.messages.length - 1; i >= 0; i--) {
      const a = thread.messages[i].artifact;
      if (a) return a;
    }
    return undefined;
  }, [thread]);

  const streamingArtifact: Artifact | undefined = useMemo(() => {
    if (!isStreaming || !streamingText) return undefined;
    if (
      loadingIntent === "email" ||
      loadingIntent === "banner" ||
      loadingIntent === "instagram" ||
      looksLikeHtml(streamingText)
    ) {
      return {
        kind: "html",
        html: extractHtml(streamingText),
        title: "A gerar...",
        prompt: currentUserPrompt.current,
        intent: loadingIntent
      };
    }
    return {
      kind: "markdown",
      markdown: streamingText,
      title: loadingIntent === "datasheet" ? "Ficha Técnica (a gerar...)" : "Conteúdo (a gerar...)",
    };
  }, [isStreaming, streamingText, loadingIntent]);

  const panelArtifact = isStreaming
    ? streamingArtifact
    : (selectedArtifact ?? lastArtifact);

  const buildContextualPrompt = useCallback(
    (userText: string): string => {
      if (!thread) return userText;

      const brandCtx = brandContextBlock(brandProfile);
      const history = thread.messages
        .slice(-10)
        .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
        .join("\n");

      const parts: string[] = [];
      if (brandCtx) parts.push(brandCtx);
      if (history) {
        parts.push("=== HISTÓRICO DESTA CONVERSA ===");
        parts.push(history);
        parts.push("===");
      }
      parts.push(`Usuário: ${userText}`);

      return parts.join("\n\n");
    },
    [thread, brandProfile]
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!thread) return;

      currentUserPrompt.current = text;
      const contextualPrompt = buildContextualPrompt(text);

      const brandPatch = extractBrandInfo(text);
      const hasBrandInfo = Object.keys(brandPatch).length > 0;
      const isSetupRequest = isBrandSetupRequest(text);

      if (hasBrandInfo || isSetupRequest) {
        const currentProfile = getBrandProfile(threadId) ?? { threadId, updatedAt: Date.now() };
        saveBrandProfile({ ...currentProfile, ...brandPatch, threadId });
        setBrandProfile(getBrandProfile(threadId));
      }

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      appendMessage(thread.id, userMsg);
      refresh();

      let intent = detectIntent(text);
      const objective = detectCopyObjective(text);
      const funnelStage = detectFunnelStage(text, objective);
      const tone = suggestTone(intent as any, objective, text);

      // --- HERANÇA DE CONTEXTO (PREFLIGHT) ---
      // Se a última mensagem foi uma pergunta de preflight do agente,
      // e o usuário respondeu com poucas palavras, herdamos a intenção original.
      const lastMsg = thread.messages[thread.messages.length - 1];
      const isAnsweringPreflight = lastMsg?.role === "assistant" && (lastMsg.reasoning?.questions?.length ?? 0) > 0;
      
      if (isAnsweringPreflight && intent === "text") {
         intent = (lastMsg.reasoning?.intent as any) || "text";
      }

      // --- PREFLIGHT: VALIDATION BLOCK ---
      if (intent !== "image" && intent !== "text") {
        const missingFields = detectMissingBriefing(contextualPrompt, intent as any);
        if (missingFields.length > 0) {
           const questions = buildBriefingQuestions(missingFields);
           const reply = `Antes de gerar o ${intent.toUpperCase()}, percebi que faltam algumas informações estratégicas:\n\n` +
                         questions.map(q => `- **${q}**`).join('\n') +
                         `\n\nPor favor, forneça esses detalhes para garantir o melhor resultado, ou configure o perfil da marca acima.`;

           const assistantId = generateId();
           appendMessage(thread.id, {
             id: assistantId,
             role: "assistant",
             content: reply,
             createdAt: Date.now(),
             reasoning: {
               intent,
               questions: missingFields
             }
           });
           refresh();
           return; 
        }
      }

      setIsStreaming(true);
      setStreamingText("");
      setLoadingIntent(intent);
      setLoadingStage("classifying");
      setSelectedArtifact(undefined);

      const assistantId = generateId();
      const placeholder: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        reasoning: {
          intent,
          objective,
          funnelStage,
          tone
        }
      };
      appendMessage(thread.id, placeholder);
      refresh();

      await new Promise((r) => setTimeout(r, 400));
      setLoadingStage("generating");

      try {
        if (intent === "image") {
          const abortCtrl = new AbortController();
          abortRef.current = () => abortCtrl.abort();

          const englishPrompt = await translatePromptForImage(text, abortCtrl.signal);
          const url = buildPollinationsUrl(englishPrompt, { seed: Math.floor(Math.random() * 1e6) });

          setLoadingStage("rendering");
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Falha ao carregar imagem do Pollinations"));
            img.src = url;
          });

          setThreadContentType(thread.id, "image" as ContentType);
          updateMessage(thread.id, assistantId, {
            content: "🖼️ Imagem gerada! Veja a prévia no painel ao lado.",
            artifact: { kind: "image", url, prompt: englishPrompt },
          });
          setIsStreaming(false);
          setLoadingIntent(undefined);
          setLoadingStage(undefined);
          abortRef.current = null;
          refresh();
        } else {
          const abort = callOllama(contextualPrompt, intent as any, {
            onToken: (token) => {
              setStreamingText((prev) => prev + token);
            },
            onDone: (fullText) => {
              let artifact: Artifact;
              let reply: string;

              if (
                intent === "banner" ||
                intent === "instagram" ||
                intent === "email" ||
                looksLikeHtml(fullText)
              ) {
                const html = extractHtml(fullText);
                const titles: Record<string, string> = {
                  banner: "Banner",
                  instagram: "Post Instagram",
                  email: "E-mail HTML",
                };
                const title = titles[intent] ?? "HTML";
                artifact = { kind: "html", html, title, prompt: text, intent };
                reply = `✅ ${title} pronto! Veja a prévia e copie o código no painel ao lado.`;
              } else if (intent === "datasheet") {
                artifact = { kind: "markdown", markdown: fullText, title: "Ficha Técnica" };
                reply = "✅ Ficha técnica gerada! Use **Exportar PDF** no painel ao lado.";
              } else {
                artifact = { kind: "markdown", markdown: fullText };
                reply = "✅ Conteúdo pronto! Veja o resultado completo no painel ao lado.";
              }

              setThreadContentType(thread.id, intent as ContentType);
              updateMessage(thread.id, assistantId, { content: reply, artifact });
              setIsStreaming(false);
              setStreamingText("");
              setLoadingIntent(undefined);
              setLoadingStage(undefined);
              abortRef.current = null;
              refresh();
            },
            onError: (msg) => {
              updateMessage(thread.id, assistantId, { content: `⚠️ ${msg}` });
              toast.error(msg);
              setIsStreaming(false);
              setStreamingText("");
              setLoadingIntent(undefined);
              setLoadingStage(undefined);
              abortRef.current = null;
              refresh();
            },
          }, undefined, {
            objective, funnelStage, tone
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
        setLoadingStage(undefined);
        abortRef.current = null;
        refresh();
      }
    },
    [thread, refresh, buildContextualPrompt, threadId]
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
    [refresh]
  );

  const handleSaveBrand = useCallback(
    (patch: Partial<BrandProfile>) => {
      const current = getBrandProfile(threadId) ?? { threadId, updatedAt: Date.now() };
      saveBrandProfile({ ...current, ...patch, threadId });
      setBrandProfile(getBrandProfile(threadId));
      toast.success("Perfil de marca salvo para esta conversa!");
    },
    [threadId]
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
            brandProfile={brandProfile}
            onSaveBrand={handleSaveBrand}
            loadingStage={loadingStage}
            onViewArtifact={setSelectedArtifact}
          />
        </section>
        <section className="hidden h-screen flex-col bg-card/30 lg:flex">
          <ArtifactPanel
            artifact={panelArtifact}
            loading={isStreaming && !streamingText}
            loadingIntent={loadingIntent}
          />
        </section>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
export function extractHtml(raw: string): string {
  // Usando new RegExp para evitar problemas com formatação de blocos de código
  const regex = new RegExp("
http://googleusercontent.com/immersive_entry_chip/0