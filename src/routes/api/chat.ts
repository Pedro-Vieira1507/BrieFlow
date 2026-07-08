/**
 * Server Function — POST /api/chat
 *
 * Usa o campo `system` da API do Ollama (separado do `prompt`) para que
 * as regras do sistema tenham prioridade máxima sobre o pedido do usuário.
 */
import { createAPIFileRoute } from "@tanstack/start/api";

const OLLAMA_INTERNAL_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

const SYSTEM_PROMPTS: Record<string, string> = {
  // ── BANNER (PADRÃO AGÊNCIA DE PUBLICIDADE) ──────────────────────────────────
  banner: `Você é um Diretor de Arte Sênior de uma agência B2B. Gere o código HTML/CSS de um banner publicitário de ALTÍSSIMA QUALIDADE (1200x500px).

REGRAS DE IMAGEM (MUITO IMPORTANTE):
Para evitar que a IA desenhe pessoas quando o cliente pede um equipamento, sua descrição da imagem Pollinations em inglês DEVE OBRIGATORIAMENTE conter as palavras:
"professional macro product photography, isolated on pure white background, highly detailed, no humans, nobody, no people, empty scene".

PROCESSO OBRIGATÓRIO:
Gere OBRIGATORIAMENTE o HTML exato abaixo, substituindo apenas os colchetes pelo conteúdo real. NÃO INVENTE CSS.

<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  .banner { width: 1200px; height: 500px; display: flex; overflow: hidden; background: linear-gradient(135deg, [COR_PRIMARIA] 0%, #111 150%); color: #fff; position: relative; }
  .bg-pattern { position: absolute; inset: 0; opacity: 0.05; background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 24px 24px; z-index: 1; pointer-events: none;}
  .content { flex: 1; padding: 60px 80px; display: flex; flex-direction: column; justify-content: center; z-index: 3; }
  .badge { display: inline-block; padding: 6px 14px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 100px; text-transform: uppercase; font-size: 12px; font-weight: 800; letter-spacing: 2px; margin-bottom: 24px; width: fit-content; backdrop-filter: blur(4px); }
  .title { font-size: 52px; font-weight: 900; line-height: 1.1; letter-spacing: -1.5px; margin-bottom: 16px; text-wrap: balance; text-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .subtitle { font-size: 22px; font-weight: 600; color: [COR_DE_DESTAQUE_OU_SECUNDARIA]; margin-bottom: 16px; }
  .desc { font-size: 16px; line-height: 1.6; opacity: 0.85; max-width: 480px; margin-bottom: 32px; font-weight: 400; }
  .cta { display: inline-flex; align-items: center; justify-content: center; background: [COR_DE_DESTAQUE_OU_SECUNDARIA]; color: #000; padding: 18px 42px; border-radius: 8px; font-weight: 800; font-size: 16px; text-decoration: none; width: fit-content; box-shadow: 0 10px 25px -5px [COR_DE_DESTAQUE_OU_SECUNDARIA]; transition: transform 0.2s; }
  .image-wrapper { width: 550px; position: relative; flex-shrink: 0; z-index: 2; display: flex; align-items: center; justify-content: center; padding: 30px;}
  .image-wrapper img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(-10px 20px 30px rgba(0,0,0,0.4)); transform: scale(1.05); }
  .gradient-overlay { position: absolute; top: 0; bottom: 0; left: 0; width: 200px; background: linear-gradient(to right, [COR_PRIMARIA] 0%, transparent 100%); z-index: 3; }
</style>
</head>
<body>
  <div class="banner">
    <div class="bg-pattern"></div>
    <div class="content">
      <div class="badge">[NOME DA MARCA]</div>
      <h1 class="title">[HEADLINE PODEROSA]</h1>
      <h2 class="subtitle">[OFERTA OU SUBTÍTULO]</h2>
      <p class="desc">[BREVE DESCRIÇÃO DA DOR OU SOLUÇÃO]</p>
      <a href="#" class="cta">[TEXTO DO BOTAO CTA]</a>
    </div>
    <div class="image-wrapper">
      <div class="gradient-overlay"></div>
      <img src="https://image.pollinations.ai/prompt/[DESCRICAO_DO_PRODUTO_EM_INGLES_COM_AS_REGRAS_DE_IMAGEM_MENCIONADAS]?width=600&height=500&nologo=true" alt="Product">
    </div>
  </div>
</body>
</html>`,

  // ── INSTAGRAM ───────────────────────────────────────────────────────────────
  instagram: `Você é um Diretor de Arte Sênior. Gere um post HTML/CSS 1080x1080px de ALTÍSSIMA QUALIDADE.
Adicione OBRIGATORIAMENTE no final da descrição da imagem Pollinations: ", high-end commercial product photography, dramatic studio lighting, empty scene, no people, nobody, no humans".
Siga ESTRITAMENTE a estrutura abaixo, substituindo os valores em colchetes.

<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  .post { width: 1080px; height: 1080px; position: relative; display: flex; flex-direction: column; justify-content: flex-end; padding: 80px; background-color: [COR_PRIMARIA]; overflow: hidden; }
  .bg-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; opacity: 0.55; mix-blend-mode: luminosity; }
  .gradient { position: absolute; inset: 0; background: linear-gradient(to top, [COR_PRIMARIA] 10%, transparent 80%); z-index: 1; }
  .brand { position: absolute; top: 60px; left: 80px; z-index: 2; font-size: 28px; font-weight: 900; letter-spacing: 4px; color: #fff; opacity: 0.9; text-transform: uppercase; }
  .content { position: relative; z-index: 2; color: #fff; text-align: left; max-width: 900px; }
  .title { font-size: 85px; font-weight: 900; line-height: 1.05; letter-spacing: -2px; margin-bottom: 24px; text-transform: uppercase; text-shadow: 0 10px 30px rgba(0,0,0,0.3); }
  .subtitle { font-size: 32px; font-weight: 700; color: [COR_DE_DESTAQUE]; background: rgba(0,0,0,0.25); display: inline-block; padding: 12px 28px; border-radius: 12px; backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
</style>
</head>
<body>
  <div class="post">
    <img class="bg-img" src="https://image.pollinations.ai/prompt/[DESCRICAO_DO_PRODUTO_EM_INGLES_COM_AS_REGRAS_DE_IMAGEM_MENCIONADAS]?width=1080&height=1080&nologo=true">
    <div class="gradient"></div>
    <div class="brand">[NOME DA MARCA]</div>
    <div class="content">
      <h1 class="title">[HEADLINE PODEROSA E CURTA]</h1>
      <h2 class="subtitle">[OFERTA OU CALL TO ACTION]</h2>
    </div>
  </div>
</body>
</html>`,

  // ── E-MAIL ──────────────────────────────────────────────────────────────────
  email: `Você é um especialista em e-mail marketing. Gere um HTML responsivo baseado ESTRITAMENTE neste template seguro para Outlook e Gmail (Tabelas).
Regras de imagem em inglês: "product photography, empty scene, no people, nobody, isolated".

<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, sans-serif;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f4f4f5">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        <table width="600" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
          <tr>
            <td align="center" bgcolor="[COR_PRIMARIA]" style="padding: 35px; color:#ffffff; font-size:26px; font-weight:bold; text-transform:uppercase; letter-spacing:2px;">
              [NOME DA MARCA]
            </td>
          </tr>
          <tr>
            <td>
              <img src="https://image.pollinations.ai/prompt/[DESCRICAO_DO_PRODUTO_EM_INGLES_COM_REGRAS]?width=600&height=350&nologo=true" width="600" style="display:block; width:100%; max-width:600px;">
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 35px; color:#333333; font-size:16px; line-height:1.6;">
              <h1 style="margin-top:0; font-size:26px; color:#111111; letter-spacing:-0.5px;">[HEADLINE]</h1>
              <p>[CORPO DO E-MAIL - ARGUMENTAÇÃO PERSUASIVA]</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 35px 50px;">
              <a href="#" style="display:inline-block; background-color:[COR_DE_DESTAQUE]; color:#000000; font-size:16px; font-weight:bold; text-decoration:none; padding:18px 36px; border-radius:8px;">[TEXTO DO BOTAO]</a>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#eeeeee" style="padding: 24px; font-size:12px; color:#888888;">
              © 2024 [NOME DA MARCA]. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,

  datasheet: `Você é um conteudista técnico. Gere uma ficha técnica de produto em Markdown estruturado com: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso e CTA. Use apenas Markdown válido. Português do Brasil.`,
  text: `Você é um copywriter sênior de marketing. Escreva conteúdo persuasivo, claro e direto em português do Brasil. Use Markdown.`,
};

export const APIRoute = createAPIFileRoute("/api/chat")({
  POST: async ({ request }) => {
    let body: { prompt: string; intent: string; model?: string };

    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { prompt, intent = "text", model = DEFAULT_MODEL } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Campo 'prompt' é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemPrompt = SYSTEM_PROMPTS[intent] ?? SYSTEM_PROMPTS.text;

    let ollamaRes: Response;
    try {
      ollamaRes = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          prompt: prompt.trim(),
          stream: true,
        }),
        signal: request.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(
        JSON.stringify({ error: `Não foi possível conectar ao Ollama: ${msg}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!ollamaRes.ok || !ollamaRes.body) {
      const text = await ollamaRes.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Ollama retornou ${ollamaRes.status}: ${text}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const encoder = new TextEncoder();
    const ollamaReader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const readable = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await ollamaReader.read();

          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\\n\\n"));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line) as { response?: string; done?: boolean };
              if (json.response) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(json.response)}\\n\\n`),
                );
              }
              if (json.done) {
                controller.enqueue(encoder.encode("data: [DONE]\\n\\n"));
                controller.close();
                return;
              }
            } catch {
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`data: {"error":"${msg}"}\\n\\n`));
          controller.close();
        }
      },
      cancel() {
        ollamaReader.cancel();
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
});