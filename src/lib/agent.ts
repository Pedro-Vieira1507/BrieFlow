/**
 * agent.ts — cliente do agente de marketing com orquestração de prompt.
 *
 * v3 — Multi-Agent Architecture:
 * - detectMissingBriefing: identifica campos críticos ausentes por intent
 * - Preflight Interceptor: para a geração e injeta pergunta de clarificação
 * - Intent Memory: herda a intenção original quando o utilizador responde a um preflight
 * - callOllama: envia reasoning para o servidor injetar no system prompt do Agente 1
 */

export type Intent =
  | "image"
  | "email"
  | "banner"
  | "instagram"
  | "linkedin"
  | "landing"
  | "datasheet"
  | "text";

export type FunnelStage = "awareness" | "consideration" | "conversion" | "retention";
export type CopyObjective = "conversao" | "awareness" | "lancamento" | "engajamento" | "institucional";

export interface PreflightResult {
  ready: boolean;
  missingFields: string[];
  questions: string[];
  detectedIntent: Intent;
  detectedObjective?: CopyObjective;
  detectedFunnelStage?: FunnelStage;
  suggestedTone?: string;
  reasoningSummary?: string;
}

// ============================================================================
// PREFLIGHT: CAMPOS OBRIGATÓRIOS POR INTENT
// ============================================================================

/** Campos obrigatórios mínimos por intent */
const REQUIRED_FIELDS: Record<Exclude<Intent, "image">, string[]> = {
  email:     ["objetivo", "oferta", "público"],
  banner:    ["produto ou oferta"],
  instagram: ["público", "objetivo"],
  linkedin:  ["empresa", "público", "objetivo"],
  landing:   ["marca", "produto", "público", "CTA"],
  datasheet: ["produto", "atributos principais"],
  text:      [],
};

/** Perguntas padrão para campos ausentes */
const FIELD_QUESTIONS: Record<string, string> = {
  "objetivo":              "Qual é o objetivo principal? (conversão, awareness, lançamento, engajamento)",
  "oferta":               "Qual é a oferta ou produto principal desta peça?",
  "público":              "Quem é o público-alvo? (cargo, setor, faixa etária, dor principal)",
  "marca":                "Qual é o nome da marca ou empresa?",
  "produto ou oferta":    "Qual produto ou oferta principal deseja destacar?",
  "empresa":              "Qual é o nome da empresa e setor de atuação?",
  "produto":              "Qual é o produto ou serviço que deve ser apresentado?",
  "CTA":                  "Qual é a ação que o utilizador deve tomar? (ex: comprar, solicitar proposta, baixar)",
  "atributos principais": "Quais são os 3 atributos técnicos mais importantes do produto?",
};

/**
 * detectMissingBriefing — verifica se o prompt tem os dados mínimos
 * necessários para o intent. Retorna lista de campos em falta.
 *
 * Estratégia: se o prompt for muito curto (< 5 palavras) e não mencionar
 * nenhum produto/oferta explícito, considera que o briefing está incompleto.
 */
export function detectMissingBriefing(
  prompt: string,
  intent: Exclude<Intent, "image">,
): string[] {
  const p = prompt.toLowerCase();
  const words = p.trim().split(/\s+/).filter(Boolean);
  const required = REQUIRED_FIELDS[intent] ?? [];
  const missing: string[] = [];

  for (const field of required) {
    switch (field) {
      case "objetivo":
        if (!/\b(objetivo|converter|vendas?|awareness|lançamento|engajamento|promover|divulgar|captar|gerar leads?)\b/i.test(p))
          missing.push(field);
        break;

      case "oferta":
        if (!/\b(produto|serviço|oferta|desconto|promoção|[\d]+%|lançamento|kit|pacote)\b/i.test(p))
          missing.push(field);
        break;

      case "público":
        if (!/\b(público|persona|cliente|consumidor|profissional|empresa|b2b|b2c|gestores?|diretores?|estudantes?|médicos?|engenheiros?|laboratório|laboratorio)\b/i.test(p))
          missing.push(field);
        break;

      case "marca":
        // Tem marca se: o prompt tem mais de 3 palavras OU contém sigla/nome capitalizado
        if (words.length < 4 && !/[A-Z]{2,}/.test(prompt))
          missing.push(field);
        break;

      case "produto ou oferta":
        // O campo crítico para banners: precisa de nomear algum produto/serviço
        if (words.length < 4 && !/[A-Z]/.test(prompt))
          missing.push(field);
        break;

      case "empresa":
        if (!/[A-Z][a-z]+|[A-Z]{2,}/.test(prompt))
          missing.push(field);
        break;

      case "produto":
        if (!/\b(produto|serviço|app|software|plataforma|equipamento|solução|sistema|pipeta|reagente|kit|instrumento)\b/i.test(p))
          missing.push(field);
        break;

      case "CTA":
        if (!/\b(comprar|compre|solicitar|solicite|baixar|baixe|acessar|acesse|cadastrar|cadastre|contratar|contrate|saiba mais|clique|entre em contato)\b/i.test(p))
          missing.push(field);
        break;

      case "atributos principais":
        if (words.length < 8)
          missing.push(field);
        break;
    }
  }

  return missing;
}

