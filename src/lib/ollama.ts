// lib/ollama.ts
import type { BuilderState, BrandContext, CampaignAsset } from "@/types/builder";

const DISCOVERY_AGENT_PROMPT = (currentPlan: any) => `Você é o Agente BrieFlow. Um Consultor Virtual B2B Especialista em Go-to-Market.
Sua missão NÃO É GERAR CAMPANHAS. Você deve apenas conduzir uma qualificação B2B via chat.

=== 🚨 REGRAS DE PERFORMANCE E TOM ===
1. TOM B2B: Altamente profissional, direto e consultivo. NENHUM EMOJI.
2. UMA PERGUNTA POR VEZ: Nunca liste múltiplas perguntas. Faça a conversa fluir.
3. VALIDAÇÃO: Reconheça a resposta anterior com uma frase curta antes de seguir para a próxima pergunta.

=== 🧠 SUA MEMÓRIA (O PLANO ATÉ AGORA) ===
${currentPlan ? JSON.stringify(currentPlan) : "Sem dados. Inicie pelo Passo 1."}

=== 📍 ROTEIRO DE QUALIFICAÇÃO (Siga a ordem) ===
Passo 1. Qual o site corporativo ou foco do produto?
Passo 2. Modelo atual de vendas: Inbound (site) ou Outbound (prospecção ativa)?
Passo 3. Estrutura do time: Quantos pré-vendas (SDRs) e vendedores possuem?
Passo 4. Volume e Ferramentas: Quantos leads/mês e usam CRM/ERP?
Passo 5. FECHAMENTO: Resuma tudo o que entendeu e pergunte: "Faz sentido aprovarmos esse escopo para eu gerar as peças da campanha agora?"

SEMPRE responda ESTRITAMENTE em JSON. NENHUM texto fora do JSON.

{
  "chat": "Sua resposta conversacional B2B (a validação e a próxima pergunta).",
  "builder": {
    "type": "discovery_plan",
    "discoveryPlan": {
      "detectedContext": "Atualize com os dados validados.",
      "missingInfo": "Se no passo 1 a 4, faça a anotação do que falta. Se no Passo 5, escreva 'Nenhuma'.",
      "proposedStrategy": "Se no passo 1 a 4, escreva 'Aguardando dados...'. Se chegou no Passo 5, escreva 'Ecossistema Premium: 1 Banner, 1 Email, 1 Post'."
    }
  }
}`;

const EXECUTION_AGENT_PROMPT = (ctx: BrandContext, plan: any, targetAsset: string) => `Você é o BrieFlow Execution Agent, Diretor de Criação B2B Sênior.
Sua missão é gerar APENAS A PEÇA SOLICITADA ABAIXO.

=== PLANO ESTRATÉGICO APROVADO ===
${plan ? JSON.stringify(plan) : "Baseie-se no histórico."}

=== TAREFA ATUAL ===
GERAR APENAS: ${targetAsset.toUpperCase()}

=== REGRAS DO ASSET ===
1. Frases curtas, foco na dor B2B. Zero clichês publicitários.
${targetAsset === 'banner' ? "2. BANNERS: Título MÁX 5 PALAVRAS. imagePrompt: 100% INGLÊS. FÓRMULA: '[OBJECT] strictly placed on the far right edge, [BACKGROUND], massive empty negative space on the left side, 8k'." : ""}
${targetAsset === 'email' ? "2. E-MAILS: 'preheader' instigante. 'emailHeroImagePrompt' 100% INGLÊS detalhando fotografia de produto cinemática." : ""}
${targetAsset === 'social' ? "2. SOCIAL: Legenda engajadora, array com 3 hashtags. 'imagePrompt' 100% INGLÊS." : ""}

=== 🚨 IMPORTANTE ===
Mantenha seu raciocínio interno (<think>) extremamente curto (máx 2 linhas) para poupar processamento da CPU.

=== RETORNO ESPERADO (JSON ESTRITO) ===
{
  "chat": "Peça gerada com sucesso! ✨",
  "builder": {
    "type": "campaign",
    "campaignAssets": [
       ${targetAsset === 'banner' ? `{ "id": "banner-1", "type": "banner", "status": "draft", "content": { "type": "banner", "title": "...", "subtitle": "...", "cta": "...", "imagePrompt": "..." } }` : ''}
       ${targetAsset === 'email' ? `{ "id": "email-1", "type": "email", "status": "draft", "content": { "type": "email", "preheader": "...", "emailHeroImagePrompt": "...", "title": "...", "subtitle": "...", "body": "...", "cta": "...", "footerText": "..." } }` : ''}
       ${targetAsset === 'social' ? `{ "id": "social-1", "type": "social", "status": "draft", "content": { "type": "social", "caption": "...", "hashtags": ["..."], "imagePrompt": "..." } }` : ''}
    ]
  },
  "scores": { "persuasion": 98, "clarity": 95, "seo": 90 }
}`;

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaResponse {
  chat: string;
  builder: BuilderState;
  scores?: { persuasion: number; clarity: number; seo: number };
}

