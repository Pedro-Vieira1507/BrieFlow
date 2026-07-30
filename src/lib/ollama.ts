// src/lib/ollama.ts
import type { BrandContext, BuilderState, CampaignAsset, DiscoveryPlan } from "@/types/builder";
import { formatSiteContextForAgent, type ScrapedProductData } from "@/lib/scrape-site";
import type { AiAssetType, AiChatMessage, AiGenerationMeta, AiIntent } from "@/types/ai";

// ==========================================
// DISCOVERY AGENT (INVESTIGATIVO E RESTRITO)
// ==========================================
const DISCOVERY_AGENT_PROMPT = (
  currentPlan: DiscoveryPlan | undefined,
  brandContext: BrandContext,
) => `Você é o BrieFlow Creative Director, um diretor de criação e estrategista sênior.

=== REGRAS ABSOLUTAS ===
1. IDIOMA: TODAS as suas respostas devem ser EXCLUSIVAMENTE em Português do Brasil (PT-BR).
2. O campo "productSku" deve ser null a não ser que o usuário envie um link DIRETO para a página de UM produto.
3. RETENÇÃO LITERAL (CRÍTICO): Se o usuário fornecer textos EXATOS para as peças (como "Título:", "Legenda:", "Hashtags obrigatórias" ou "Frases exatas"), você ESTÁ PROIBIDO de resumir. Transcreva essas regras PALAVRA POR PALAVRA para dentro do campo "detectedContext".
4. Responda ESTRITAMENTE em JSON válido.

=== DADOS DA MARCA E DO SITE ===
${brandContext.site ? formatSiteContextForAgent(brandContext.site) : "Nenhum site analisado ainda."}

=== RETORNO OBRIGATÓRIO (SCHEMA JSON) ===
{
  "chat": "Sua resposta humanizada confirmando o que capturou e perguntando se pode gerar.",
  "builder": {
    "type": "discovery_plan",
    "discoveryPlan": {
      "detectedContext": "TRANSCREVA AQUI TODAS AS EXIGÊNCIAS LITERAIS DE COPY DO CLIENTE. Se não houver, faça um resumo do briefing.",
      "offer": "O CÓDIGO EXATO DO CUPOM mencionado (ex: RUN15). Use null se não houver.",
      "missingInfo": "O que realmente falta descobrir.",
      "proposedStrategy": "Estratégia baseada APENAS nos fatos narrados",
      "brandName": "Nome da marca",
      "productSku": "APENAS UM SKU AQUI OU UMA URL DIRETA (OU NULL)"
    }
  }
}`;

function getAssetContentSchema(targetAsset: AiAssetType): string {
  const designFields = `
    "themeColor": "#HEX OBRIGATÓRIO (use a cor primária escura ou vibrante)",
    "secondaryColor": "#HEX OBRIGATÓRIO (use a cor secundária exigida)"
  `;

  if (targetAsset === "banner") {
    return `"content": {
          "type": "banner",
          "title": "Título com impacto publicitário (PT-BR)",
          "subtitle": "Linha de benefício com o nome do produto (PT-BR)",
          "cta": "CTA forte contendo o cupom (PT-BR)",
          "imagePrompt": "Prompt em inglês para a foto",
          "productSku": "SKU",
          "layoutStyle": "diagonal OU split OU minimalist OU centered",
          ${designFields}
        }`;
  }
  if (targetAsset === "email") {
    return `"content": {
          "type": "email",
          "preheader": "Pré-header chamativo (PT-BR)",
          "title": "Assunto do email (PT-BR)",
          "body": "Texto altamente persuasivo citando o produto e o cupom (PT-BR)",
          "cta": "Botão de ação clara (PT-BR)",
          "emailHeroImagePrompt": "Prompt de imagem em inglês",
          ${designFields}
        }`;
  }
  return `"content": {
          "type": "social",
          "caption": "Legenda engajadora citando produto e cupom (PT-BR)",
          "hashtags": ["#hashtag1", "#hashtag2"],
          "imagePrompt": "Prompt vertical em inglês focado em redes sociais",
          ${designFields}
        }`;
}

