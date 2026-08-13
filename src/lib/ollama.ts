// src/lib/ollama.ts
// Chamadas de IA com Bypass (Direct API) + Supabase RPC para Créditos.
// Roteia entre Ollama Local (Gratuito) e Omniroute Nuvem (PRO/Agência).

import type { BrandContext, BuilderState, CampaignAsset, DiscoveryPlan } from "@/types/builder";
import { formatSiteContextForAgent } from "@/lib/scrape-site";
import type { AiAssetType, AiGenerationMeta, AiIntent } from "@/types/ai";
import { supabase } from "@/lib/supabase";

// ============================================================
// PROMPTS
// ============================================================
const DISCOVERY_AGENT_PROMPT = (
  currentPlan: DiscoveryPlan | undefined,
  brandContext: BrandContext,
) => `Você é o BrieFlow Creative Director, um diretor de criação e estrategista sênior.

=== REGRAS ABSOLUTAS ===
1. IDIOMA: TODAS as suas respostas devem ser EXCLUSIVAMENTE em Português do Brasil (PT-BR).
2. O campo "productSku" deve ser null a não ser que o usuário envie um link DIRETO para a página de UM produto.
3. RETENÇÃO LITERAL: Se o usuário fornecer textos EXATOS para as peças (como "Título:", "Legenda:", "Hashtags"), você ESTÁ PROIBIDO de resumir. Transcreva essas regras PALAVRA POR PALAVRA para o "detectedContext".
4. AÇÃO DE ROTEAMENTO (CRÍTICO): Você DEVE decidir o próximo passo da máquina de estados preenchendo o campo "action":
   - "discovery_continue": O usuário está apenas conversando, respondendo perguntas, adicionando contexto ou recusando algo sem pedir para gerar/cancelar tudo.
   - "generate_all": O usuário aprovou a geração, pediu para "criar as artes", "gerar campanha" ou recomeçar todas as peças.
   - "generate_banner": O usuário pediu especificamente para gerar, editar ou alterar APENAS o banner.
   - "generate_email": O usuário pediu especificamente para gerar, editar ou alterar APENAS o e-mail.
   - "generate_social": O usuário pediu especificamente para gerar, editar ou alterar APENAS o post social.
   - "cancel": O usuário expressou claro desejo de cancelar a operação inteira ou parar o fluxo.
5. WHITELIST DE EDIÇÃO (NOVO E CRÍTICO): Se a ação for "generate_*" e o usuário pediu para alterar APENAS campos específicos (ex: "Mude só o botão", "Mude só a cor", "Altere o título"), você DEVE preencher "targetKeys" com APENAS as chaves dos campos solicitados. NÃO regenere campos que o usuário não pediu para mudar.

=== CONTEXTO DA MARCA ===
${formatSiteContextForAgent(brandContext.site)}

=== PLANO ATUAL ===
${currentPlan ? JSON.stringify(currentPlan) : "Nenhum plano ainda."}

=== FORMATO DE RESPOSTA ===
Responda SEMPRE em JSON válido com esta estrutura:
{
  "chat": "Sua mensagem conversacional em PT-BR (sempre preenchido)",
  "action": "discovery_continue|generate_all|generate_banner|generate_email|generate_social|cancel",
  "targetKeys": ["array de chaves se aplicável"],
  "detectedContext": {
    "brandName": "string|null",
    "productSku": "string|null",
    "productUrl": "string|null",
    "productName": "string|null",
    "offer": "string|null",
    "audience": "string|null",
    "tone": "string|null",
    "objective": "string|null"
  },
  "builder": { /* BuilderState apropriado */ },
  "scores": { "persuasion": 0-100, "clarity": 0-100, "seo": 0-100 }
}`;

function EXECUTION_AGENT_PROMPT(
  brandContext: BrandContext,
  currentPlan: DiscoveryPlan | undefined,
  targetAsset: AiAssetType,
  options: { productImageUrl?: string | null },
): string {
  return `Você é o BrieFlow Creative Director, modo EXECUÇÃO.
Gere AGORA o JSON para a peça ${targetAsset.toUpperCase()}.

=== CONTEXTO DA MARCA ===
${formatSiteContextForAgent(brandContext.site)}

=== PLANO ===
${currentPlan ? JSON.stringify(currentPlan) : "Sem plano."}

=== IMAGEM DO PRODUTO ===
${options.productImageUrl ?? "Não fornecida."}

=== FORMATO ===
Responda em JSON válido:
{
  "chat": "Confirmação breve da peça gerada",
  "action": "generate_${targetAsset}",
  "builder": {
    "type": "campaign",
    "campaignAssets": [{
      "type": "${targetAsset}",
      "status": "draft",
      "content": { /* conteúdo da peça */ }
    }]
  },
  "scores": { "persuasion": 0-100, "clarity": 0-100, "seo": 0-100 }
}`;
}