/**
 * buildBriefingQuestions — gera perguntas de clarificação (máx 3)
 * baseadas nos campos em falta.
 */
export function buildBriefingQuestions(missingFields: string[]): string[] {
  return missingFields
    .slice(0, 3)
    .map((f) => FIELD_QUESTIONS[f] ?? `Por favor, informe: ${f}`);
}

// ============================================================================
// REASONING: DETECÇÃO DE INTENÇÃO ESTRATÉGICA
// ============================================================================

export function detectCopyObjective(prompt: string): CopyObjective {
  const p = prompt.toLowerCase();
  if (/\b(lançamento|launch|novo|estreia|novidade)\b/.test(p)) return "lancamento";
  if (/\b(comprar|compre|desconto|oferta|promoção|converter|conversão|vendas?)\b/.test(p)) return "conversao";
  if (/\b(awareness|marca|brand|reconhecimento|presença|institucional|apresentar)\b/.test(p)) return "awareness";
  if (/\b(engajamento|curtida|compartilhar|interação|comunidade|seguidores?)\b/.test(p)) return "engajamento";
  return "conversao";
}

export function detectFunnelStage(prompt: string, objective: CopyObjective): FunnelStage {
  const p = prompt.toLowerCase();
  if (/\b(desconto|oferta|compre|black friday|promoção|cta|solicite|fechar|pedido)\b/.test(p)) return "conversion";
  if (/\b(comparar|avaliar|benefício|por que|vantagem|diferencial)\b/.test(p)) return "consideration";
  if (/\b(awareness|marca|brand|conhecer|apresentar|introdução|novidade|lançamento)\b/.test(p)) return "awareness";
  if (/\b(fidelização|retenção|cliente|renovação|upsell|exclusivo para)\b/.test(p)) return "retention";
  return objective === "conversao" ? "conversion" : "awareness";
}

export function suggestTone(intent: Intent, objective: CopyObjective, prompt: string): string {
  const p = prompt.toLowerCase();
  if (/\b(técnico|científico|laboratório|laboratorio|medical|pharma|b2b|enterprise|industrial|equipamento)\b/.test(p)) return "técnico-profissional";
  if (/\b(premium|luxo|exclusivo|sofisticado|alto padrão)\b/.test(p)) return "premium";
  if (/\b(descontraído|informal|jovem|divertido|criativo|viral)\b/.test(p)) return "descontraído";
  if (intent === "linkedin") return "profissional-B2B";
  if (objective === "lancamento") return "entusiasmado-aspiracional";
  if (objective === "conversao") return "direto-persuasivo";
  return "profissional";
}

