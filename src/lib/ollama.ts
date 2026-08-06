// src/lib/ollama.ts
import type { BrandContext, BuilderState, CampaignAsset, DiscoveryPlan } from "@/types/builder";
import { formatSiteContextForAgent, type ScrapedProductData } from "@/lib/scrape-site";
import type { AiAssetType, AiChatMessage, AiGenerationMeta, AiIntent } from "@/types/ai";
import { toast } from "sonner";
import { cleanOffer } from "@/lib/sanitize";

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
      "offer": "Qualquer desconto, promoção, porcentagem (ex: 20% OFF) ou código de cupom mencionado. Use null apenas se não houver NENHUMA menção a ofertas.",
      "missingInfo": "O que realmente falta descobrir.",
      "proposedStrategy": "Estratégia baseada APENAS nos fatos",
      "brandName": "Nome da marca",
      "productSku": "APENAS UM SKU AQUI OU UMA URL DIRETA (OU NULL)"
    }
  }
}`;

function getAssetContentSchema(targetAsset: AiAssetType): string {
  const designFields = `
    "themeColor": "#HEX OBRIGATORIO (Use a cor primária MAIS VIBRANTE ou escura da marca, nunca tons pastéis ou branco)",
    "secondaryColor": "#HEX OBRIGATORIO (Use a cor secundária de contraste)"
  `;
  const imgPromptGuidance = "MANDATORY: Write a highly detailed photography prompt in ENGLISH. The image MUST explicitly feature the campaign's main subject/product (e.g., if it's about coffee, describe coffee beans, cups, or a cafe). NO text, NO logos. Describe lighting, scenario, and subject perfectly.";

  if (targetAsset === "banner") {
    return `"content": {
          "type": "banner",
          "title": "<Gere um título com impacto publicitário>",
          "subtitle": "<Gere o subtítulo da peça>",
          "cta": "<Gere um CTA forte e curto>",
          "imagePrompt": "${imgPromptGuidance}",
          "productSku": "SKU",
          "layoutStyle": "diagonal OU split OU minimalist OU centered",
          ${designFields}
        }`;
  }

  if (targetAsset === "email") {
    return `"content": {
          "type": "email",
          "preheader": "<Gere um pré-header chamativo>",
          "title": "<Gere o assunto do email>",
          "body": "<Gere de 2 a 3 parágrafos persuasivos aplicando os benefícios reais do produto, a oferta e o contexto do briefing>",
          "cta": "<Gere um botão de ação claro e direto>",
          "emailHeroImagePrompt": "${imgPromptGuidance}",
          ${designFields}
        }`;
  }

  return `"content": {
          "type": "social",
          "caption": "<Gere uma legenda com a narrativa, pergunta final e hashtags adequadas ao briefing>",
          "hashtags": ["#hashtag1", "#hashtag2"],
          "imagePrompt": "${imgPromptGuidance}",
          ${designFields}
        }`;
}

const EXECUTION_AGENT_PROMPT = (
  context: BrandContext,
  plan: DiscoveryPlan | undefined,
  targetAsset: AiAssetType,
  options: OllamaGenerationOptions,
) => {
  const offer = cleanOffer(plan?.offer);
   
  const offerGuidance = offer
     ? `3. OFERTA/CUPOM: A campanha possui a seguinte oferta: [${offer}]. É OBRIGATÓRIO aplicar isso na copy.`
    : `3. PROIBIÇÃO DE OFERTAS (CRÍTICO): O usuário NÃO TEM cupom nem desconto. É ESTRITAMENTE PROIBIDO inventar promoções, usar o símbolo "%" ou a palavra "desconto" no seu texto.`;

  const exactBrand = plan?.brandName || context.brandName || "Sua Marca";
  const safeImgUrl = options.productImageUrl ? options.productImageUrl.replace(/"/g, '') : null;

  return `Você é o BrieFlow Art Director, gerando a peça: ${targetAsset.toUpperCase()}.

