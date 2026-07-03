/**
 * agent.ts — cliente do agente de marketing com orquestração de prompt.
 *
 * Melhorias v2:
 * - detectMissingBriefing: identifica campos críticos ausentes por intent
 * - enrichPromptWithReasoning: injeta raciocínio estratégico no prompt
 * - PreflightResult: tipo de retorno da validação de briefing
 * - callPreflight: chama /api/preflight antes de gerar, quando necessário
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

/** Campos obrigatórios mínimos por intent */
const REQUIRED_FIELDS: Record<Exclude<Intent, "image">, string[]> = {
  email:     ["objetivo", "oferta", "público"],
  banner:    ["marca", "headline ou produto"],
  instagram: ["público", "objetivo"],
  linkedin:  ["empresa", "público", "objetivo"],
  landing:   ["marca", "produto", "público", "CTA"],
  datasheet: ["produto", "atributos principais"],
  text:      [],
};

/** Perguntas padrão para campos ausentes */
const FIELD_QUESTIONS: Record<string, string> = {
  "objetivo":            "Qual é o objetivo principal? (conversão, awareness, lançamento, engajamento)",
  "oferta":             "Qual é a oferta ou produto principal desta peça?",
  "público":            "Quem é o público-alvo? (cargo, setor, faixa etária, dor principal)",
  "marca":              "Qual é o nome da marca ou empresa?",
  "headline ou produto": "Qual produto ou headline principal deseja destacar?",
  "empresa":            "Qual é o nome da empresa e setor de atuação?",
  "produto":            "Qual é o produto ou serviço que deve ser apresentado?",
  "CTA":                "Qual é a ação que o usuário deve tomar? (ex: comprar, solicitar proposta, baixar)",
  "atributos principais": "Quais são os 3 atributos técnicos mais importantes do produto?",
};

/**
 * Detecta campos críticos ausentes no prompt do usuário para um dado intent.
 * Retorna lista de campos faltantes.
 */
export function detectMissingBriefing(
  prompt: string,
  intent: Exclude<Intent, "image">,
): string[] {
  const p = prompt.toLowerCase();
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
        if (!/\b(público|persona|cliente|consumidor|profissional|empresa|b2b|b2c|gestores?|diretores?|estudantes?|médicos?|engenheiros?)\b/i.test(p))
          missing.push(field);
        break;
      case "marca":
        if (p.length < 15 && !/[A-Z]{2,}/.test(prompt))
          missing.push(field);
        break;
      case "headline ou produto":
        if (p.split(" ").length < 5)
          missing.push(field);
        break;
      case "empresa":
        if (!/[A-Z][a-z]+|[A-Z]{2,}/.test(prompt))
          missing.push(field);
        break;
      case "produto":
        if (!/\b(produto|serviço|app|software|plataforma|equipamento|solução|sistema)\b/i.test(p))
          missing.push(field);
        break;
      case "CTA":
        if (!/\b(comprar|compre|solicitar|solicite|baixar|baixe|acessar|acesse|cadastrar|cadastre|contratar|contrate|saiba mais|clique|entre em contato)\b/i.test(p))
          missing.push(field);
        break;
      case "atributos principais":
        if (p.split(" ").length < 8)
          missing.push(field);
        break;
    }
  }

  return missing;
}

/**
 * Gera perguntas de briefing baseadas nos campos faltantes.
 * Retorna no máximo 3 perguntas.
 */
export function buildBriefingQuestions(missingFields: string[]): string[] {
  return missingFields
    .slice(0, 3)
    .map((f) => FIELD_QUESTIONS[f] ?? `Por favor, informe: ${f}`);
}

/**
 * Detecta o objetivo de copy implícito no prompt.
 */
export function detectCopyObjective(prompt: string): CopyObjective {
  const p = prompt.toLowerCase();
  if (/\b(lançamento|launch|novo|estreia|novidade)\b/.test(p)) return "lancamento";
  if (/\b(comprar|compre|desconto|oferta|promoção|converter|conversão|vendas?)\b/.test(p)) return "conversao";
  if (/\b(awareness|marca|brand|reconhecimento|presença|institucional|apresentar)\b/.test(p)) return "awareness";
  if (/\b(engajamento|curtida|compartilhar|interação|comunidade|seguidores?)\b/.test(p)) return "engajamento";
  return "conversao";
}

