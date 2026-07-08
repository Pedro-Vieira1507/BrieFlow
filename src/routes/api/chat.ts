/**
 * Server Function — POST /api/chat
 * Arquitetura Multi-Agente v3:
 *   Agente 1 — Copywriter Estratégico (non-streaming)
 *   Agente 2 — Diretor de Arte HTML (streaming)
 */
import { createAPIFileRoute } from "@tanstack/start/api";

const OLLAMA_INTERNAL_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

// ============================================================================
// AGENTE 1: COPYWRITER ESTRATÉGICO — NUNCA PRODUZ HTML
// ============================================================================
const STRATEGIST_SYSTEM: Record<string, string> = {
  banner: `Você é um Copywriter B2B de Elite especializado em conversão.
FRAMEWORK OBRIGATÓRIO: AIDA (Atenção, Interesse, Desejo, Ação).

REGRAS ABSOLUTAS:
- NUNCA produza HTML, CSS, código ou tags de qualquer tipo.
- NUNCA use jargões de IA: "revolucionário", "inovador", "eleve seu nível", "desvende o poder", "paisagem digital", "transforme seu negócio".
- Seja cirúrgico: cada palavra deve ganhar o seu lugar.
- Tom: corporativo realista, focado em dor, métricas e eficiência.

ESTRUTURA DE SAÍDA OBRIGATÓRIA (use exatamente estes marcadores):
[HEADLINE]: (A promessa principal — máx 5 palavras, impacto máximo)
[SUBTITLE]: (O apoio ou oferta específica — máx 10 palavras)
[CTA]: (Ação direta e específica — ex: "Solicitar Diagnóstico Gratuito", nunca "Saiba Mais")`,

  instagram: `Você é um Copywriter B2B de Redes Sociais especializado em Swiss Design visual.
FRAMEWORK OBRIGATÓRIO: PAS (Problema, Agitação, Solução).

REGRAS ABSOLUTAS:
- NUNCA produza HTML, CSS ou código de qualquer tipo.
- Comece o HEADLINE com o gancho direto na dor — sem introduções robóticas.
- Tom: provocativo mas profissional, não excessivamente entusiástico.
- Evite exclamações. Prefira afirmações fortes.

ESTRUTURA DE SAÍDA OBRIGATÓRIA:
[HEADLINE]: (Máx 6 palavras — impacto visual, letras maiúsculas suportado)
[SUBTITLE]: (Máx 10 palavras — o complemento direto)
[CAPTION]: (Texto longo da legenda seguindo o PAS — 3 parágrafos curtos)`,

  email: `Você é um Copywriter B2B de E-mail Marketing de Elite.
FRAMEWORK OBRIGATÓRIO: AIDA (Atenção, Interesse, Desejo, Ação).

REGRAS ABSOLUTAS:
- NUNCA produza HTML, CSS ou código de qualquer tipo.
- Parágrafos curtos: máximo 2 frases. Tom escaneável.
- Fale de negócios, métricas, dor e ROI. Realismo corporativo.
- O CTA deve ser específico: "Ver Estudo de Caso", "Agendar Demonstração" — nunca "Saiba Mais".

ESTRUTURA DE SAÍDA OBRIGATÓRIA:
[SUBJECT]: (Linha de assunto do e-mail — máx 50 caracteres, gera curiosidade)
[HEADLINE]: (Título interno do e-mail — impactante, focado na dor)
[BODY]: (Corpo do e-mail seguindo AIDA — parágrafos curtos, escaneável)
[CTA]: (Chamada para ação — específica e direta)`,
};

// ============================================================================
// AGENTE 2: DIRETOR DE ARTE HTML — TEMPLATES ESTRITOS
// ============================================================================

const BANNER_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { width: 1200px; height: 500px; overflow: hidden; }
  .banner {
    width: 1200px; height: 500px;
    display: flex; overflow: hidden;
    background: [PRIMARY_COLOR];
    color: #fff; position: relative;
  }
  .content {
    flex: 1; padding: 60px 80px;
    display: flex; flex-direction: column;
    justify-content: center; z-index: 3;
    background: [PRIMARY_COLOR];
  }
  .title {
    font-size: 56px; font-weight: 900;
    line-height: 1.05; letter-spacing: -1.5px;
    margin-bottom: 20px; color: #fff;
  }
  .subtitle {
    font-size: 22px; font-weight: 600;
    color: rgba(255,255,255,0.85); margin-bottom: 35px;
  }
  .cta {
    display: inline-flex; background: #fff;
    color: [PRIMARY_COLOR]; padding: 18px 42px;
    border-radius: 8px; font-weight: 800;
    font-size: 16px; text-decoration: none;
    width: fit-content; letter-spacing: 0.3px;
  }
  .image-side {
    width: 550px; position: relative;
    display: flex; align-items: center;
    justify-content: center; padding: 30px;
    overflow: hidden;
  }
  .image-side img {
    width: 100%; height: 100%;
    object-fit: contain;
    filter: drop-shadow(-10px 20px 30px rgba(0,0,0,0.45));
    transform: scale(1.08);
    position: relative; z-index: 2;
  }
  .gradient-overlay {
    position: absolute; top: 0; bottom: 0; left: 0;
    width: 220px;
    background: linear-gradient(to right, [PRIMARY_COLOR] 0%, transparent 100%);
    z-index: 3;
  }