// ==========================================
// EXECUTION AGENT (MASTER PROMPT)
// ==========================================
const EXECUTION_AGENT_PROMPT = (
  context: BrandContext,
  plan: DiscoveryPlan | undefined,
  targetAsset: AiAssetType,
  options: OllamaGenerationOptions,
) => `Você é o BrieFlow Art Director, liderando um estúdio de design premium.
Sua missão é gerar EXCLUSIVAMENTE a peça: ${targetAsset.toUpperCase()}.

=== DIRETRIZES GLOBAIS OBRIGATÓRIAS ===
1. FIDELIDADE ABSOLUTA: Leia o "Briefing Aprovado" abaixo. Encontre as instruções específicas para o ${targetAsset.toUpperCase()} e USE O TEXTO EXATAMENTE COMO SOLICITADO. Você está PROIBIDO de reescrever frases, perguntas finais ou hashtags se o briefing já as forneceu.
2. ISOLAMENTO: Ignore completamente as instruções referentes a outras peças. Nunca misture a copy.
3. TEXTO LIMPO: ZERO formatação Markdown. NUNCA use chaves, colchetes [ ], asteriscos ** ou links no JSON retornado.
4. PRODUTO E CUPOM: Use estritamente o cupom/oferta: [${plan?.offer || 'Nenhum'}].
5. CORES: "themeColor" DEVE ser a cor MAIS ESCURA da paleta informada para garantir contraste premium. NUNCA use tons claros no fundo.
6. SCHEMA COMPLETO: NUNCA remova chaves do JSON.

=== BRIEFING APROVADO ===
${plan ? JSON.stringify(plan, null, 2) : "Use o histórico da conversa."}

=== PRODUTOS COLETADOS ===
${options.scrapedProducts && options.scrapedProducts.length > 0 
  ? options.scrapedProducts.map(p => `- Produto: ${p.name}`).join("\n") 
  : "Nenhum."}

=== RETORNO OBRIGATÓRIO (JSON STRICT) ===
{
  "chat": "Peça finalizada com sucesso.",
  "builder": {
    "type": "campaign",
    "campaignAssets": [
      {
        "id": "${targetAsset}-1",
        "type": "${targetAsset}",
        "status": "draft",
        ${getAssetContentSchema(targetAsset)},
        "productImageUrl": ${options.productImageUrl ? `"${options.productImageUrl}"` : "null"}
      }
    ]
  },
  "scores": { "persuasion": 95, "clarity": 95, "seo": 90 }
}`;

export interface ChatTurn extends AiChatMessage { id?: string; }

export interface OllamaGenerationOptions {
  intent?: AiIntent; requestId?: string; targetAsset?: AiAssetType;
  productImageUrl?: string | null; onStream?: (partialChat: string) => void;
  scrapedProducts?: ScrapedProductData[];
}

export interface OllamaResultMeta extends AiGenerationMeta { provider: "ollama"; }
export interface OllamaResponse {
  chat: string; builder: BuilderState; scores?: { persuasion: number; clarity: number; seo: number; };
}
export type OllamaResult = OllamaResponse & { meta: OllamaResultMeta; };

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `bf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveOllamaApiUrl(): string {
  const envUrl = import.meta.env.VITE_OLLAMA_API_URL as string | undefined;
  if (envUrl) return `${envUrl.replace("/v1/chat/completions", "").replace("/api/chat", "").replace(/\/$/, "")}/api/chat`;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:11434/api/chat`;
  return "http://localhost:11434/api/chat";
}

function pickModel(wantsExecution: boolean): string {
  const discoveryModel = (import.meta.env.VITE_OLLAMA_DISCOVERY_MODEL as string | undefined) ?? "qwen2.5:7b";
  const executionModel = (import.meta.env.VITE_OLLAMA_EXECUTION_MODEL as string | undefined) ?? "qwen2.5:7b";
  return wantsExecution ? executionModel : discoveryModel;
}

function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0; let inString = false; let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) { escaped = false; continue; }
    if (character === "\\") { escaped = true; continue; }
    if (character === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function tryParseJson(text: string): OllamaResponse | null {
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleanText) as OllamaResponse; } catch { }
  const extracted = extractBalancedJson(cleanText);
  if (!extracted) return null;
  try { return JSON.parse(extracted) as OllamaResponse; } catch { return null; }
}

