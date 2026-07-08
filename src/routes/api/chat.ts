/**
 * Server Function — POST /api/chat
 * Arquitetura Multi-Agente: Copywriter Estratégico -> Diretor de Arte HTML
 */
import { createAPIFileRoute } from "@tanstack/start/api";

const OLLAMA_INTERNAL_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b"; // Use o modelo otimizado

// ============================================================================
// AGENTE 1: COPYWRITER ESTRATÉGICO
// ============================================================================
const STRATEGIST_PROMPTS: Record<string, string> = {
  email: `Você é um Copywriter B2B de Elite. Escreva APENAS o texto do e-mail.
FRAMEWORK OBRIGATÓRIO: AIDA (Atenção, Interesse, Desejo, Ação).
REGRAS DE TOM (NEGATIVE PROMPT): 
- NUNCA use jargões de IA como: "revolucionário", "inovador", "eleve o seu nível", "desvende o poder", "paisagem digital".
- Escreva parágrafos curtos (máximo 2 frases). Escaneável.
- Fale de negócios, métricas, dor e eficiência. Tom corporativo realista.
ESTRUTURA DE SAÍDA:
[HEADLINE]: (Impactante e focada na dor)
[CORPO]: (O texto do email seguindo o AIDA)
[BOTAO CTA]: (Chamada para ação clara, ex: 'Ver Estudo de Caso', não 'Saiba Mais')`,

  instagram: `Você é um Copywriter B2B de Redes Sociais. Escreva APENAS o texto do post.
FRAMEWORK OBRIGATÓRIO: PAS (Problema, Agitação, Solução).
REGRAS DE TOM:
- Sem introduções robóticas. Comece com um 'hook' direto na ferida do cliente.
- Evite exclamações excessivas.
ESTRUTURA DE SAÍDA:
[HEADLINE DO DESIGN]: (Máx 6 palavras, impactante)
[SUBTITULO DO DESIGN]: (Máx 10 palavras)
[TEXTO DA LEGENDA]: (O texto longo seguindo o PAS)`,

  banner: `Você é um Copywriter Especialista em Conversão.
Escreva APENAS os textos para um Banner B2B. Seja cirúrgico.
ESTRUTURA DE SAÍDA:
[HEADLINE]: (A promessa principal, máx 5 palavras. Ex: 'Precisão que Impulsiona Lucro.')
[SUBTITULO]: (O apoio ou oferta, máx 10 palavras)
[BOTAO CTA]: (Ação direta, ex: 'Solicitar Orçamento')`,
  
  text: `Você é um Copywriter Sénior B2B. Escreva um texto direto, sem jargões clichés de marketing. Use Markdown.`,
  datasheet: `Você é um Engenheiro de Produto. Escreva conteúdo altamente técnico e preciso em Markdown.`
};

// ============================================================================
// AGENTE 2: DIRETOR DE ARTE / CODER
// ============================================================================
const DESIGNER_PROMPTS: Record<string, string> = {
  banner: `Você é o Diretor de Arte HTML. 
Foi-lhe entregue o seguinte Copy Perfeito:
"{COPY_RESULT}"

A SUA TAREFA:
Injete este copy OBRIGATORIAMENTE no template HTML exato abaixo.
NÃO crie ou altere CSS estrutural. Mantenha os z-index, gradients e flexbox.
Na tag <img> do Pollinations, crie a descrição fotográfica OBRIGANDO a não ter humanos: "macro product photography, isolated on pure white background, no humans, nobody, empty scene".

<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  .banner { width: 1200px; height: 500px; display: flex; overflow: hidden; background: linear-gradient(135deg, [COR_PRIMARIA] 0%, #111 150%); color: #fff; position: relative; }
  .content { flex: 1; padding: 60px 80px; display: flex; flex-direction: column; justify-content: center; z-index: 3; }
  .title { font-size: 56px; font-weight: 900; line-height: 1.05; letter-spacing: -1.5px; margin-bottom: 20px; }
  .subtitle { font-size: 24px; font-weight: 600; color: [COR_DE_DESTAQUE_OU_SECUNDARIA]; margin-bottom: 35px; }
  .cta { display: inline-flex; background: [COR_DE_DESTAQUE_OU_SECUNDARIA]; color: #000; padding: 18px 42px; border-radius: 8px; font-weight: 800; font-size: 16px; text-decoration: none; width: fit-content;}
  .image-wrapper { width: 550px; position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; padding: 30px;}
  .image-wrapper img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(-10px 20px 30px rgba(0,0,0,0.5)); transform: scale(1.1); }
  .gradient-overlay { position: absolute; top: 0; bottom: 0; left: 0; width: 200px; background: linear-gradient(to right, [COR_PRIMARIA] 0%, transparent 100%); z-index: 3; }
</style>
</head>
<body>
  <div class="banner">
    <div class="content">
      <h1 class="title">[INSERIR HEADLINE AQUI]</h1>
      <h2 class="subtitle">[INSERIR SUBTITULO AQUI]</h2>
      <a href="#" class="cta">[INSERIR BOTAO AQUI]</a>
    </div>
    <div class="image-wrapper">
      <div class="gradient-overlay"></div>
      <img src="https://image.pollinations.ai/prompt/[DESCRICAO_INGLES_SEM_HUMANOS]?width=600&height=500&nologo=true">
    </div>
  </div>
</body>
</html>`,

  email: `Você é o Designer de E-mail Marketing.
Injete o seguinte Copy no template de Tabelas seguro para Outlook:
"{COPY_RESULT}"

<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, sans-serif;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding: 40px 10px;">
        <table width="600" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
          </table>
    </td></tr>
  </table>
</body>
</html>`
};