</style>
</head>
<body>
  <div class="banner">
    <div class="content">
      <h1 class="title">HEADLINE_AQUI</h1>
      <p class="subtitle">SUBTITLE_AQUI</p>
      <a href="#" class="cta">CTA_AQUI</a>
    </div>
    <div class="image-side">
      <div class="gradient-overlay"></div>
      <img src="https://image.pollinations.ai/prompt/PRODUCT_DESCRIPTION_EN?width=600&height=500&nologo=true&seed=SEED" alt="product" />
    </div>
  </div>
</body>
</html>`;

const INSTAGRAM_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { width: 1080px; height: 1080px; overflow: hidden; }
  .post {
    width: 1080px; height: 1080px;
    position: relative; overflow: hidden;
    display: flex; align-items: center;
    justify-content: center;
  }
  .bg-image {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover; z-index: 1;
  }
  .color-overlay {
    position: absolute; inset: 0;
    background: [PRIMARY_COLOR];
    opacity: 0.82; z-index: 2;
  }
  .content {
    position: relative; z-index: 3;
    text-align: center; color: #fff;
    padding: 80px;
    display: flex; flex-direction: column;
    align-items: center; gap: 32px;
  }
  .headline {
    font-size: 88px; font-weight: 900;
    line-height: 0.95; letter-spacing: -3px;
    text-transform: uppercase;
    text-wrap: balance;
  }
  .subtitle {
    font-size: 32px; font-weight: 400;
    opacity: 0.88; letter-spacing: 0.5px;
    text-wrap: balance;
  }
  .divider {
    width: 80px; height: 4px;
    background: rgba(255,255,255,0.6);
    border-radius: 2px;
  }
</style>
</head>
<body>
  <div class="post">
    <img class="bg-image" src="https://image.pollinations.ai/prompt/PRODUCT_DESCRIPTION_EN?width=1080&height=1080&nologo=true&seed=SEED" alt="background" />
    <div class="color-overlay"></div>
    <div class="content">
      <h1 class="headline">HEADLINE_AQUI</h1>
      <div class="divider"></div>
      <p class="subtitle">SUBTITLE_AQUI</p>
    </div>
  </div>
</body>
</html>`;

const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>EMAIL_SUBJECT_AQUI</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f4f4f5">
    <tr><td align="center" style="padding:40px 10px;">
      <table width="600" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff"
        style="border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;">

        <!-- HEADER -->
        <tr>
          <td bgcolor="[PRIMARY_COLOR]" style="padding:36px 48px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;
                    text-transform:uppercase;letter-spacing:2px;">NOME_EMPRESA_AQUI</p>
                  <h1 style="margin:12px 0 0;color:#ffffff;font-size:28px;
                    font-weight:700;line-height:1.25;">HEADLINE_AQUI</h1>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:40px 48px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#374151;font-size:16px;line-height:1.7;
                  font-family:Arial,Helvetica,sans-serif;">
                  BODY_AQUI
                </td>
              </tr>
              <tr><td style="padding-top:32px;"></td></tr>
              <!-- CTA ROW -->
              <tr>
                <td align="center">
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td bgcolor="[PRIMARY_COLOR]" style="border-radius:6px;">
                        <a href="#"
                          style="display:inline-block;padding:16px 40px;color:#ffffff;
                            font-size:16px;font-weight:700;text-decoration:none;
                            letter-spacing:0.3px;">CTA_AQUI</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td bgcolor="#f9fafb" style="padding:24px 48px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              Recebeu este e-mail pois está na nossa lista de contactos B2B.
              <a href="#" style="color:#9ca3af;">Cancelar subscrição</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const TEMPLATES: Record<string, string> = {
  banner: BANNER_TEMPLATE,
  instagram: INSTAGRAM_TEMPLATE,
  email: EMAIL_TEMPLATE,
};

// Negative prompts obrigatórios para todas as imagens do Pollinations
const POLLINATIONS_NEGATIVE_PROMPTS =
  "professional macro product photography, isolated on pure white background, no humans, nobody, no people, empty scene, no faces, no hands, no body parts";

