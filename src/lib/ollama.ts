// src/lib/ollama.ts
import type {
  BrandContext,
  BuilderState,
  CampaignAsset,
  DiscoveryPlan,
} from "@/types/builder";
import { formatSiteContextForAgent } from "@/lib/scrape-site";
import type {
  AiAssetType,
  AiChatMessage,
  AiGenerationMeta,
  AiIntent,
} from "@/types/ai";

// ─── DISCOVERY AGENT ────────────────────────────────────────────────────────
const DISCOVERY_AGENT_PROMPT = (
  currentPlan: DiscoveryPlan | undefined,
  brandContext: BrandContext,
) => `Você é o BrieFlow Creative Director, um diretor de criação sênior especializado em marketing digital premium.

Sua missão é conduzir um briefing conversacional para criar banners, posts sociais e e-mails marketing com alta qualidade.

=== REGRAS DE CONVERSA ===
1. Use tom profissional, criativo, acolhedor e direto.
2. Faça UMA pergunta por vez.
3. Valide a resposta anterior em uma frase curta antes de avançar.
4. Se o usuário trouxer muitas informações, extraia o essencial e atualize o plano.
5. Não pergunte algo que já esteja disponível nos dados da marca ou do site.
6. Responda ESTRITAMENTE em JSON válido, sem markdown e sem texto externo.
7. Nunca deixe "builder" ausente.
8. Quando já houver dados suficientes, não faça perguntas extras: conclua o briefing.
9. IMPORTANTE: Se um site foi fornecido e o produto foi mencionado, pergunte o SKU ou referência do produto para buscar a imagem real. Faça isso antes de perguntar sobre canais.

=== DADOS DO SITE ===
${
  brandContext.site
    ? formatSiteContextForAgent(brandContext.site)
    : "Nenhum site analisado ainda."
}

=== CONTEXTO DA MARCA ===
Persona: ${brandContext.persona}
Tom desejado: ${brandContext.tone}
Framework: ${brandContext.framework}
${brandContext.brandName ? `Marca: ${brandContext.brandName}` : ""}
${brandContext.product ? `Produto: ${brandContext.product}` : ""}
${brandContext.offer ? `Oferta: ${brandContext.offer}` : ""}

=== PLANO ATUAL ===
${
  currentPlan
    ? JSON.stringify(currentPlan, null, 2)
    : "Sem dados. Comece pelo Passo 1."
}

=== ROTEIRO DE QUALIFICAÇÃO ===
Passo 1: Site, marca ou produto.
Passo 2: Objetivo da campanha.
Passo 3: Público-alvo.
Passo 4: SKU ou referência do produto principal (para buscar imagem real do site). Se o usuário não souber, deixe productSku como null.
Passo 5: Oferta, diferencial, CTA e canais desejados.
Passo 6: Resuma o briefing em 3 a 5 linhas e pergunte se pode gerar as peças.

Quando o briefing estiver completo:
- missingInfo deve ser exatamente "Nenhuma".
- proposedStrategy deve descrever exatamente as peças a gerar e o ângulo criativo.
- channels deve conter apenas: "banner", "email" e/ou "social".
- Se o usuário pediu banner, e-mail e post, use:
  ["banner", "email", "social"].

=== RETORNO OBRIGATÓRIO ===
{
  "chat": "Validação breve + próxima pergunta, ou resumo final pedindo aprovação.",
  "builder": {
    "type": "discovery_plan",
    "discoveryPlan": {
      "detectedContext": "Resumo estruturado do contexto conhecido.",
      "missingInfo": "Informação que ainda falta ou Nenhuma.",
      "proposedStrategy": "Estratégia e peças propostas.",
      "brandName": "Nome da marca ou null.",
      "product": "Produto ou serviço ou null.",
      "audience": "Público-alvo ou null.",
      "offer": "Oferta ou CTA ou null.",
      "channels": ["banner", "email", "social"],
      "websiteUrl": "URL do site ou null.",
      "productSku": "SKU ou referência do produto ou null."
    }
  }
}`;