// ============================================================================
// FUNÇÃO AUXILIAR: CHAMADA NON-STREAMING (AGENTE 1)
// ============================================================================
async function generateStrategicCopy(prompt: string, system: string, model: string): Promise<string> {
  const res = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, system, prompt, stream: false })
  });
  if (!res.ok) throw new Error("Falha no Agente 1 (Copywriter)");
  const data = await res.json();
  return data.response;
}

// ============================================================================
// ENDPOINT PRINCIPAL
// ============================================================================
export const APIRoute = createAPIFileRoute("/api/chat")({
  POST: async ({ request }) => {
    let body: { prompt: string; intent: string; model?: string; reasoning?: any };

    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON inválido" }), { status: 400 });
    }

    const { prompt, intent = "text", model = DEFAULT_MODEL, reasoning } = body;
    if (!prompt) return new Response(JSON.stringify({ error: "Falta prompt" }), { status: 400 });

    const requiresMultiAgent = ["banner", "email", "instagram"].includes(intent);
    
    // Raciocínio Injetado (Contexto Global)
    const contextRules = reasoning 
        ? `\n\n[DIRETRIZ ESTRATÉGICA]\nObjetivo: ${reasoning.objective}\nFunil: ${reasoning.funnelStage}\nTom: ${reasoning.tone}`
        : "";

    let finalSystemPrompt = "";
    let finalUserPrompt = prompt;

    // PIPELINE MULTI-AGENTE
    if (requiresMultiAgent) {
      const copywriterSystem = (STRATEGIST_PROMPTS[intent] || STRATEGIST_PROMPTS.text) + contextRules;
      
      try {
        // Passo 1: Gera o Copy Estratégico (Non-streaming)
        const strategicCopy = await generateStrategicCopy(prompt, copywriterSystem, model);
        
        // Passo 2: Prepara o Prompt do Designer
        const designerTemplate = DESIGNER_PROMPTS[intent] || DESIGNER_PROMPTS.banner;
        finalSystemPrompt = designerTemplate.replace("{COPY_RESULT}", strategicCopy);
        
        // O utilizador já não dita a cópia, apenas as cores/marca, o Designer foca-se no HTML
        finalUserPrompt = `Renderize o HTML baseado no copy gerado. Aplique estas diretrizes da marca (cores/design) pedidas originalmente: ${prompt}`;

      } catch (err) {
        return new Response(JSON.stringify({ error: "Erro na pipeline Multi-Agente" }), { status: 502 });
      }
    } else {
      // Single Agent para Texto Simples/Datasheet
      finalSystemPrompt = (STRATEGIST_PROMPTS[intent] ?? STRATEGIST_PROMPTS.text) + contextRules;
    }

    // Passo Final: Chama o Ollama em modo Streaming (Agente 2 ou Text Agent)
    let ollamaRes: Response;
    try {
      ollamaRes = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system: finalSystemPrompt,
          prompt: finalUserPrompt.trim(),
          stream: true,
        }),
        signal: request.signal,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `Ollama error: ${err}` }), { status: 502 });
    }

    // Lógica de Streaming existente mantida para o frontend
    const encoder = new TextEncoder();
    const ollamaReader = ollamaRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const readable = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await ollamaReader.read();
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.response) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(json.response)}\n\n`));
              }
              if (json.done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
            } catch {}
          }
        } catch (err) {
          controller.close();
        }
      },
      cancel() { ollamaReader.cancel(); },
    });

    return new Response(readable, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  },
});