function buildDesignerSystemPrompt(intent: string, strategicCopy: string): string {
  const template = TEMPLATES[intent] ?? TEMPLATES.banner;

  return `Você é o Diretor de Arte HTML — um coder de precisão de nível agência.

O Copywriter Estratégico gerou o seguinte copy perfeito. Injete-o EXATAMENTE no template.

=== COPY GERADO ===
${strategicCopy}
===================

REGRAS ABSOLUTAS DE IMPLEMENTAÇÃO:
1. Use o template HTML exato fornecido abaixo — NÃO altere a estrutura CSS (flexbox, z-index, gradients).
2. Substitua todos os placeholders (HEADLINE_AQUI, SUBTITLE_AQUI, etc.) pelo copy acima.
3. Para [PRIMARY_COLOR]: derive uma cor sólida da marca a partir do briefing do utilizador (ex: #1a56db para azul corporativo). Se não houver indicação, use #1a1a2e.
4. Para a URL da imagem Pollinations: a descrição DEVE ser em inglês e DEVE incluir os negative prompts obrigatórios: "${POLLINATIONS_NEGATIVE_PROMPTS}". Descreva APENAS objetos/produtos, NUNCA humanos. Substitua SEED por um número aleatório entre 1000 e 9999.
5. Retorne APENAS o HTML completo e funcional — sem explicações, sem markdown, sem blocos de código.

=== TEMPLATE HTML OBRIGATÓRIO ===
${template}`;
}

// ============================================================================
// AGENTE 1: CHAMADA NON-STREAMING
// ============================================================================
async function runCopywriterAgent(
  prompt: string,
  intent: string,
  model: string,
  contextRules: string,
): Promise<string> {
  const system = (STRATEGIST_SYSTEM[intent] ?? STRATEGIST_SYSTEM.banner) + contextRules;
  const res = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, system, prompt, stream: false }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Agente 1 falhou (${res.status}): ${txt}`);
  }
  const data = await res.json();
  return (data.response as string) ?? "";
}

// ============================================================================
// ENDPOINT PRINCIPAL
// ============================================================================
export const APIRoute = createAPIFileRoute("/api/chat")({
  POST: async ({ request }) => {
    let body: { prompt: string; intent: string; model?: string; reasoning?: Record<string, unknown> };

    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { prompt, intent = "text", model = DEFAULT_MODEL, reasoning } = body;
    if (!prompt)
      return new Response(JSON.stringify({ error: "Falta prompt" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    const isVisualIntent = ["banner", "email", "instagram"].includes(intent);

    // Contexto estratégico injetado pelo frontend
    const contextRules = reasoning
      ? `\n\n[DIRETRIZ ESTRATÉGICA]\nObjetivo: ${reasoning.objective}\nFunil: ${reasoning.funnelStage}\nTom: ${reasoning.tone}`
      : "";

    let finalSystemPrompt = "";
    let finalUserPrompt = prompt;

    // =========================================================================
    // PIPELINE MULTI-AGENTE (apenas para intenções visuais)
    // =========================================================================
    if (isVisualIntent) {
      let strategicCopy: string;
      try {
        strategicCopy = await runCopywriterAgent(prompt, intent, model, contextRules);
      } catch (err) {
        return new Response(
          JSON.stringify({ error: `Agente 1 (Copywriter) falhou: ${err}` }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }

      finalSystemPrompt = buildDesignerSystemPrompt(intent, strategicCopy);
      finalUserPrompt = `Renderize o HTML com base no copy acima. Diretrizes de marca do utilizador: ${prompt}`;
    } else {
      // Agente único para texto / datasheet
      const singleAgentSystem: Record<string, string> = {
        text: `Você é um Copywriter Sénior B2B. Escreva texto direto, sem jargões de IA. Use Markdown.${contextRules}`,
        datasheet: `Você é um Engenheiro de Produto. Escreva conteúdo técnico e preciso em Markdown.${contextRules}`,
      };
      finalSystemPrompt = singleAgentSystem[intent] ?? singleAgentSystem.text;
    }

    // =========================================================================
    // AGENTE 2 — STREAMING (ou agente de texto em streaming)
    // =========================================================================
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
      return new Response(JSON.stringify({ error: `Ollama stream error: ${err}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!ollamaRes.ok) {
      const txt = await ollamaRes.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Ollama respondeu ${ollamaRes.status}: ${txt}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    // Transforma o stream do Ollama em SSE
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
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(json.response)}\n\n`),
                );
              }
              if (json.done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
            } catch {
              // linha JSON inválida — ignorar
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`),
          );
          controller.close();
        }
      },
      cancel() {
        ollamaReader.cancel();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
});
