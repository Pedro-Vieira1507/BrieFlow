/**
 * agent.ts — cliente do agente de marketing v3
 *
 * Melhorias:
 * - detectMissingBriefing: valida campos críticos por intent com heurísticas mais precisas
 * - Memória de Intenção: inheritIntentFromContext verifica se user responde a pergunta de preflight
 * - callOllama: streaming limpo com AbortController
 * - extractHtml: usa String.fromCharCode para evitar quebra de build com backticks
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

const API_BASE = "";

/** Campos obrigatórios mínimos por intent */
const REQUIRED_FIELDS: Record<Exclude<Intent, "image">, string[]> = {
  email: ["oferta ou produto", "público"],
  banner: ["produto ou oferta"],
  instagram: ["produto ou oferta"],
  linkedin: ["empresa", "objetivo"],
  landing: ["marca", "produto", "CTA"],
  datasheet: ["produto", "atributos principais"],
  text: [],
};

/** Perguntas padrão para campos ausentes */
const FIELD_QUESTIONS: Record<string, string> = {
  "oferta ou produto": "Qual é o produto ou oferta principal que devo destacar?",
  "público": "Quem é o público-alvo? (cargo, setor, principal dor)",
  "produto ou oferta": "Qual produto ou oferta principal devo comunicar?",
  "marca": "Qual é o nome da marca ou empresa?",
  "empresa": "Qual é o nome da empresa e o setor de atuação?",
  "objetivo": "Qual é o objetivo? (conversão, awareness, lançamento, engajamento)",
  "CTA": "Qual é a ação esperada do utilizador? (ex: solicitar orçamento, baixar ebook)",
  "atributos principais": "Quais são os 3 atributos técnicos mais importantes do produto?",
};

/**
 * Detecta campos críticos ausentes no prompt para um dado intent.
 * Heurísticas simplificadas mas robustas: foca em detectar se o utilizador
 * forneceu ALGUMA informação de produto/oferta/público — não tenta parsear semântica complexa.
 */
export function detectMissingBriefing(
  prompt: string,
  intent: Exclude<Intent, "image">,
): string[] {
  const p = prompt.toLowerCase();
  const wordCount = p.split(/\s+/).filter(Boolean).length;
  const required = REQUIRED_FIELDS[intent] ?? [];
  const missing: string[] = [];

  for (const field of required) {
    switch (field) {
      case "oferta ou produto":
      case "produto ou oferta":
      case "produto": {
        const hasProduto =
          /\b(produto|serviço|app|software|plataforma|equipamento|solução|sistema|kit|pacote|oferta|promoção|desconto|\d+%|lançamento)\b/i.test(
            p,
          ) ||
          /[A-Z][a-zA-Z]{2,}/.test(prompt) ||
          wordCount >= 6;
        if (!hasProduto) missing.push(field);
        break;
      }

      case "público": {
        const hasPublico =
          /\b(público|persona|cliente|consumidor|profissional|empresa|b2b|b2c|gestor|diretor|ceo|cto|médico|engenheiro|estudante|equipe|time)\b/i.test(
            p,
          ) ||
          wordCount >= 10;
        if (!hasPublico) missing.push(field);
        break;
      }

      case "marca": {
        const hasMarca = /[A-Z][a-zA-Z]{1,}/.test(prompt) || wordCount >= 8;
        if (!hasMarca) missing.push(field);
        break;
      }

      case "empresa": {
        const hasEmpresa =
          /[A-Z][a-zA-Z]{1,}/.test(prompt) ||
          /\b(empresa|agência|startup|corp|ltd|ltda|inc)\b/i.test(p);
        if (!hasEmpresa) missing.push(field);
        break;
      }

      case "objetivo": {
        const hasObj =
          /\b(objetivo|converter|vendas?|awareness|lançamento|engajamento|promover|divulgar|captar|gerar leads?)\b/i.test(
            p,
          ) || wordCount >= 8;
        if (!hasObj) missing.push(field);
        break;
      }

      case "CTA": {
        const hasCta =
          /\b(comprar|compre|solicitar|solicite|baixar|baixe|acessar|acesse|cadastrar|contratar|saiba mais|clique|entre em contato|agendar|agende|demonstração|orçamento)\b/i.test(
            p,
          ) || wordCount >= 12;
        if (!hasCta) missing.push(field);
        break;
      }

      case "atributos principais": {
        if (wordCount < 8) missing.push(field);
        break;
      }
    }
  }

  return missing;
}