// ============================================================
// TIPOS
// ============================================================
export type ChatTurn = { role: "user" | "assistant"; content: string };

export interface OllamaGenerationOptions {
  targetAsset?: AiAssetType;
  intent?: AiIntent;
  requestId?: string;
  productImageUrl?: string | null;
  onStream?: (partialChat: string) => void;
  provider?: "ollama" | "omniroute";
}

export interface OllamaResultMeta extends AiGenerationMeta {
  provider: "ollama" | "omniroute";
}

export interface OllamaResponse {
  chat: string;
  action?: "discovery_continue" | "generate_all" | "generate_banner" | "generate_email" | "generate_social" | "cancel";
  targetKeys?: string[];
  builder: BuilderState;
  scores?: { persuasion: number; clarity: number; seo: number };
}

export type OllamaResult = OllamaResponse & { meta: OllamaResultMeta };

// ============================================================
// HELPERS
// ============================================================
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
  const otherKeywords = ["BANNER:", "E-MAIL:", "EMAIL:", "POST SOCIAL:", "SOCIAL:"].filter((k) => k !== keyword);

  let endIndex = text.length;
  for (const kw of otherKeywords) {
    const idx = normalized.indexOf(kw, startIndex);
    if (idx !== -1 && idx < endIndex) endIndex = idx;
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
  if (depth > 0) return text.slice(start) + "}".repeat(depth);
  return null;
}