=== DIRETRIZES ===
1. FIDELIDADE ABSOLUTA: Use OS TEXTOS LITERAIS que o cliente pediu. Não invente ou resuma se o cliente enviou a frase exata.
2. TEXTO LIMPO E JSON VÁLIDO: ZERO formatação Markdown. NUNCA use quebras de linha reais (Enter) nos textos. Se precisar pular linha, digite EXATAMENTE os caracteres "\\n".
${offerGuidance}
4. NOME DA MARCA (CRÍTICO): O nome oficial da empresa é [${exactBrand}]. É ESTRITAMENTE PROIBIDO modificar, corrigir, traduzir ou alterar qualquer letra deste nome. Use-o exatamente como está.
5. ZERO ALUCINAÇÃO: NUNCA invente preços, datas, locais, distâncias ou dados operacionais que não constem no briefing.
6. SCHEMA COMPLETO: Preencha todas as chaves exigidas no JSON. Se faltarem dados ou imagens no briefing, preencha com null e CONTINUE normalmente. NUNCA se desculpe ou recuse a tarefa.
7. REGRAS ABSOLUTAS: VOCÊ ESTÁ ESTRITAMENTE PROIBIDO DE COPIAR OS TEXTOS DE INSTRUÇÃO DO SCHEMA (ex: "<Gere um assunto...>"). GERE CONTEÚDO REAL, PERSUASIVO E CRIATIVO PARA CADA CAMPO.

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
        "productImageUrl": ${safeImgUrl ? `"${safeImgUrl}"` : "null"}
      }
    ]
  },
  "scores": { "persuasion": 95, "clarity": 95, "seo": 90 }
}`;
};

export interface ChatTurn extends AiChatMessage { id?: string; }

export interface OllamaGenerationOptions {
  intent?: AiIntent;
  requestId?: string;
  targetAsset?: AiAssetType;
  productImageUrl?: string | null;
  onStream?: (partialChat: string) => void;
  scrapedProducts?: ScrapedProductData[];
}

export interface OllamaResultMeta extends AiGenerationMeta {
  provider: "ollama" | "omniroute";
}

export interface OllamaResponse {
  chat: string;
  builder: BuilderState;
  scores?: { persuasion: number; clarity: number; seo: number; };
}

export type OllamaResult = OllamaResponse & { meta: OllamaResultMeta; };

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `bf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
  // Recuperação best-effort para JSON truncado: fecha objetos abertos.
  if (depth > 0) return text.slice(start) + "}".repeat(depth);
  return null;
}

function tryParseJson(text: string): OllamaResponse | null {
  if (!text || !text.trim()) return null;
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json/gi, "").replace(/```/g, "").trim();

  // 1) Tenta o mais direto (preserva quebras dentro de strings)
  try { return JSON.parse(cleanText) as OllamaResponse; } catch { /* segue */ }

  // 2) Achata whitespace e remove trailing commas
  const flat = cleanText.replace(/[\n\r\t]/g, " ").replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(flat) as OllamaResponse; } catch { /* segue */ }

  // 3) Extrai o primeiro objeto balanceado (ou tenta recuperar truncado)
  const extracted = extractBalancedJson(flat);
  if (extracted) {
    try { return JSON.parse(extracted) as OllamaResponse; } catch { /* segue */ }
    const softened = extracted.replace(/,\s*([}\]])/g, "$1");
    try { return JSON.parse(softened) as OllamaResponse; } catch { /* fim */ }
  }
  return null;
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
          brandName: currentPlan?.brandName || (asset.content as any).brandName || null,
          productImageUrl: productImageUrl ?? (asset.content as any).productImageUrl ?? null,
        },
      }));
    return { type: "campaign", campaignAssets };
  }
  return builder;
}

async function callOmniRouteAPI(
  messagesPayload: { role: "system" | "user", content: string }[],
  options: OllamaGenerationOptions,
  controller: AbortController
): Promise<string> {
  const apiKey = import.meta.env.VITE_OMNIROUTE_API_KEY as string | undefined;
  const apiUrl = (import.meta.env.VITE_OMNIROUTE_API_URL as string | undefined) ?? "http://localhost:20128/v1/chat/completions";
  const model = (import.meta.env.VITE_OMNIROUTE_MODEL as string | undefined) ?? "gpt-4o-mini";

  if (!apiKey) throw new Error("API Key não configurada para Omniroute.");

  const isExecution = Boolean(options.targetAsset);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messagesPayload,
      stream: !isExecution,
      temperature: isExecution ? 0.1 : 0.3,
      max_tokens: isExecution ? 4000 : 1500,
      response_format: { type: "json_object" } 
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Sem detalhes");
    throw new Error(`OmniRoute API HTTP ${response.status}: ${errText}`);
  }

  if (isExecution) {
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (!response.body) throw new Error("Streaming não suportado pelo OmniRoute.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let rawJson = ""; 
  let pendingChunk = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pendingChunk += decoder.decode(value, { stream: true });
    const lines = pendingChunk.split("\n");
    pendingChunk = lines.pop() ?? "";
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
      
      if (trimmedLine.startsWith("data: ")) {
        try {
          const chunk = JSON.parse(trimmedLine.slice(6));
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            rawJson += content;
            if (!options.targetAsset) {
              const partialChat = extractChatField(rawJson);
              if (partialChat) options.onStream?.(partialChat);
            }
          }
        } catch { /* stream chunk parse error, ignore */ }
      }
    }
  }
  return rawJson;
}

async function callLocalOllama(
  messagesPayload: { role: "system" | "user", content: string }[],
  options: OllamaGenerationOptions,
  controller: AbortController
): Promise<string> {
  const isExecution = Boolean(options.targetAsset);
  const discoveryModel = (import.meta.env.VITE_OLLAMA_DISCOVERY_MODEL as string | undefined) ?? "qwen2.5:7b";
  const executionModel = (import.meta.env.VITE_OLLAMA_EXECUTION_MODEL as string | undefined) ?? "qwen2.5:7b";
  const model = isExecution ? executionModel : discoveryModel;

  const url = (import.meta.env.VITE_OLLAMA_API_URL as string | undefined) 
    ? `${(import.meta.env.VITE_OLLAMA_API_URL as string).replace("/v1/chat/completions", "").replace("/api/chat", "").replace(/\/$/, "")}/api/chat`
    : typeof window !== "undefined" ? `http://${window.location.hostname}:11434/api/chat` : "http://localhost:11434/api/chat";

  const response = await fetch(url, {
    method: "POST", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: messagesPayload,
      stream: !isExecution,
      format: "json", keep_alive: "30m",
      options: { temperature: isExecution ? 0.1 : 0.3, top_p: 0.85, num_predict: isExecution ? 4000 : 1500, num_ctx: 4096 },
    }),
    signal: controller.signal,
  });

  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);

  if (isExecution) {
    const data = await response.json();
    return data.message?.content || "";
  }

  if (!response.body) throw new Error("Streaming não suportado pelo Ollama.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let rawJson = ""; 
  let pendingChunk = "";

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
        if (content) {
          rawJson += content;
          if (!options.targetAsset) {
            const partialChat = extractChatField(rawJson);
            if (partialChat) options.onStream?.(partialChat);
          }
        }
      } catch { /* ignore malformed chunk */ }
    }
  }

  pendingChunk += decoder.decode();
  if (pendingChunk.trim()) {
    try {
      const finalChunk = JSON.parse(pendingChunk.trim()) as { message?: { content?: string } };
      if (finalChunk.message?.content) rawJson += finalChunk.message.content;
    } catch { /* ignore trailing chunk */ }
  }

  return rawJson;
}

