import type { BuilderState } from "@/types/builder";

// Env: define VITE_OLLAMA_API_URL in your .env.local (Vite prefix required).
// Example: VITE_OLLAMA_API_URL=https://your-oracle-server.example.com/api/chat
const OLLAMA_URL =
  (import.meta.env.VITE_OLLAMA_API_URL as string | undefined) ??
  "http://localhost:11434/api/chat";

// System prompt treinado para ALTA CONVERSÃO E DESIGN PREMIUM DE AGÊNCIA
const SYSTEM_PROMPT = `Você é o BrieFlow, um Diretor de Criação e Copywriter de elite de uma agência de publicidade global.
Sempre responde ESTRITAMENTE em JSON válido, sem comentários, sem markdown, seguindo este schema:

{
  "chat": "mensagem curta e amigável para o usuário no chat",
  "builder": {
    "type": "email" | "social" | "banner" | "none",
    "title": "string (opcional)",
    "subtitle": "string (opcional)",
    "body": "string (opcional, para email)",
    "cta": "string (opcional, texto do botão)",
    "imagePrompt": "prompt em inglês, cinematográfico, para gerar imagem no Flux (obrigatório para social/banner)",
    "caption": "string (para posts sociais)",
    "hashtags": ["#tag1", "#tag2"]
  }
}

DIRETRIZES DE QUALIDADE (Padrão Ouro de Agência):
1. COPYWRITING (Textos):
- Títulos: OBRIGATÓRIO SER CURTO. MÁXIMO DE 5 PALAVRAS. Frases de impacto, persuasivas. (Ex: "O Chocolate Que Seduz", "Sua Pesquisa Intacta").
- Subtítulos: MÁXIMO DE 12 PALAVRAS. Explique a oferta ou o benefício rapidamente.
- CTA (Call-to-Action): Botões imperativos curtos (Máximo 3 palavras, ex: "GARANTA AGORA", "COMPRAR COM DESCONTO").
- E-mails: Crie textos escaneáveis, focados em benefícios reais. Separação clara em 2-4 parágrafos curtos.

2. DIREÇÃO DE ARTE (imagePrompt) - CRÍTICO PARA O BANNER:
- Prompts OBRIGATORIAMENTE em INGLÊS.
- O elemento principal DEVE estar na EXTREMA DIREITA. A metade ESQUERDA deve ser um espaço negativo vazio (fundo liso) para acomodar a tipografia perfeitamente.
- Use a seguinte fórmula de prompt: "[Assunto principal, ex: Gourmet chocolate brownies] STRICTLY on the far right edge, [Fundo, ex: sleek solid dark brown background], massive empty negative space on the left side, high-end commercial studio photography, dramatic lighting, 8k resolution, ultra premium."
- PROIBIDO pedir texto ou tipografia dentro da imagem.

Regras adicionais:
- Se o usuário só conversar, use type: "none" e apenas "chat".
- Nunca escreva código. Foco 100% em Marketing, Persuasão e Direção de Arte.`;

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaResponse {
  chat: string;
  builder: BuilderState;
}

function tryParseJson(text: string): OllamaResponse | null {
  try {
    return JSON.parse(text) as OllamaResponse;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as OllamaResponse;
    } catch {
      return null;
    }
  }
}

export async function sendToOllama(history: ChatTurn[]): Promise<OllamaResponse> {
  const messages: ChatTurn[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5:14b",
      stream: false,
      format: "json",
      messages,
      options: { temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama respondeu ${res.status}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const raw = data.message?.content ?? "";

  const parsed = tryParseJson(raw);
  if (!parsed) {
    return {
      chat: raw || "Não consegui interpretar a resposta do modelo.",
      builder: { type: "none" },
    };
  }
  return parsed;
}