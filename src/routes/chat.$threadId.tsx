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

      const intent = detectIntent(text);
      const objective = detectCopyObjective(text);
      const funnelStage = detectFunnelStage(text, objective);
      const tone = suggestTone(intent as any, objective, text);

      // --- PREFLIGHT: VALIDATION BLOCK ---
      // Se não for imagem nem texto puro, valida os dados necessários.
      if (intent !== "image" && intent !== "text") {
        const missingFields = detectMissingBriefing(contextualPrompt, intent as any);
        if (missingFields.length > 0) {
           const questions = buildBriefingQuestions(missingFields);
           const reply = `Antes de gerar o ${intent.toUpperCase()}, percebi que faltam algumas informações estratégicas:\n\n` +
                         questions.map(q => `- **${q}**`).join('\n') +
                         `\n\nPor favor, forneça esses detalhes para garantir o melhor resultado, ou [configure o perfil da marca acima](#).`;

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
           return; // Aborta e obriga o usuário a responder.
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
          }); // Passando o reasoning para API
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

function extractHtml(raw: string): string {
  const fence = raw.match(/
http://googleusercontent.com/immersive_entry_chip/0

---

### 4. System Prompts Blindados (Ollama API)
Correção do HTML para evitar que o código de E-mail vaze estilos e impedir que os Banners ignorem a paleta de cores ou exijam composites fotorealistas complexos demais, priorizando "color blocking" (design limpo).

📄 **Substitua `src/routes/api/chat.ts`**:
```typescript
/**
 * Server Function — POST /api/chat
 */
import { createAPIFileRoute } from "@tanstack/start/api";

const OLLAMA_INTERNAL_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

const SYSTEM_PROMPTS: Record<string, string> = {
  // ── E-MAIL (FORÇA LAYOUT DE TABELA TRADICIONAL PARA NÃO QUEBRAR) ──
  email: `Você é um especialista em e-mail marketing. Gere o HTML.
Regras invioláveis:
- Comece DIRETAMENTE com <!DOCTYPE html>.
- Sem <link> externos, sem @import. Nada de JS.
- Você DEVE usar APENAS estruturas baseadas em <table border="0" cellpadding="0" cellspacing="0" width="100%"> para layout.
- É ESTRITAMENTE PROIBIDO usar flexbox (display:flex) ou grid (display:grid). Clientes de email (Outlook) vão quebrar.
- Cor: use SOMENTE as cores explicitamente pedidas pelo usuário. Se não especificado, use #ffffff de fundo de conteúdo, #f3f4f6 no fundo geral.
- Imagem: se precisar de imagem, use EXCLUSIVAMENTE: <img src="https://image.pollinations.ai/prompt/DESCRICAO_EM_INGLES?width=600&height=300&nologo=true" style="width:100%; max-width:600px; display:block">.`,

  // ── BANNER (FORÇA COLOR BLOCKING EM VEZ DE FOTORREALISMO FULL) ──
  banner: `Você é um designer de banners publicitários focado em HTML/CSS (Dimensões esperadas do container são 1200x500).

Passo 1 — Extraia do pedido do usuário num comentário HTML inicial:
  Passo 2 — Construa o HTML:

ESTRUTURA DO BANNER (Color Blocking Design):
- Container pai: width: 1200px; height: 500px; position:relative; overflow:hidden; font-family: sans-serif; display:table;
- Divida visualmente o layout usando duas caixas absolutas (painéis coloridos). O lado esquerdo deve ter uma cor sólida que combine com a marca (COR PRIMÁRIA DO USUÁRIO).
- Painel Esquerdo (Conteúdo): Largura ~600px. Fundo com a COR PRIMÁRIA. Coloque Título Grande (font-size >40px), subtítulo contrastante e Botão CTA preenchido.
- Painel Direito (Imagem): Largura ~600px. Fundo limpo. Carregue:
  <img src="https://image.pollinations.ai/prompt/DESCRICAO_EM_INGLES_DO_PRODUTO_white_studio_background?width=600&height=500&nologo=true" style="width:100%; height:100%; object-fit:cover;">

REGRAS:
- A COR DO FUNDO do painel esquerdo DEVE ser a que o usuário pediu (Se não pedir, não use azul).
- A imagem Pollinations deve focar NO PRODUTO com "white studio background" para não misturar fundos irreais.
- Apenas HTML/CSS. ZERO marcação Markdown no output principal (NADA de \`\`\`html). Comece direto pela ESTRUTURA:
- Container: width:1080px; height:1080px; position:relative; overflow:hidden; font-family:sans-serif; background-color: COR PRIMÁRIA
- Use a imagem Pollinations (1080x1080) com opacity ou compositing para se fundir à cor base da marca.
- Tipografia gigante e bold. Tudo centrado ou alinhado drasticamente (Swiss Design).
- ZERO texto explicativo, inicie direto no HTML.`,

  datasheet: `Você é um conteudista técnico. Gere uma ficha técnica de produto em Markdown (Visão Geral, Especificações Técnicas (Tabela obrigatória), Casos de Uso, Diferenciais). Use português PT-BR direto e altamente persuasivo no B2B.`,
  text: `Você é um copywriter sênior de marketing. Escreva conteúdo persuasivo.`,
};

export const APIRoute = createAPIFileRoute("/api/chat")({
  POST: async ({ request }) => {
    let body: { prompt: string; intent: string; model?: string; reasoning?: any };

    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON inválido" }), { status: 400 });
    }

    const { prompt, intent = "text", model = DEFAULT_MODEL, reasoning } = body;
    if (!prompt) return new Response(JSON.stringify({ error: "Falta prompt" }), { status: 400 });

    const systemPrompt = SYSTEM_PROMPTS[intent] ?? SYSTEM_PROMPTS.text;
    
    // Injeta o reasoning validado pelo orquestrador no System Prompt para focar o modelo
    const enrichedSystem = reasoning 
        ? `${systemPrompt}\n\n[CONTEXTO ESTRATÉGICO FORÇADO]\n- Objetivo: ${reasoning.objective}\n- Funil: ${reasoning.funnelStage}\n- Tom: ${reasoning.tone}`
        : systemPrompt;

    let ollamaRes: Response;
    try {
      ollamaRes = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system: enrichedSystem,
          prompt: prompt.trim(),
          stream: true,
        }),
        signal: request.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: `Ollama error: ${msg}` }), { status: 502 });
    }

    const encoder = new TextEncoder();
    const ollamaReader = ollamaRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const readable = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await ollamaReader.read();

          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line) as { response?: string; done?: boolean };
              if (json.response) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(json.response)}\n\n`));
              }
              if (json.done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
            } catch {}
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`data: {"error":"${msg}"}\n\n`));
          controller.close();
        }
      },
      cancel() {
        ollamaReader.cancel();
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
});