/**
 * Gera perguntas de briefing (máx 2 por vez para não sobrecarregar o utilizador).
 */
export function buildBriefingQuestions(missingFields: string[]): string[] {
  return missingFields
    .slice(0, 2)
    .map((f) => FIELD_QUESTIONS[f] ?? `Por favor, informe: ${f}`);
}

/**
 * Verifica se a resposta atual do utilizador está a responder a uma
 * pergunta de preflight anterior e herda a intenção do assistente.
 *
 * @param currentDetectedIntent - Intent detetada na mensagem atual
 * @param lastAssistantMsg - Última mensagem do assistente
 * @returns A intent correta (herdada ou a detetada)
 */
export function inheritIntentFromContext(
  currentDetectedIntent: Intent,
  lastAssistantMsg?: { reasoning?: { intent?: string; questions?: string[] }; content: string },
): Intent {
  if (!lastAssistantMsg) return currentDetectedIntent;

  const wasAskingPreflight =
    (lastAssistantMsg.reasoning?.questions?.length ?? 0) > 0 ||
    /antes de gerar|por favor, (informe|forneça|indique)|faltam algumas/i.test(
      lastAssistantMsg.content,
    );

  if (wasAskingPreflight && currentDetectedIntent === "text") {
    const inheritedIntent = lastAssistantMsg.reasoning?.intent as Intent | undefined;
    if (inheritedIntent && inheritedIntent !== "text") {
      return inheritedIntent;
    }
  }

  return currentDetectedIntent;
}

export function detectCopyObjective(prompt: string): CopyObjective {
  const p = prompt.toLowerCase();
  if (/\b(lançamento|launch|novo|estreia|novidade)\b/.test(p)) return "lancamento";
  if (/\b(comprar|compre|desconto|oferta|promoção|converter|conversão|vendas?)\b/.test(p))
    return "conversao";
  if (/\b(awareness|marca|brand|reconhecimento|presença|institucional|apresentar)\b/.test(p))
    return "awareness";
  if (/\b(engajamento|curtida|compartilhar|interação|comunidade|seguidores?)\b/.test(p))
    return "engajamento";
  return "conversao";
}

export function detectFunnelStage(prompt: string, objective: CopyObjective): FunnelStage {
  const p = prompt.toLowerCase();
  if (/\b(desconto|oferta|compre|black friday|promoção|cta|solicite|fechar|pedido)\b/.test(p))
    return "conversion";
  if (/\b(comparar|avaliar|benefício|por que|vantagem|diferencial)\b/.test(p))
    return "consideration";
  if (/\b(awareness|marca|brand|conhecer|apresentar|introdução|novidade|lançamento)\b/.test(p))
    return "awareness";
  if (/\b(fidelização|retenção|cliente|renovação|upsell|exclusivo para)\b/.test(p))
    return "retention";
  return objective === "conversao" ? "conversion" : "awareness";
}

export function suggestTone(intent: Intent, objective: CopyObjective, prompt: string): string {
  const p = prompt.toLowerCase();
  if (/\b(técnico|científico|laboratório|medical|pharma|b2b|enterprise|industrial)\b/.test(p))
    return "técnico-profissional";
  if (/\b(premium|luxo|exclusivo|sofisticado|alto padrão)\b/.test(p)) return "premium";
  if (/\b(descontraído|informal|jovem|divertido|criativo|viral)\b/.test(p))
    return "descontraído";
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
  const { intent, objective, funnelStage, tone, missingFields, multipleOutputs, outputCount } =
    params;

  const intentLabels: Record<Intent, string> = {
    email: "E-mail HTML",
    banner: "Banner 1200×500",
    instagram: "Post Instagram 1080×1080",
    linkedin: "Post LinkedIn",
    landing: "Landing Page",
    datasheet: "Ficha Técnica",
    text: "Texto / Copy",
    image: "Imagem",
  };

  const objectiveLabels: Record<CopyObjective, string> = {
    conversao: "conversão",
    awareness: "awareness de marca",
    lancamento: "lançamento",
    engajamento: "engajamento",
    institucional: "institucional",
  };

  const funnelLabels: Record<FunnelStage, string> = {
    awareness: "topo de funil",
    consideration: "meio de funil",
    conversion: "fundo de funil",
    retention: "retenção",
  };

  const lines: string[] = [];
  lines.push(`**Formato:** ${intentLabels[intent]}`);
  lines.push(`**Objetivo:** ${objectiveLabels[objective]} · **Funil:** ${funnelLabels[funnelStage]}`);
  lines.push(`**Tom:** ${tone}`);

  if (multipleOutputs && outputCount && outputCount > 1) {
    lines.push(`**Estratégia:** Gerando ${outputCount} variações com ângulos distintos.`);
  }

  if (missingFields.length > 0) {
    lines.push(
      `\n⚠️ **Dados parciais:** ${missingFields.join(", ")}. Gerando com as informações disponíveis.`,
    );
  }

  return lines.join("\n");
}