export function buildReasoningSummary(params: {
  intent: Intent;
  objective: CopyObjective;
  funnelStage: FunnelStage;
  tone: string;
  prompt: string;
  missingFields: string[];
  multipleOutputs?: boolean;
  outputCount?: number;
}): string {
  const { intent, objective, funnelStage, tone, missingFields } = params;

  const intentLabels: Record<Intent, string> = {
    email:     "E-mail HTML",
    banner:    "Banner",
    instagram: "Post Instagram",
    linkedin:  "Post LinkedIn",
    landing:   "Landing Page",
    datasheet: "Ficha Técnica",
    text:      "Texto / Copy",
    image:     "Imagem",
  };

  const objectiveLabels: Record<CopyObjective, string> = {
    conversao:     "conversão",
    awareness:     "awareness de marca",
    lancamento:    "lançamento",
    engajamento:   "engajamento",
    institucional: "institucional",
  };

  const funnelLabels: Record<FunnelStage, string> = {
    awareness:     "topo de funil",
    consideration: "meio de funil",
    conversion:    "fundo de funil",
    retention:     "retenção",
  };

  const lines: string[] = [];
  lines.push(`**Formato detectado:** ${intentLabels[intent]}`);
  lines.push(`**Objetivo:** ${objectiveLabels[objective]} · **Funil:** ${funnelLabels[funnelStage]}`);
  lines.push(`**Tom sugerido:** ${tone}`);

  if (missingFields.length > 0) {
    lines.push(`\n⚠️ **Dados incompletos:** ${missingFields.join(", ")}. Gerando com as informações disponíveis.`);
  }

  return lines.join("\n");
}

// ============================================================================
// DETECÇÃO DE INTENT
// ============================================================================

export function detectIntent(prompt: string): Intent {
  const p = prompt.toLowerCase();
  if (/\b(landing\s*page|página de vendas|página de captura|lp\b)/.test(p)) return "landing";
  if (/\b(banner|banners)\b/.test(p)) return "banner";
  if (/\b(instagram|insta|post\s+ig|post\s+insta|reel)\b/.test(p)) return "instagram";
  if (/\b(linkedin|linked\s+in|post\s+linkedin)\b/.test(p)) return "linkedin";
  if (/\b(imagem|imagens|foto|ilustra|art\s?work|logo|visual|criativo|gere\s+uma\s+imagem)\b/.test(p)) return "image";
  if (/\b(e-?mail|email|newsletter|html|marketing direto|disparo)\b/.test(p)) return "email";
  if (/\b(ficha\s+t[eé]cnica|datasheet|especifica|spec|pdf|one[- ]?pager)\b/.test(p)) return "datasheet";
  return "text";
}

export function detectMultipleOutputs(prompt: string): { multiple: boolean; count: number } {
  const match = prompt.match(/\b([2-9]|\d{2})\s+(legendas?|opções?|versões?|variações?|alternativas?|copies?|textos?|headlines?)\b/i);
  if (match) return { multiple: true, count: parseInt(match[1]) };
  return { multiple: false, count: 1 };
}

// ============================================================================
// STREAMING: callOllama
// ============================================================================

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

/**
 * callOllama — POST /api/chat com streaming SSE.
 * Inclui reasoning no body para o servidor injetar no system prompt do Agente 1.
 * Retorna uma função de cancelamento.
 */
export function callOllama(
  prompt: string,
  intent: Exclude<Intent, "image">,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  reasoning?: {
    objective?: CopyObjective;
    funnelStage?: FunnelStage;
    tone?: string;
    multipleOutputs?: boolean;
    outputCount?: number;
  },
): () => void {
  const controller = new AbortController();
  if (signal) signal.addEventListener("abort", () => controller.abort());

  let fullText = "";

  (async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, intent, reasoning }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        callbacks.onError((err as { error: string }).error ?? `HTTP ${res.status}`);
        return;
      }

      if (!res.body) {
        callbacks.onError("Resposta sem corpo do servidor.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            callbacks.onDone(fullText);
            return;
          }
          try {
            const token = JSON.parse(payload) as string;
            fullText += token;
            callbacks.onToken(token);
          } catch {
            // payload inválido — ignora
          }
        }
      }

      callbacks.onDone(fullText);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      callbacks.onError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  })();

  return () => controller.abort();
}

// ============================================================================
// UTILITÁRIOS DE IMAGEM
// ============================================================================

export async function translatePromptForImage(
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal,
    });
    if (!res.ok) return prompt;
    const { englishPrompt } = (await res.json()) as { englishPrompt: string };
    return englishPrompt ?? prompt;
  } catch {
    return prompt;
  }
}

export function buildPollinationsUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
) {
  const { width = 1024, height = 1024, seed } = opts;
  const encoded = encodeURIComponent(prompt);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    nologo: "true",
  });
  if (seed !== undefined) params.set("seed", String(seed));
  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}

export function looksLikeHtml(text: string): boolean {
  return /<!doctype html|<html[\s>]|<body[\s>]|<table[\s>]|<div[\s>]/i.test(text);
}