/**
 * Detecta estágio do funil implícito no prompt.
 */
export function detectFunnelStage(prompt: string, objective: CopyObjective): FunnelStage {
  const p = prompt.toLowerCase();
  if (/\b(desconto|oferta|compre|black friday|promoção|cta|solicite|fechar|pedido)\b/.test(p)) return "conversion";
  if (/\b(comparar|avaliar|benefício|por que|vantagem|diferencial)\b/.test(p)) return "consideration";
  if (/\b(awareness|marca|brand|conhecer|apresentar|introdução|novidade|lançamento)\b/.test(p)) return "awareness";
  if (/\b(fidelização|retenção|cliente|renovação|upsell|exclusivo para)\b/.test(p)) return "retention";
  return objective === "conversao" ? "conversion" : "awareness";
}

/**
 * Sugere tom de voz baseado em intent + objetivo.
 */
export function suggestTone(intent: Intent, objective: CopyObjective, prompt: string): string {
  const p = prompt.toLowerCase();
  if (/\b(técnico|científico|laboratório|medical|pharma|b2b|enterprise|industrial)\b/.test(p)) return "técnico-profissional";
  if (/\b(premium|luxo|exclusivo|sofisticado|alto padrão)\b/.test(p)) return "premium";
  if (/\b(descontraído|informal|jovem|divertido|criativo|viral)\b/.test(p)) return "descontraído";
  if (intent === "linkedin") return "profissional-B2B";
  if (objective === "lancamento") return "entusiasmado-aspiracional";
  if (objective === "conversao") return "direto-persuasivo";
  return "profissional";
}

/**
 * Gera um resumo de raciocínio estratégico que será exibido no chat
 * antes do artefato — aumenta percepção de inteligência do agente.
 */
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
  const { intent, objective, funnelStage, tone, missingFields, multipleOutputs, outputCount } = params;

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

  if (multipleOutputs && outputCount && outputCount > 1) {
    lines.push(`**Estratégia:** Vou gerar ${outputCount} variações com ângulos distintos: autoridade, dor do cliente e ganho de eficiência.`);
  }

  if (missingFields.length > 0) {
    lines.push(`\n⚠️ **Dados incompletos:** ${missingFields.join(", ")}. Gerando com as informações disponíveis — configure o perfil de marca para resultados mais precisos.`);
  }

  return lines.join("\n");
}

export function detectIntent(prompt: string): Intent {
  const p = prompt.toLowerCase();
  if (/\b(landing\s*page|página de vendas|página de captura|lp\b)\b/.test(p)) return "landing";
  if (/\b(banner|banners)\b/.test(p)) return "banner";
  if (/\b(instagram|insta|post\s+ig|post\s+insta|reel)\b/.test(p)) return "instagram";
  if (/\b(linkedin|linked\s+in|post\s+linkedin)\b/.test(p)) return "linkedin";
  if (/\b(imagem|imagens|foto|ilustra|art\s?work|logo|visual|criativo|gere\s+uma\s+imagem)\b/.test(p)) return "image";
  if (/\b(e-?mail|email|newsletter|html|marketing direto|disparo)\b/.test(p)) return "email";
  if (/\b(ficha\s+t[eé]cnica|datasheet|especifica|spec|pdf|one[- ]?pager)\b/.test(p)) return "datasheet";
  return "text";
}

/** Detecta se o pedido envolve múltiplas saídas (ex: "3 legendas", "5 opções") */
export function detectMultipleOutputs(prompt: string): { multiple: boolean; count: number } {
  const match = prompt.match(/\b([2-9]|\d{2})\s+(legendas?|opções?|versões?|variações?|alternativas?|copies?|textos?|headlines?)\b/i);
  if (match) return { multiple: true, count: parseInt(match[1]) };
  return { multiple: false, count: 1 };
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

/**
 * callOllama — chama a Server Function /api/chat com streaming.
 * Inclui reasoning no body para o servidor injetar no system prompt.
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

/**
 * translatePromptForImage — chama /api/translate para converter
 * o briefing em PT para um prompt em inglês antes do Pollinations.
 */
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