// 🛡️ Extrator Blindado
function tryParseJson(text: string): OllamaResponse | null {
  let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleanText = cleanText.replace(/```json/gi, '').replace(/```/g, '').trim();

  try { return JSON.parse(cleanText) as OllamaResponse; } 
  catch (e) {
    const match = cleanText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]) as OllamaResponse; } catch { return null; }
  }
}

export async function sendToOllama(
  history: ChatTurn[], 
  brandContext: BrandContext, 
  currentPlan?: any,
  onStream?: (partialChat: string) => void,
  targetAsset?: string
): Promise<OllamaResponse> {
  
  // 💡 Avaliação blindada da URL dentro da função para evitar o erro OLLAMA_URL is not defined
  let apiUrl = "http://localhost:11434/api/chat";
  if (typeof window !== 'undefined') {
    const envUrl = import.meta.env.VITE_OLLAMA_API_URL as string | undefined;
    if (envUrl) {
      apiUrl = `${envUrl.replace('/v1/chat/completions', '').replace('/api/chat', '')}/api/chat`;
    } else {
      apiUrl = `http://${window.location.hostname}:11434/api/chat`;
    }
  }

  const wantsExecution = !!targetAsset;
  const isCampaign = wantsExecution; 

  const systemPrompt = wantsExecution ? EXECUTION_AGENT_PROMPT(brandContext, currentPlan, targetAsset) : DISCOVERY_AGENT_PROMPT(currentPlan);
  const recentHistory = history.slice(-6); 
  const messages: ChatTurn[] = [{ role: "system", content: systemPrompt }, ...recentHistory];

  const modelToUse = wantsExecution ? "deepseek-r1:14b-qwen-distill-q8_0" : "qwen2.5:7b";
  
  const controller = new AbortController();
  // 💡 GERAÇÃO CPU BLINDADA: Chat veloz (120s max), Execução (900.000ms = 15 Minutos max por peça!)
  const timeoutId = setTimeout(() => controller.abort(), wantsExecution ? 900000 : 120000); 

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelToUse, 
        messages,
        stream: true, 
        options: {
          temperature: wantsExecution ? 0.3 : 0.6,
          top_p: 0.9,
          num_predict: wantsExecution ? 4096 : 800
        }
      }),
      signal: controller.signal
    });

    if (!res.body) throw new Error("Streaming não suportado.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let rawJson = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            rawJson += parsed.message.content;
            if (onStream && !wantsExecution) {
              const chatRegex = /"chat"\s*:\s*"([\s\S]*?)(?:"\s*,|"\s*\}|$)/;
              const chatMatch = rawJson.match(chatRegex);
              if (chatMatch && chatMatch[1]) {
                const partialChat = chatMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                onStream(partialChat);
              }
            }
          }
        } catch (e) {}
      }
    }

    clearTimeout(timeoutId);
    const parsed = tryParseJson(rawJson);
    
    if (!parsed) {
      return { 
        chat: "Tivemos uma pequena oscilação de dados. Poderia tentar novamente?", 
        builder: currentPlan ? { type: "discovery_plan", discoveryPlan: currentPlan } : { type: "none" }
      };
    }
    
    return parsed;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(wantsExecution ? "A IA demorou muito para criar esta peça. Tente novamente." : "O servidor não respondeu a tempo.");
    }
    throw new Error(`Falha de rede: ${err.message}`);
  }
}