function tryParseJson(text: string): OllamaResponse | null {
  if (!text || !text.trim()) return null;

  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json/gi, "").replace(/```/g, "").trim();

  try { return JSON.parse(cleanText) as OllamaResponse; } catch { /* segue */ }

  const flat = cleanText.replace(/[\n\r\t]/g, " ").replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(flat) as OllamaResponse; } catch { /* segue */ }

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

// ============================================================
// CHAMADA DIRETA – Roteia entre Ollama e Omniroute
// ============================================================
async function callDirectAi(
  messagesPayload: { role: "system" | "user"; content: string }[],
  options: OllamaGenerationOptions,
  controller: AbortController,
): Promise<{ raw: string; provider: "omniroute" | "ollama" }> {
  const isExecution = Boolean(options.targetAsset);
  const wantsStream = false;
  const provider = options.provider || "omniroute";

  // 1. DEDUZ CRÉDITO NO SUPABASE (Para qualquer provedor)
  if (supabase) {
    const { data: session } = await supabase.auth.getSession();
    if (session?.session) {
      const { data: success, error } = await supabase.rpc("deduct_user_credit", { cost: 1 });
      if (error || !success) throw new Error("Créditos diários esgotados. Acesse as Configurações da Conta e faça o upgrade do seu plano.");
    }
  }

  // 2. ROTEAMENTO OLLAMA LOCAL
  if (provider === "ollama") {
    const ollamaUrl = import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434/api/chat";
    
    // DETECÇÃO DINÂMICA DO MODELO (Discovery vs Execution)
    const model = isExecution
      ? (import.meta.env.VITE_OLLAMA_EXECUTION_MODEL || import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:7b")
      : (import.meta.env.VITE_OLLAMA_DISCOVERY_MODEL || import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:7b");

    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model, // <-- Modelo dinâmico do seu .env
        messages: messagesPayload,
        stream: wantsStream,
        format: "json",
        options: {
          temperature: isExecution ? 0.1 : 0.3,
          num_predict: isExecution ? 8000 : 4000
        }
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama Local Erro ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return { raw: data.message?.content ?? "", provider: "ollama" };
  } 
  
  // 3. ROTEAMENTO OMNIROUTE
  else {
    const apiKey = import.meta.env.VITE_OMNIROUTE_API_KEY;
    const apiUrl = import.meta.env.VITE_OMNIROUTE_API_URL || "https://api.openai.com/v1/chat/completions";
    const model = import.meta.env.VITE_OMNIROUTE_MODEL || "gpt-4o-mini";

    if (!apiKey) throw new Error("API Key não configurada no .env (VITE_OMNIROUTE_API_KEY)");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messagesPayload,
        temperature: isExecution ? 0.1 : 0.3,
        max_tokens: isExecution ? 8000 : 4000,
        stream: wantsStream,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    if (wantsStream && response.body) {
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
                if (options.onStream) {
                  const partialChat = extractChatField(rawJson);
                  if (partialChat) options.onStream(partialChat);
                }
              }
            } catch { /* Ignora falhas de parse de pedaços incompletos */ }
          }
        }
      }
      return { raw: rawJson, provider: "omniroute" };
    } else {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      return { raw: content, provider: "omniroute" };
    }
  }
}

// ============================================================
// FUNÇÃO PÚBLICA PRINCIPAL
// ============================================================
export async function sendToOllama(
  history: ChatTurn[],
  brandContext: BrandContext,
  currentPlan?: DiscoveryPlan,
  options: OllamaGenerationOptions = {},
): Promise<OllamaResult> {
  const wantsExecution = Boolean(options.targetAsset);
  const targetAsset = options.targetAsset;
  const startedAt = Date.now();

  const systemPrompt = wantsExecution && targetAsset
    ? EXECUTION_AGENT_PROMPT(brandContext, currentPlan, targetAsset, options)
    : DISCOVERY_AGENT_PROMPT(currentPlan, brandContext);

  const recentUserBriefing = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join("\n\n---\n\n");

  const isolatedBriefing = wantsExecution && targetAsset
    ? extractSpecificBriefing(recentUserBriefing, targetAsset)
    : recentUserBriefing;

  const messagesPayload = wantsExecution && targetAsset
    ? [
        { role: "system" as const, content: systemPrompt },
        {
          role: "user" as const,
          content: `=== REGRAS OBRIGATÓRIAS DESTA PEÇA ===\n${isolatedBriefing}\n\n=== TAREFA ===\nGere AGORA o JSON para a peça ${targetAsset.toUpperCase()}. Siga as frases acima à risca.`,
        },
      ]
    : [
        { role: "system" as const, content: systemPrompt },
        ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), wantsExecution ? 500_000 : 320_000);

  let rawJson = "";
  let providerUsed: "omniroute" | "ollama" = "omniroute";

  try {
    const result = await callDirectAi(messagesPayload, options, controller);
    rawJson = result.raw;
    providerUsed = result.provider as "omniroute" | "ollama";

    const parsed = tryParseJson(rawJson);
    const metaBase: OllamaResultMeta = {
      requestId: options.requestId ?? createRequestId(),
      model: providerUsed,
      intent: options.intent ?? (wantsExecution ? "campaign" : "discovery"),
      stage: wantsExecution ? "generating" : "discovery",
      usedFallback: true, 
      generatedAt: new Date().toISOString(),
      provider: providerUsed,
    };

    if (!parsed && wantsExecution) {
      throw new Error(
        "A IA não conseguiu concluir a resposta a tempo. Peça para gerar novamente esta peça.",
      );
    }

    if (!parsed) {
      return {
        chat: "Desculpe, tive um problema ao processar seu pedido. Podemos tentar novamente?",
        action: "discovery_continue",
        builder: createFallbackBuilder(currentPlan),
        meta: { ...metaBase, stage: "discovery", latencyMs: Date.now() - startedAt },
      };
    }

    const builder = normalizeBuilder(parsed as OllamaResponse, currentPlan, targetAsset, options.productImageUrl);
    
    return {
      chat: (parsed as OllamaResponse).chat || (wantsExecution ? "Peça gerada." : "Briefing atualizado."),
      action: (parsed as OllamaResponse).action || "discovery_continue",
      targetKeys: (parsed as OllamaResponse).targetKeys,
      builder,
      scores: (parsed as OllamaResponse).scores,
      meta: { ...metaBase, stage: wantsExecution ? "completed" : "ready_to_generate", latencyMs: Date.now() - startedAt },
    };
  } catch (error: unknown) {
    if ((error as { name?: string }).name === "AbortError") throw new Error("Tempo excedido.");
    throw new Error(`Falha no pipeline de IA: ${String(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}