// ─── SCHEMA POR TIPO DE PEÇA ─────────────────────────────────────────────────
function getAssetContentSchema(targetAsset: AiAssetType): string {
  if (targetAsset === "banner") {
    return `"content": {
          "type": "banner",
          "title": "Título com no máximo 5 palavras",
          "subtitle": "Linha de benefício",
          "cta": "CTA curto",
          "imagePrompt": "Prompt completo em inglês (usado somente se não houver imagem real)",
          "productSku": "SKU do produto se disponível ou null"
        }`;
  }

  if (targetAsset === "email") {
    return `"content": {
          "type": "email",
          "preheader": "Pré-header entre 40 e 80 caracteres",
          "title": "Assunto ou headline",
          "subtitle": "Linha de apoio opcional",
          "body": "Parágrafo 1\\n\\nParágrafo 2\\n\\nParágrafo 3",
          "cta": "Texto do botão",
          "footerText": "Texto legal simples",
          "emailHeroImagePrompt": "Prompt completo em inglês (usado somente se não houver imagem real)",
          "productSku": "SKU do produto se disponível ou null"
        }`;
  }

  return `"content": {
          "type": "social",
          "caption": "Legenda entre 2 e 4 linhas",
          "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
          "imagePrompt": "Prompt completo em inglês (usado somente se não houver imagem real)",
          "productSku": "SKU do produto se disponível ou null"
        }`;
}

// ─── EXECUTION AGENT ─────────────────────────────────────────────────────────
const EXECUTION_AGENT_PROMPT = (
  context: BrandContext,
  plan: DiscoveryPlan | undefined,
  targetAsset: AiAssetType,
  productImageUrl?: string | null,
) => `Você é o BrieFlow Execution Agent, um diretor de criação de marketing premium.

Gere APENAS a peça solicitada, com copy persuasiva, direção de arte sofisticada e consistência com o briefing.

=== BRIEFING APROVADO ===
${plan ? JSON.stringify(plan, null, 2) : "Use o histórico da conversa."}

=== DADOS DA MARCA ===
${context.site ? formatSiteContextForAgent(context.site) : "Sem site analisado."}
Marca: ${context.brandName ?? "Não informada"}
Produto: ${context.product ?? "Não informado"}
Oferta: ${context.offer ?? "Não informada"}
Persona: ${context.persona}
Tom: ${context.tone}
${plan?.productSku ? `SKU do Produto: ${plan.productSku}` : ""}

=== IMAGEM DO PRODUTO ===
${
  productImageUrl
    ? `✅ Imagem real do produto disponível: ${productImageUrl}
INSTRUÇÃO: O campo "productImageUrl" já está preenchido com a URL acima. Não invente outra URL.
Ainda assim, gere um "imagePrompt" descritivo em inglês como fallback para regeneração futura.`
    : `⚠️ Nenhuma imagem real encontrada. Gere um "imagePrompt" descritivo em inglês para o Pollinations.
O campo "productImageUrl" deve ser null.`
}

=== TAREFA ===
Gerar APENAS: ${targetAsset.toUpperCase()}

=== PADRÃO DE QUALIDADE ===
- Escreva em português brasileiro.
- Evite clichês como "revolucionário", "melhor do mercado", "imperdível" e "não perca".
- Priorize benefício concreto, clareza, prova e CTA acionável.
- Use frases curtas e elegantes.
- imagePrompt e emailHeroImagePrompt devem estar em inglês.
- Prompts de imagem não podem incluir texto, letras, logotipos ou marca d'água.
- Responda ESTRITAMENTE em JSON válido.
- Não use markdown.
- Não adicione comentários.
- Não deixe campos obrigatórios vazios.
- Retorne apenas UMA peça dentro de campaignAssets.

${
  targetAsset === "banner"
    ? `=== BANNER ===
- title: máximo de 5 palavras.
- subtitle: uma linha, no máximo 18 palavras.
- cta: de 2 a 4 palavras.
- imagePrompt: produto ou elemento principal no terço direito, espaço negativo escuro à esquerda para tipografia, cinematic commercial lighting, ultra premium advertising photography, no text, no watermark.`
    : ""
}

${
  targetAsset === "email"
    ? `=== E-MAIL ===
- preheader: entre 40 e 80 caracteres.
- title: assunto forte, máximo de 50 caracteres.
- subtitle: opcional, máximo de 12 palavras.
- body: 2 ou 3 parágrafos curtos separados por \\n\\n.
- cta: botão claro e acionável.
- footerText: linha legal simples.
- emailHeroImagePrompt: wide cinematic commercial hero, 2:1 ratio, premium campaign, no text, no watermark.`
    : ""
}

${
  targetAsset === "social"
    ? `=== POST SOCIAL ===
