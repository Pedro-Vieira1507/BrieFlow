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
  inheritIntentFromContext,
  looksLikeHtml,
  extractHtml,
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
        intent: loadingIntent,
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
    [thread, brandProfile],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!thread) return;

      currentUserPrompt.current = text;
      const contextualPrompt = buildContextualPrompt(text);

      // Atualiza perfil de marca se o utilizador forneceu dados
      const brandPatch = extractBrandInfo(text);
      const hasBrandInfo = Object.keys(brandPatch).length > 0;
      const isSetupRequest = isBrandSetupRequest(text);
      if (hasBrandInfo || isSetupRequest) {
        const currentProfile = getBrandProfile(threadId) ?? { threadId, updatedAt: Date.now() };
        saveBrandProfile({ ...currentProfile, ...brandPatch, threadId });
        setBrandProfile(getBrandProfile(threadId));
      }

      // Regista mensagem do utilizador
      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      appendMessage(thread.id, userMsg);
      refresh();

      // -----------------------------------------------------------------------
      // 1. DETEÇÃO DE INTENÇÃO + MEMÓRIA DE INTENÇÃO
      // -----------------------------------------------------------------------
      let intent = detectIntent(text);
      const objective = detectCopyObjective(text);
      const funnelStage = detectFunnelStage(text, objective);
      const tone = suggestTone(intent as Parameters<typeof suggestTone>[0], objective, text);

      // Encontra a última mensagem do assistente para verificação de contexto
      const messages = [...thread.messages]; // snapshot antes do append acima
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");

      // Herda intenção se o utilizador está a responder a uma pergunta de preflight
      intent = inheritIntentFromContext(intent, lastAssistantMsg as Parameters<typeof inheritIntentFromContext>[1]);

      // -----------------------------------------------------------------------
      // 2. PREFLIGHT: INTERCEPTION — para se faltar briefing
      // -----------------------------------------------------------------------
      if (intent !== "image" && intent !== "text") {
        const missingFields = detectMissingBriefing(contextualPrompt, intent as Parameters<typeof detectMissingBriefing>[1]);

        if (missingFields.length > 0) {
          const questions = buildBriefingQuestions(missingFields);
          const intentLabel: Record<string, string> = {
            banner:    "Banner",
            instagram: "Post Instagram",
            email:     "E-mail HTML",
            linkedin:  "Post LinkedIn",
            landing:   "Landing Page",
            datasheet: "Ficha Técnica",
          };
          const label = intentLabel[intent] ?? intent.toUpperCase();

          const reply =
            `Antes de gerar o **${label}**, preciso de mais informações:\n\n` +
            questions.map((q) => `• ${q}`).join("\n") +
            `\n\nAssim posso garantir um resultado de nível agência e não genérico.`;

          appendMessage(thread.id, {
            id: generateId(),
            role: "assistant",
            content: reply,
            createdAt: Date.now(),
            reasoning: { intent, questions: missingFields },
          });
          refresh();
          return; // PARA a geração — aguarda resposta do utilizador
        }
      }

      // -----------------------------------------------------------------------
      // 3. GERAÇÃO
      // -----------------------------------------------------------------------
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
        reasoning: { intent, objective, funnelStage, tone },
      };
      appendMessage(thread.id, placeholder);
      refresh();

      await new Promise((r) => setTimeout(r, 400));
      setLoadingStage("generating");

      try {
        if (intent === "image") {
          // --- GERAÇÃO DE IMAGEM ---
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
          // --- GERAÇÃO DE TEXTO / HTML (Multi-Agente) ---
          const abort = callOllama(
            contextualPrompt,
            intent as Parameters<typeof callOllama>[1],
            {
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
                    banner:    "Banner 1200×500",
                    instagram: "Post Instagram 1080×1080",
                    email:     "E-mail HTML",
                  };
                  const title = titles[intent] ?? "HTML";
                  artifact = {
                    kind: "html",
                    html,
                    title,
                    prompt: currentUserPrompt.current,
                    intent,
                  };
                  reply = `✅ **${title}** gerado com sucesso. Veja a prévia no painel.`;
                } else {
                  artifact = {
                    kind: "markdown",
                    markdown: fullText,
                    title: intent === "datasheet" ? "Ficha Técnica" : "Conteúdo",
                  };
                  reply = fullText;
                }

                setThreadContentType(thread.id, "html" as ContentType);
                updateMessage(thread.id, assistantId, { content: reply, artifact });
                setIsStreaming(false);
                setLoadingIntent(undefined);
                setLoadingStage(undefined);
                abortRef.current = null;
                refresh();
              },
              onError: (errMsg) => {
                toast.error(`Erro: ${errMsg}`);
                updateMessage(thread.id, assistantId, {
                  content: `❌ Ocorreu um erro: ${errMsg}`,
                });
                setIsStreaming(false);
                setLoadingIntent(undefined);
                setLoadingStage(undefined);
                abortRef.current = null;
                refresh();
              },
            },
            undefined,
            { objective, funnelStage, tone },
          );
          abortRef.current = abort;
        }
      } catch (err) {
        toast.error(`Erro inesperado: ${err}`);
        setIsStreaming(false);
        setLoadingIntent(undefined);
        setLoadingStage(undefined);
        abortRef.current = null;
      }
    },
    [thread, buildContextualPrompt, refresh, threadId],
  );

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsStreaming(false);
    setLoadingIntent(undefined);
    setLoadingStage(undefined);
  }, []);

  const handleNewThread = useCallback(() => {
    const fresh = createThread();
    navigate({ to: "/chat/$threadId", params: { threadId: fresh.id } });
  }, [navigate]);

  const handleDeleteThread = useCallback(
    (id: string) => {
      deleteThread(id);
      const remaining = listThreads();
      if (remaining.length === 0) {
        const fresh = createThread();
        navigate({ to: "/chat/$threadId", params: { threadId: fresh.id }, replace: true });
      } else {
        navigate({ to: "/chat/$threadId", params: { threadId: remaining[0].id }, replace: true });
      }
    },
    [navigate],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Toaster richColors position="top-right" />
      <ThreadList
        threads={threads}
        currentThreadId={threadId}
        onNew={handleNewThread}
        onDelete={handleDeleteThread}
      />
      <main className="flex flex-1 overflow-hidden">
        <section className="flex w-[420px] flex-shrink-0 flex-col border-r border-border">
          <ChatPanel
            thread={thread}
            isStreaming={isStreaming}
            loadingStage={loadingStage}
            onSend={handleSend}
            onStop={handleStop}
            onSelectArtifact={setSelectedArtifact}
          />
        </section>
        <section className="flex flex-1 flex-col overflow-hidden">
          <ArtifactPanel
            artifact={panelArtifact}
            loading={isStreaming && !streamingArtifact}
            loadingIntent={loadingIntent}
          />
        </section>
      </main>
    </div>
  );
}