export async function sendToOllama(history: ChatTurn[], brandContext: BrandContext, currentPlan?: DiscoveryPlan, options: OllamaGenerationOptions = {}): Promise<OllamaResult> {
  const wantsExecution = Boolean(options.targetAsset);
  const targetAsset = options.targetAsset;
  const startedAt = Date.now();

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

  let rawJson = "";
  let providerUsed: "omniroute" | "ollama" = "omniroute";
  let usedFallback = false;
  const hasOmnirouteKey = Boolean(import.meta.env.VITE_OMNIROUTE_API_KEY);

  try {
    if (hasOmnirouteKey) {
      try {
        rawJson = await callOmniRouteAPI(messagesPayload, options, controller);
      } catch (cloudError: any) {
        if (cloudError.name === "AbortError") throw cloudError;
        
        console.warn(`[Omniroute Falhou] Acionando fallback para Ollama Local: ${cloudError.message}`);
        if (typeof window !== "undefined") {
          toast.warning("Conexão rápida falhou. Acionando IA Local (pode levar 1 a 2 minutos)...", { 
            id: "omniroute-fallback-toast", 
            duration: 6000 
          });
        }
        usedFallback = true;
        providerUsed = "ollama";
        rawJson = await callLocalOllama(messagesPayload, options, controller);
      }
    } else {
      providerUsed = "ollama";
      rawJson = await callLocalOllama(messagesPayload, options, controller);
    }

    const parsed = tryParseJson(rawJson);
    
    const metaBase: OllamaResultMeta = {
      requestId: options.requestId ?? createRequestId(), 
      model: providerUsed === "omniroute" ? (import.meta.env.VITE_OMNIROUTE_MODEL as string ?? "omniroute-model") : "local-ollama",
      intent: options.intent ?? (wantsExecution ? "campaign" : "discovery"),
      stage: wantsExecution ? "generating" : "discovery",
      usedFallback, generatedAt: new Date().toISOString(), provider: providerUsed,
    };

    if (!parsed && wantsExecution) {
      throw new Error(
        "A IA não conseguiu concluir a resposta a tempo. Peça para gerar novamente esta peça.",
      );
    }

    if (!parsed) {
        return {
          chat: "Entendi perfeitamente o briefing! Posso prosseguir com a geração das peças de marketing?",
          builder: {
            type: "discovery_plan",
            discoveryPlan: {
              detectedContext: recentUserBriefing.substring(0, 200),
              missingInfo: "Nenhuma.",
              proposedStrategy: "Criar materiais promocionais de alta conversão.",
              brandName: brandContext.brandName || "Marca"
            }
          },
          meta: { ...metaBase, stage: "ready_to_generate", latencyMs: Date.now() - startedAt },
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
    throw new Error(`Falha no pipeline de IA: ${String(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}