function extractChatField(rawJson: string): string | null {
  const match = rawJson.match(/"chat"\s*:\s*"/);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  let result = ""; let escaped = false;
  for (let index = start; index < rawJson.length; index += 1) {
    const character = rawJson[index];
    if (escaped) {
      const replacements: Record<string, string> = { n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" };
      result += replacements[character] ?? character;
      escaped = false; continue;
    }
    if (character === "\\") { escaped = true; continue; }
    if (character === '"') return result;
    result += character;
  }
  return result || null;
}

function validateAsset(asset: CampaignAsset, targetAsset: AiAssetType): boolean {
  const content = asset.content as any;
  if (!content || typeof content !== "object") return false;
  if (targetAsset === "banner") return Boolean(content.title);
  if (targetAsset === "email") return Boolean(content.body || content.title);
  if (targetAsset === "social") return Boolean(content.caption);
  return false;
}

function createFallbackBuilder(currentPlan: DiscoveryPlan | undefined): BuilderState {
  return currentPlan ? { type: "discovery_plan", discoveryPlan: currentPlan } : { type: "none" };
}

function normalizeBuilder(response: OllamaResponse, currentPlan: DiscoveryPlan | undefined, targetAsset?: AiAssetType, productImageUrl?: string | null): BuilderState {
  const builder = response.builder;
  if (!builder) return createFallbackBuilder(currentPlan);

  if (builder.type === "campaign" && Array.isArray(builder.campaignAssets) && targetAsset) {
    const campaignAssets = builder.campaignAssets
      .filter((asset) => 
        String(asset.type).toLowerCase().includes(targetAsset) || 
        String((asset.content as any)?.type).toLowerCase().includes(targetAsset)
      )
      .filter((asset) => validateAsset(asset, targetAsset))
      .map((asset) => ({
        ...asset, type: targetAsset, status: asset.status ?? "draft",
        content: {
          ...asset.content, type: targetAsset,
          productImageUrl: productImageUrl ?? (asset.content as any).productImageUrl ?? null,
        },
      }));
    return { type: "campaign", campaignAssets };
  }
  return builder;
}

export async function sendToOllama(history: ChatTurn[], brandContext: BrandContext, currentPlan?: DiscoveryPlan, options: OllamaGenerationOptions = {}): Promise<OllamaResult> {
  const wantsExecution = Boolean(options.targetAsset);
  const targetAsset = options.targetAsset;
  const model = pickModel(wantsExecution);
  const startedAt = Date.now();

  const metaBase: OllamaResultMeta = {
    requestId: options.requestId ?? createRequestId(), model,
    intent: options.intent ?? (wantsExecution ? "campaign" : "discovery"),
    stage: wantsExecution ? "generating" : "discovery",
    usedFallback: false, generatedAt: new Date().toISOString(), provider: "ollama",
  };

  const systemPrompt = wantsExecution && targetAsset
    ? EXECUTION_AGENT_PROMPT(brandContext, currentPlan, targetAsset, options)
    : DISCOVERY_AGENT_PROMPT(currentPlan, brandContext);

  // Mantemos o Agente Executor TOTALMENTE ISOLADO, sem o peso e a distração do histórico longo.
  // Ele dependerá 100% da transcrição literal gravada no "Briefing Aprovado" (plan).
  const messagesPayload = wantsExecution && targetAsset
    ? [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Crie APENAS o JSON da peça ${targetAsset.toUpperCase()}. Siga as instruções literais do Briefing Aprovado à risca. Não use markdown.` 
        }
      ] as { role: "system" | "user", content: string }[]
    : [
        { role: "system", content: systemPrompt }, 
        ...history.slice(-6)
      ] as { role: "system" | "user", content: string }[];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), wantsExecution ? 240_000 : 180_000);

  try {
    const response = await fetch(resolveOllamaApiUrl(), {
      method: "POST", 
      headers: {
         "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: messagesPayload,
        stream: true, format: "json", keep_alive: "30m",
        options: { temperature: wantsExecution ? 0.2 : 0.4, top_p: 0.85, num_predict: wantsExecution ? 900 : 600, num_ctx: 4096 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    if (!response.body) throw new Error("Streaming não suportado.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let rawJson = ""; let pendingChunk = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      pendingChunk += decoder.decode(value, { stream: true });
      const lines = pendingChunk.split("\n");
      pendingChunk = lines.pop() ?? "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        try {
          const chunk = JSON.parse(trimmedLine) as { message?: { content?: string } };
          const content = chunk.message?.content;
          if (!content) continue;
          rawJson += content;
          if (!wantsExecution) {
            const partialChat = extractChatField(rawJson);
            if (partialChat) options.onStream?.(partialChat);
          }
        } catch { }
      }
    }
    pendingChunk += decoder.decode();
    if (pendingChunk.trim()) {
      try {
        const finalChunk = JSON.parse(pendingChunk.trim()) as { message?: { content?: string } };
        if (finalChunk.message?.content) rawJson += finalChunk.message.content;
      } catch { }
    }

    const parsed = tryParseJson(rawJson);

    if (!parsed) {
      return {
        chat: wantsExecution ? "Erro de formatação na peça." : "Falha na resposta da IA.",
        builder: createFallbackBuilder(currentPlan),
        meta: { ...metaBase, stage: "needs_revision", usedFallback: true, latencyMs: Date.now() - startedAt },
      };
    }

    const builder = normalizeBuilder(parsed, currentPlan, targetAsset, options.productImageUrl);

    return {
      chat: parsed.chat || (wantsExecution ? "Peça gerada." : "Briefing atualizado."),
      builder, scores: parsed.scores,
      meta: { ...metaBase, stage: wantsExecution ? "completed" : "ready_to_generate", latencyMs: Date.now() - startedAt },
    };
  } catch (error: unknown) {
    if ((error as { name?: string }).name === "AbortError") throw new Error("Tempo excedido.");
    throw new Error(`Falha: ${String(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}