- caption: entre 2 e 4 linhas.
- hashtags: array de 5 a 8 hashtags relevantes, todas iniciando com #.
- imagePrompt: vertical 4:5 commercial photo, editorial lighting, premium Instagram aesthetic, no text, no watermark.`
    : ""
}

=== RETORNO OBRIGATÓRIO ===
{
  "chat": "Confirmação breve de que a peça foi gerada.",
  "builder": {
    "type": "campaign",
    "campaignAssets": [
      {
        "id": "${targetAsset}-1",
        "type": "${targetAsset}",
        "status": "draft",
        ${getAssetContentSchema(targetAsset)},
        "productImageUrl": ${productImageUrl ? `"${productImageUrl}"` : "null"}
      }
    ]
  },
  "scores": {
    "persuasion": 90,
    "clarity": 90,
    "seo": 80
  }
}`;

// ─── TIPOS ────────────────────────────────────────────────────────────────────
export interface ChatTurn extends AiChatMessage {
  id?: string;
}

export interface OllamaGenerationOptions {
  intent?: AiIntent;
  requestId?: string;
  targetAsset?: AiAssetType;
  // NOVO — URL da imagem real do produto, resolvida antes de chamar sendToOllama
  productImageUrl?: string | null;
  onStream?: (partialChat: string) => void;
}

export interface OllamaResultMeta extends AiGenerationMeta {
  provider: "ollama";
}

export interface OllamaResponse {
  chat: string;
  builder: BuilderState;
  scores?: {
    persuasion: number;
    clarity: number;
    seo: number;
  };
}

export type OllamaResult = OllamaResponse & {
  meta: OllamaResultMeta;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `bf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveOllamaApiUrl(): string {
  const envUrl = import.meta.env.VITE_OLLAMA_API_URL as string | undefined;
  if (envUrl) {
    return `${envUrl
      .replace("/v1/chat/completions", "")
      .replace("/api/chat", "")
      .replace(/\/$/, "")}/api/chat`;
  }
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:11434/api/chat`;
  }
  return "http://localhost:11434/api/chat";
}

function pickModel(wantsExecution: boolean): string {
  const discoveryModel =
    (import.meta.env.VITE_OLLAMA_DISCOVERY_MODEL as string | undefined) ??
    "qwen2.5:7b";
  const executionModel =
    (import.meta.env.VITE_OLLAMA_EXECUTION_MODEL as string | undefined) ??
    "qwen2.5:7b";
  return wantsExecution ? executionModel : discoveryModel;
}

function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
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
  const cleanText = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleanText) as OllamaResponse;
  } catch {
    // continua
  }
  const extracted = extractBalancedJson(cleanText);
  if (!extracted) return null;
  try {
    return JSON.parse(extracted) as OllamaResponse;
  } catch {
    return null;
  }
}