export function detectIntent(prompt: string): Intent {
  const p = prompt.toLowerCase();
  if (/\b(landing\s*page|página de vendas|página de captura|lp\b)\b/.test(p)) return "landing";
  if (/\b(banner|banners)\b/.test(p)) return "banner";
  if (/\b(instagram|insta|post\s+ig|post\s+insta|reel)\b/.test(p)) return "instagram";
  if (/\b(linkedin|linked\s+in|post\s+linkedin)\b/.test(p)) return "linkedin";
  if (/\b(imagem|imagens|foto|ilustra|art\s?work|logo|visual|criativo|gere\s+uma\s+imagem)\b/.test(p))
    return "image";
  if (/\b(e-?mail|email|newsletter|html|marketing direto|disparo)\b/.test(p)) return "email";
  if (/\b(ficha\s+t[eé]cnica|datasheet|especifica|spec|pdf|one[- ]?pager)\b/.test(p))
    return "datasheet";
  return "text";
}

export function detectMultipleOutputs(prompt: string): { multiple: boolean; count: number } {
  const match = prompt.match(
    /\b([2-9]|\d{2})\s+(legendas?|opções?|versões?|variações?|alternativas?|copies?|textos?|headlines?)\b/i,
  );
  if (match) return { multiple: true, count: parseInt(match[1], 10) };
  return { multiple: false, count: 1 };
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

/**
 * callOllama — chama POST /api/chat com streaming SSE.
 * Retorna uma função de abort.
 */
export function callOllama(
  prompt: string,
  intent: Exclude<Intent, "image">,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  reasoning?: { objective: string; funnelStage: string; tone: string },
): () => void {
  const ctrl = new AbortController();

  if (signal) {
    signal.addEventListener("abort", () => ctrl.abort());
  }

  void (async () => {
    let res: Response;

    try {
      res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, intent, reasoning }),
        signal: ctrl.signal,
      });
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      callbacks.onError(String(err));
      return;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      callbacks.onError(`Servidor respondeu ${res.status}: ${txt}`);
      return;
    }

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            callbacks.onDone(full);
            return;
          }

          try {
            const token = JSON.parse(data) as string;
            full += token;
            callbacks.onToken(token);
          } catch {
            // token não parseable — ignorar
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        callbacks.onError(String(err));
      }
    } finally {
      callbacks.onDone(full);
    }
  })();

  return () => ctrl.abort();
}

/** Verifica se um texto contém HTML significativo */
export function looksLikeHtml(text: string): boolean {
  return /<(!DOCTYPE|html|head|body|div|table|style)[\s>]/i.test(text);
}

/**
 * Extrai bloco HTML de uma resposta do LLM.
 * Usa String.fromCharCode(96) em vez de backtick literal
 * para evitar quebra de build em alguns bundlers.
 */
export function extractHtml(text: string): string {
  const BT = String.fromCharCode(96);
  const fenceRegex = new RegExp(
    BT + BT + BT + `(?:html)?\\n?([\\s\\S]*?)` + BT + BT + BT,
    "i",
  );
  const fenced = text.match(fenceRegex);
  if (fenced) return fenced[1].trim();

  const doctype = text.match(/<(!DOCTYPE\s+html|html)[\s\S]*<\/html>/i);
  if (doctype) return doctype[0].trim();

  return text.trim();
}

/** Constrói URL do Pollinations para geração de imagens */
export function buildPollinationsUrl(
  description: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): string {
  const { width = 1024, height = 1024, seed } = opts;
  const encoded = encodeURIComponent(description);
  const seedParam = seed != null ? `&seed=${seed}` : "";
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true${seedParam}`;
}

/** Traduz prompt PT→EN para geração de imagem via Ollama local */
export async function translatePromptForImage(
  ptPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/translate-image-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: ptPrompt }),
      signal,
    });

    if (!res.ok) throw new Error(`translate endpoint: ${res.status}`);

    const data = (await res.json()) as { translated?: string; englishPrompt?: string };
    return data.translated ?? data.englishPrompt ?? ptPrompt;
  } catch {
    return ptPrompt;
  }
}