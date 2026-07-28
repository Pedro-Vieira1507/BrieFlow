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
) => `Você é o BrieFlow Creative Director, um diretor de criação investigativo e sênior.

=== REGRAS ABSOLUTAS DE CONVERSA ===
1. IDIOMA: TODAS as suas respostas devem ser EXCLUSIVAMENTE em Português do Brasil (PT-BR).
2. Use tom profissional, direto e consultivo.
3. NUNCA INVENTE INFORMAÇÕES: Nunca deduza campanhas, nem invente descontos se o usuário não tiver falado explicitamente.
4. Se o usuário colar apenas um link (URL) ou o nome de um produto sem explicar o contexto, AGRADEÇA a informação e PERGUNTE qual é o objetivo da campanha (ex: conversão, brand awareness, qual a oferta?).
5. O campo "productSku" deve ser null a não ser que o usuário envie um código SKU real ou um link DIRETO para a página de UM produto específico.
6. O contexto no campo "detectedContext" deve ser ACUMULATIVO, guardando tudo o que foi conversado.
7. Responda ESTRITAMENTE em JSON válido.

=== DADOS DA MARCA E DO SITE ===
${brandContext.site ? formatSiteContextForAgent(brandContext.site) : "Nenhum site analisado ainda."}

=== RETORNO OBRIGATÓRIO (SCHEMA JSON) ===
{
  "chat": "Validação breve + pergunta investigativa (em PT-BR).",
  "builder": {
    "type": "discovery_plan",
    "discoveryPlan": {
      "detectedContext": "Resumo estruturado do que O USUÁRIO falou até agora.",
      "missingInfo": "O que falta descobrir (ex: Objetivo da campanha, público)",
      "proposedStrategy": "Estratégia baseada APENAS nos fatos",
      "brandName": "Nome da marca",
      "productSku": "APENAS UM SKU AQUI OU UMA URL DIRETA (OU NULL)"
    }
  }
}`;

function getAssetContentSchema(targetAsset: AiAssetType): string {
  const designFields = `
    "themeColor": "#HEX da cor primária escolhida por você",
    "secondaryColor": "#HEX da cor secundária escolhida por você"
  `;

  if (targetAsset === "banner") {
    return `"content": {
          "type": "banner",
          "title": "Título com impacto publicitário (PT-BR)",
          "subtitle": "Linha de benefício (PT-BR)",
          "cta": "CTA forte (PT-BR)",
          "imagePrompt": "Prompt completo em inglês para a foto",
          "productSku": "SKU",
          "layoutStyle": "diagonal OU split OU minimalist OU centered",
          ${designFields}
        }`;
  }
  if (targetAsset === "email") {
    return `"content": {
          "type": "email",
          "preheader": "Pré-header (PT-BR)",
          "title": "Assunto ou headline (PT-BR)",
          "body": "Texto persuasivo com quebras (PT-BR)",
          "cta": "Botão (PT-BR)",
          "emailHeroImagePrompt": "Prompt de imagem inglês",
          ${designFields}
        }`;
  }
  return `"content": {
          "type": "social",
          "caption": "Legenda criativa (PT-BR)",
          "hashtags": ["#hashtag1", "#hashtag2"],
          "imagePrompt": "Prompt vertical inglês",
          ${designFields}
        }`;
}

// ==========================================
// EXECUTION AGENT
// ==========================================
const EXECUTION_AGENT_PROMPT = (
  context: BrandContext,
  plan: DiscoveryPlan | undefined,
  targetAsset: AiAssetType,
  options: OllamaGenerationOptions,
) => `Você é o BrieFlow Art Director, liderando um estúdio de design premium.
Gere APENAS a peça solicitada, com copy persuasiva, ELEGANTE e direção de arte sofisticada.

=== REGRAS ABSOLUTAS ===
1. IDIOMA: TODOS os textos gerados para a peça (title, subtitle, body, cta, caption) DEVEM ser obrigatoriamente em Português do Brasil (PT-BR). APENAS os "imagePrompts" devem ser em inglês.
2. NUNCA invente informações de descontos ou datas que não estejam no briefing aprovado.

=== BRIEFING APROVADO ===
${plan ? JSON.stringify(plan, null, 2) : "Use o histórico da conversa."}

=== PRODUTOS COLETADOS ===
${options.scrapedProducts && options.scrapedProducts.length > 0 
  ? options.scrapedProducts.map(p => `- Produto: ${p.name} | Preço: ${p.price || "N/A"}`).join("\n") 
  : "Nenhum produto específico."}

=== RETORNO OBRIGATÓRIO (JSON STRICT) ===
{
  "chat": "Arte finalizada com qualidade premium.",
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
  const content = asset.content;
  if (!content || typeof content !== "object") return false;
  if (targetAsset === "banner") return Boolean(content.title && content.cta);
  if (targetAsset === "email") return Boolean(content.title && content.body);
  return Boolean(content.caption && content.imagePrompt);
}

function createFallbackBuilder(currentPlan: DiscoveryPlan | undefined): BuilderState {
  return currentPlan ? { type: "discovery_plan", discoveryPlan: currentPlan } : { type: "none" };
}

function normalizeBuilder(response: OllamaResponse, currentPlan: DiscoveryPlan | undefined, targetAsset?: AiAssetType, productImageUrl?: string | null): BuilderState {
  const builder = response.builder;
  if (!builder) return createFallbackBuilder(currentPlan);
  if (builder.type === "campaign" && Array.isArray(builder.campaignAssets) && targetAsset) {
    const campaignAssets = builder.campaignAssets
      .filter((asset) => asset.type === targetAsset)
      .filter((asset) => validateAsset(asset, targetAsset))
      .map((asset) => ({
        ...asset, type: targetAsset, status: asset.status ?? "draft",
        content: {
          ...asset.content, type: targetAsset,
          productImageUrl: productImageUrl ?? asset.content.productImageUrl ?? null,
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), wantsExecution ? 240_000 : 180_000);

  try {
    const response = await fetch(resolveOllamaApiUrl(), {
      method: "POST", 
      headers: { 
        "Content-Type": "application/json", 
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...history.slice(wantsExecution ? -3 : -6)],
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