function extractChatField(rawJson: string): string | null {
  const match = rawJson.match(/"chat"\s*:\s*"/);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  let result = "";
  let escaped = false;
  for (let index = start; index < rawJson.length; index += 1) {
    const character = rawJson[index];
    if (escaped) {
      const replacements: Record<string, string> = {
        n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\",
      };
      result += replacements[character] ?? character;
      escaped = false;
      continue;
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
  if (targetAsset === "banner") {
    return Boolean(content.title && content.subtitle && content.cta && content.imagePrompt);
  }
  if (targetAsset === "email") {
    return Boolean(
      content.preheader && content.title && content.body && content.cta && content.emailHeroImagePrompt,
    );
  }
  return Boolean(
    content.caption &&
      Array.isArray(content.hashtags) &&
      content.hashtags.length >= 3 &&
      content.imagePrompt,
  );
}

function createFallbackBuilder(currentPlan: DiscoveryPlan | undefined): BuilderState {
  return currentPlan
    ? { type: "discovery_plan", discoveryPlan: currentPlan }
    : { type: "none" };
}

function normalizeBuilder(
  response: OllamaResponse,
  currentPlan: DiscoveryPlan | undefined,
  targetAsset?: AiAssetType,
  productImageUrl?: string | null,
): BuilderState {
  const builder = response.builder;
  if (!builder) return createFallbackBuilder(currentPlan);

  if (
    builder.type === "campaign" &&
    Array.isArray(builder.campaignAssets) &&
    targetAsset
  ) {
    const campaignAssets = builder.campaignAssets
      .filter((asset) => asset.type === targetAsset)
      .filter((asset) => validateAsset(asset, targetAsset))
      .map((asset) => ({
        ...asset,
        type: targetAsset,
        status: asset.status ?? "draft",
        content: {
          ...asset.content,
          type: targetAsset,
          // NOVO — injeta a imagem real do produto no content do asset
          productImageUrl: productImageUrl ?? asset.content.productImageUrl ?? null,
        },
      }));

    return { type: "campaign", campaignAssets };
  }

  return builder;
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────
export async function sendToOllama(
  history: ChatTurn[],
  brandContext: BrandContext,
  currentPlan?: DiscoveryPlan,
  options: OllamaGenerationOptions = {},
): Promise<OllamaResult> {
  const wantsExecution = Boolean(options.targetAsset);
  const targetAsset = options.targetAsset;
  const productImageUrl = options.productImageUrl ?? null;
  const model = pickModel(wantsExecution);
  const startedAt = Date.now();

  const metaBase: OllamaResultMeta = {
    requestId: options.requestId ?? createRequestId(),
    model,
    intent: options.intent ?? (wantsExecution ? "campaign" : "discovery"),
    stage: wantsExecution ? "generating" : "discovery",
    usedFallback: false,
    generatedAt: new Date().toISOString(),
    provider: "ollama",
  };

  // NOVO — passa productImageUrl para o EXECUTION_AGENT_PROMPT
  const systemPrompt =
    wantsExecution && targetAsset
      ? EXECUTION_AGENT_PROMPT(brandContext, currentPlan, targetAsset, productImageUrl)
      : DISCOVERY_AGENT_PROMPT(currentPlan, brandContext);

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    wantsExecution ? 240_000 : 180_000,
  );

  try {
    const response = await fetch(resolveOllamaApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.slice(wantsExecution ? -3 : -6),
        ],
        stream: true,
        format: "json",
        keep_alive: "30m",
        options: {
          temperature: wantsExecution ? 0.2 : 0.4,
          top_p: 0.85,
          num_predict: wantsExecution ? 900 : 600,
          num_ctx: 4096,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Ollama HTTP ${response.status}${errorText ? `: ${errorText.slice(0, 300)}` : ""}`,
      );
    }

    if (!response.body) {
      throw new Error("Streaming não suportado pelo servidor Ollama.");
    }

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
          if (!content) continue;
          rawJson += content;
          if (!wantsExecution) {
            const partialChat = extractChatField(rawJson);
            if (partialChat) options.onStream?.(partialChat);
          }
        } catch {
          // Linha NDJSON incompleta; continua acumulando.
        }
      }
    }

    pendingChunk += decoder.decode();
    if (pendingChunk.trim()) {
      try {
        const finalChunk = JSON.parse(pendingChunk.trim()) as { message?: { content?: string } };
        if (finalChunk.message?.content) rawJson += finalChunk.message.content;
      } catch {
        // O parser abaixo ainda tentará recuperar o JSON acumulado.
      }
    }

    const parsed = tryParseJson(rawJson);
    if (!parsed) {
      console.error("Resposta bruta do Ollama:", rawJson);
      return {
        chat: wantsExecution
          ? "A IA respondeu, mas o formato da peça ficou inválido. Tente gerar novamente."
          : "Tive uma oscilação ao processar a resposta. Pode reenviar ou reformular?",
        builder: createFallbackBuilder(currentPlan),
        meta: {
          ...metaBase,
          stage: "needs_revision",
          usedFallback: true,
          latencyMs: Date.now() - startedAt,
        },
      };
    }

    // NOVO — passa productImageUrl para normalizeBuilder injetar no asset
    const builder = normalizeBuilder(parsed, currentPlan, targetAsset, productImageUrl);

    if (
      wantsExecution &&
      builder.type === "campaign" &&
      (!builder.campaignAssets || builder.campaignAssets.length === 0)
    ) {
      console.error("Peça inválida retornada pelo Ollama:", parsed);
      return {
        chat:
          "A IA concluiu a resposta, mas não preencheu todos os campos obrigatórios da peça. Tente novamente.",
        builder: { type: "campaign", campaignAssets: [] },
        scores: parsed.scores,
        meta: {
          ...metaBase,
          stage: "needs_revision",
          usedFallback: true,
          latencyMs: Date.now() - startedAt,
        },
      };
    }

    const chat =
      parsed.chat ||
      (wantsExecution
        ? "Peça gerada com qualidade premium. Confira no painel ao lado."
        : "Briefing atualizado. Posso seguir?");

    return {
      chat,
      builder,
      scores: parsed.scores,
      meta: {
        ...metaBase,
        stage: wantsExecution ? "completed" : "ready_to_generate",
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "AbortError") {
      throw new Error(
        wantsExecution
          ? "A geração excedeu 4 minutos. Tente novamente ou simplifique o briefing."
          : "O servidor de IA não respondeu a tempo.",
      );
    }
    throw new Error(`Falha de rede com a IA: ${err.message ?? String(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}