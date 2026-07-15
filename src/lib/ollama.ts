import type { BuilderState, BrandContext, CampaignAsset } from "@/types/builder";

const OLLAMA_URL =
  (import.meta.env.VITE_OLLAMA_API_URL as string | undefined) ??
  "http://localhost:11434/api/chat";

// ============================================================================
// AGENT PROMPTS (A Inteligência Dividida)
// ============================================================================

const DISCOVERY_AGENT_PROMPT = `Você é o BrieFlow Discovery Agent. Um estrategista sênior de marca.
Sua missão NÃO É GERAR AS PEÇAS DE MARKETING AINDA. Sua missão é investigar o pedido do usuário, deduzir o contexto da marca e propor um plano.

SEMPRE responda ESTRITAMENTE em JSON válido seguindo a risca o formato abaixo.
ATENÇÃO: TODOS os valores de "discoveryPlan" DEVEM SER STRINGS PURAS. NUNCA envie objetos aninhados lá dentro.

{
  "chat": "Fale como um humano especialista. Diga: 'Analisei sua solicitação. Notei que seu foco é X. Para isso, estruturei um plano tático. Só preciso confirmar: Y. Podemos seguir?'",
  "builder": {
    "type": "discovery_plan",
    "discoveryPlan": {
      "detectedContext": "STRING APENAS. Resuma em 1 parágrafo o que você deduziu.",
      "missingInfo": "STRING APENAS. Qual dado está faltando para garantir conversão?",
      "proposedStrategy": "STRING APENAS. Liste em texto puro (use hífens se quiser) os canais recomendados e a mensagem central. DO NOT USE JSON OBJECTS HERE."
    }
  }
}`;

const EXECUTION_AGENT_PROMPT = (ctx: BrandContext, isCampaign: boolean) => `Você é o BrieFlow Execution Agent. Um Copywriter Sênior de Elite.
Sua missão é GERAR OS ATIVOS DEFINITIVOS baseados na estratégia pré-aprovada.

=== CONTEXTO DA MARCA ===
- Público-Alvo: ${ctx.persona || "Público Executivo"}
- Tom de Voz: ${ctx.tone || "Elegante, direto, sofisticado"}
- Framework Base: ${ctx.framework || "Livre"}

SEMPRE responda ESTRITAMENTE em JSON válido. NENHUM markdown ao redor. NENHUM texto antes ou depois.
{
  "chat": "Os materiais da sua campanha foram gerados com sucesso e estão prontos no Workspace ao lado.",
  "builder": {
    "type": "${isCampaign ? "campaign" : "email"}",
    "title": "...",
    "subtitle": "...",
    "body": "...",
    "cta": "...",
    "imagePrompt": "ENGLISH PROMPT HERE FOR FAR RIGHT COMPOSITION",
    "campaignAssets": [
       // SOMENTE PREENCHA SE TYPE FOR "campaign"
       { "id": "email-1", "type": "email", "status": "draft", "content": { "type": "email", "title": "...", "subtitle": "...", "body": "...", "cta": "..." } },
       { "id": "banner-1", "type": "banner", "status": "draft", "content": { "type": "banner", "title": "...", "subtitle": "...", "cta": "...", "imagePrompt": "ENGLISH PROMPT HERE" } }
    ]
  },
  "scores": { "persuasion": 95, "clarity": 98, "seo": 88 }
}

REGRAS:
1. COPY: Textos curtos, sem clichês de IA (ex: "Revolucione").
2. ARTE (BANNER): O objeto DEVE estar na EXTREMA DIREITA. Esquerda deve ser espaço negativo massivo em inglês.`;

// ============================================================================

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
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

function tryParseJson(text: string): OllamaResponse | null {
  try { return JSON.parse(text) as OllamaResponse; } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]) as OllamaResponse; } catch { return null; }
  }
}

export async function sendToOllama(history: ChatTurn[], brandContext: BrandContext): Promise<OllamaResponse> {
  const lastUserMsg = history[history.length -1]?.content.toLowerCase() || "";
  
  const wantsExecution = lastUserMsg.includes("pode seguir") || lastUserMsg.includes("aprovado") || lastUserMsg.includes("gere") || lastUserMsg.includes("crie");
  const isCampaign = lastUserMsg.includes("campanha") || lastUserMsg.includes("ecossistema");

  const systemPrompt = wantsExecution ? EXECUTION_AGENT_PROMPT(brandContext, isCampaign) : DISCOVERY_AGENT_PROMPT;

  const messages: ChatTurn[] = [{ role: "system", content: systemPrompt }, ...history];

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5:14b",
      stream: false,
      format: "json", 
      messages,
      options: { 
        temperature: wantsExecution ? 0.6 : 0.8,
        top_p: 0.9
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama respondeu com status de erro: ${res.status}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const raw = data.message?.content ?? "";
  
  const parsed = tryParseJson(raw);
  
  if (!parsed) {
    console.error("Falha ao fazer parse da resposta da IA. Resposta bruta:", raw);
    return { 
      chat: "Tive um problema ao estruturar os dados. Você pode repetir a solicitação de outra forma?", 
      builder: { type: "none" } 
    };
  }
  
  return parsed;
}