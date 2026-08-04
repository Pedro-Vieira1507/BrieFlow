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
3. RETENÇÃO LITERAL: Se o usuário fornecer textos EXATOS para as peças (como "Título:", "Legenda:", "Hashtags"), você ESTÁ PROIBIDO de resumir. Transcreva essas regras PALAVRA POR PALAVRA para o "detectedContext".
4. Responda ESTRITAMENTE em JSON válido.

=== DADOS DA MARCA E DO SITE ===
${brandContext.site ? formatSiteContextForAgent(brandContext.site) : "Nenhum site analisado ainda."}

=== RETORNO OBRIGATÓRIO (SCHEMA JSON) ===
{
  "chat": "Sua resposta humanizada confirmando o que capturou e perguntando se pode gerar.",
  "builder": {
    "type": "discovery_plan",
    "discoveryPlan": {
      "detectedContext": "TRANSCREVA AQUI TODAS AS EXIGÊNCIAS LITERAIS DE COPY DO CLIENTE. Se não houver, faça um resumo.",
      "offer": "O CÓDIGO EXATO DO CUPOM (ex: RUN15).",
      "missingInfo": "O que realmente falta descobrir.",
      "proposedStrategy": "Estratégia baseada APENAS nos fatos",
      "brandName": "Nome da marca",
      "productSku": "APENAS UM SKU AQUI OU UMA URL DIRETA (OU NULL)"
    }
  }
}`;

function getAssetContentSchema(targetAsset: AiAssetType): string {
  const designFields = `
    "themeColor": "#HEX OBRIGATÓRIO (Use a cor primária MAIS VIBRANTE ou escura da marca, nunca tons pastéis ou branco)",
    "secondaryColor": "#HEX OBRIGATÓRIO (Use a cor secundária de contraste)"
  `;
  const imgPromptGuidance = "Prompt descritivo em inglês para a foto. DEVE ser focado no nicho real do produto/tema (ex: programação, esportes, etc) e nunca literal/ambíguo. Se for programação, mostre pessoas digitando, código, escritório.";

  if (targetAsset === "banner") {
    return `"content": {
          "type": "banner",
          "title": "Título com impacto publicitário",
          "subtitle": "Subtítulo da peça",
          "cta": "CTA forte contendo a ação",
          "imagePrompt": "${imgPromptGuidance}",
          "productSku": "SKU",
          "layoutStyle": "diagonal OU split OU minimalist OU centered",
          ${designFields}
        }`;
  }
  if (targetAsset === "email") {
    return `"content": {
          "type": "email",
          "preheader": "Pré-header chamativo",
          "title": "Assunto do email",
          "body": "Texto persuasivo com os benefícios reais passados no briefing",
          "cta": "Botão de ação clara",
          "emailHeroImagePrompt": "${imgPromptGuidance}",
          ${designFields}
        }`;
  }
  return `"content": {
          "type": "social",
          "caption": "Legenda com a narrativa, pergunta final e hashtags",
          "hashtags": ["#hashtag1", "#hashtag2"],
          "imagePrompt": "${imgPromptGuidance}",
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
) => {
  // LÓGICA ANTI-PLACEHOLDER [NENHUM]
  const offer = plan?.offer && plan.offer !== 'null' && plan.offer.trim() !== '' && plan.offer.toLowerCase() !== 'nenhum' 
    ? plan.offer 
    : null;
    
  const offerGuidance = offer 
    ? `3. OFERTA/CUPOM: A campanha possui a seguinte oferta: [${offer}]. É OBRIGATÓRIO aplicar isso na copy.`
    : `3. OFERTA/CUPOM: NÃO HÁ oferta ou cupom nesta campanha. É ESTRITAMENTE PROIBIDO citar descontos, cupons ou a palavra [NENHUM]. O CTA deve ser apenas a ação (ex: "Inscreva-se", "Comprar Agora").`;

  return `Você é o BrieFlow Art Director, gerando a peça: ${targetAsset.toUpperCase()}.

=== DIRETRIZES ===
1. FIDELIDADE ABSOLUTA: Use OS TEXTOS LITERAIS que o cliente pediu. Não invente ou resuma se o cliente enviou a frase exata.
2. TEXTO LIMPO: ZERO formatação Markdown. NÃO use colchetes [ ], asteriscos ** ou tags HTML no JSON.
${offerGuidance}
4. ZERO ALUCINAÇÃO (CRÍTICO): NUNCA invente preços, datas, locais, distâncias ou dados operacionais/factuais que não constem no briefing. Atenha-se às informações fornecidas. Se faltar dados, use argumentos motivacionais genéricos.
5. SCHEMA COMPLETO: Preencha todas as chaves exigidas no JSON.

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
};

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

function extractSpecificBriefing(text: string, targetAsset: string): string {
  const normalized = text.toUpperCase();
  const hasMarkers = /BANNER:|E-MAIL:|EMAIL:|POST SOCIAL:|SOCIAL:/i.test(text);
  if (!hasMarkers) return text; 

  let keyword = "";
  if (targetAsset === "banner") keyword = "BANNER:";
  else if (targetAsset === "email") keyword = normalized.includes("E-MAIL:") ? "E-MAIL:" : "EMAIL:";
  else if (targetAsset === "social") keyword = normalized.includes("POST SOCIAL:") ? "POST SOCIAL:" : "SOCIAL:";

  if (!keyword || !normalized.includes(keyword)) return text;

  const startIndex = normalized.indexOf(keyword) + keyword.length;
  
  const otherKeywords = ["BANNER:", "E-MAIL:", "EMAIL:", "POST SOCIAL:", "SOCIAL:"].filter(k => k !== keyword);
  let endIndex = text.length;
  
  for (const kw of otherKeywords) {
    const idx = normalized.indexOf(kw, startIndex);
    if (idx !== -1 && idx < endIndex) {
      endIndex = idx;
    }
  }
  return text.substring(startIndex, endIndex).trim();
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

  const recentUserBriefing = history
    .filter(m => m.role === "user")
    .slice(-3)
    .map(m => m.content)
    .join("\n\n---\n\n");

  const isolatedBriefing = wantsExecution && targetAsset ? extractSpecificBriefing(recentUserBriefing, targetAsset) : recentUserBriefing;

  const messagesPayload = wantsExecution && targetAsset
    ? [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `=== REGRAS OBRIGATÓRIAS DESTA PEÇA ===\n${isolatedBriefing}\n\n=== TAREFA ===\nGere AGORA o JSON para a peça ${targetAsset.toUpperCase()}. Siga as frases acima à risca.` 
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
      headers: { "Content-Type": "application/json" },
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