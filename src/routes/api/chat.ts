/**
 * Server Function — POST /api/chat
 * Arquitetura Multi-Agente v3: Copywriter Estratégico → Diretor de Arte HTML
 *
 * Pipeline de 2 passos para intenções visuais (banner, instagram, email):
 *  1. Agente 1 (Copywriter): chamada NON-STREAMING → extrai [HEADLINE], [SUBTITLE], [CTA]
 *  2. Agente 2 (Diretor de Arte): chamada STREAMING → injeta copy nos templates HTML estritos
 *
 * Regra de imagens: TODOS os prompts do Pollinations incluem negative prompts explícitos
 * para eliminar alucinações de humanos.
 */
import { createAPIFileRoute } from "@tanstack/start/api";

const OLLAMA_INTERNAL_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

// ============================================================================
// NEGATIVE PROMPT UNIVERSAL PARA IMAGENS DO POLLINATIONS
// Injetado em TODOS os prompts de imagem para eliminar alucinações de humanos
// ============================================================================
const IMAGE_NEGATIVE_PROMPT =
  "professional macro product photography, isolated on pure white background, no humans, nobody, no people, empty scene, no persons, no faces, no hands, product only";

// ============================================================================
// AGENTE 1: COPYWRITER ESTRATÉGICO (NON-STREAMING)
// Foca apenas em texto estruturado — NUNCA produz HTML
// ============================================================================
const STRATEGIST_SYSTEM_PROMPTS: Record<string, string> = {
  banner: `You are an elite B2B Conversion Copywriter. Your ONLY output is structured copy text.
NEVER write HTML, CSS, or any markup. NEVER use clichéd AI phrases like "revolutionary", "innovative", "elevate your game", "unlock the power".
Use the AIDA framework (Attention, Interest, Desire, Action).
Write for decision-makers: CEOs, managers, procurement directors. Focus on pain, metrics, ROI, and efficiency.

MANDATORY OUTPUT STRUCTURE (use EXACTLY these markers):
[HEADLINE]: (The core promise, max 5 words. Must name a tangible benefit. Example: 'Precision That Drives Revenue.')
[SUBTITLE]: (Supporting detail or offer, max 10 words. Example: 'Cut lab errors by 40% in 90 days.')
[CTA]: (A direct, specific action verb + object. NOT 'Learn More'. Example: 'Request a Pilot Test' or 'Download the Case Study')`,

  instagram: `You are an elite B2B Social Media Copywriter. Your ONLY output is structured copy text.
NEVER write HTML, CSS, or any markup.
Use the PAS framework (Problem, Agitation, Solution).
Start with a direct 'hook' that hits the customer's pain point immediately — no robotic introductions.
Avoid excessive exclamation marks.

MANDATORY OUTPUT STRUCTURE (use EXACTLY these markers):
[HEADLINE]: (Design headline, max 6 words, impactful. Example: 'Stop Losing Samples to Errors.')
[SUBTITLE]: (Design subtext, max 10 words. Example: 'DLAB pipettes guarantee 0.1μL precision every time.')
[CAPTION]: (Full post caption following PAS framework, 3-4 short paragraphs)`,

  email: `You are an elite B2B Email Copywriter. Your ONLY output is structured copy text.
NEVER write HTML, CSS, or any markup.
Use the AIDA framework (Attention, Interest, Desire, Action).
Write short paragraphs (max 2 sentences). Scannable. Corporate realist tone.
Focus on business metrics, pain points, and operational efficiency.

MANDATORY OUTPUT STRUCTURE (use EXACTLY these markers):
[HEADLINE]: (Subject-line-strength headline focused on the pain or gain)
[BODY]: (Email body following AIDA — 3 short paragraphs)
[CTA]: (Specific CTA button text, example: 'See the Case Study' not 'Click Here')`,

  text: `You are a Senior B2B Copywriter. Write direct, professional content without AI clichés. Use Markdown formatting.`,
  datasheet: `You are a Product Engineer. Write highly technical, precise content in Markdown. Focus on specifications, tolerances, and measurable attributes.`,
};

// ============================================================================
// AGENTE 2: DIRETOR DE ARTE HTML (STREAMING)
// Recebe o copy do Agente 1 e injeta em templates HTML/CSS ESTRITOS
// Regra crítica: descrições de imagem devem SEMPRE incluir os negative prompts
// ============================================================================
function buildDesignerSystemPrompt(intent: string, strategicCopy: string): string {
  const copyBlock = `
========== STRATEGIC COPY FROM AGENT 1 (inject verbatim) ==========
${strategicCopy}
====================================================================`;

  if (intent === "banner") {
    return `You are an HTML Art Director. You have been handed the following strategic copy:
${copyBlock}

YOUR TASK: Inject this copy VERBATIM into the EXACT HTML template below.
DO NOT alter structural CSS (z-index, flexbox, gradient). Only replace the placeholder comments.
For the Pollinations <img> tag, you MUST describe ONLY the product/object — NEVER depict humans.
The image description MUST include these negative prompts verbatim in the URL:
"${IMAGE_NEGATIVE_PROMPT}"

Replace [PRIMARY_COLOR] with a dark solid color matching the brand (e.g. #1a2340, #0d1f1e, #1c0a3b).
Replace [ACCENT_COLOR] with a vivid contrast color for CTA (e.g. #f5c518, #00e5c9, #ff6b35).

OUTPUT: A SINGLE complete HTML document. No markdown fences, no explanations — just the HTML.

STRICT TEMPLATE TO USE (1200x500px, flexbox, Inter font):
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: #f0f0f0; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .banner { width:1200px; height:500px; display:flex; overflow:hidden; background:[PRIMARY_COLOR]; color:#fff; position:relative; flex-shrink:0; }
  .content { flex:1; padding:60px 70px; display:flex; flex-direction:column; justify-content:center; z-index:3; position:relative; }
  .eyebrow { font-size:12px; font-weight:600; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.55); margin-bottom:18px; }
  .title { font-size:54px; font-weight:900; line-height:1.04; letter-spacing:-2px; margin-bottom:20px; max-width:520px; }
  .subtitle { font-size:20px; font-weight:600; color:[ACCENT_COLOR]; margin-bottom:36px; max-width:460px; line-height:1.4; }
  .cta { display:inline-flex; align-items:center; background:[ACCENT_COLOR]; color:#000; padding:16px 40px; border-radius:8px; font-weight:800; font-size:15px; text-decoration:none; width:fit-content; letter-spacing:0.3px; }
  .image-side { width:520px; flex-shrink:0; position:relative; overflow:hidden; }
  .image-side img { width:100%; height:100%; object-fit:contain; filter:drop-shadow(-8px 16px 32px rgba(0,0,0,0.55)); transform:scale(1.08) translateX(10px); }
  .gradient-left { position:absolute; top:0; bottom:0; left:0; width:220px; background:linear-gradient(to right,[PRIMARY_COLOR] 0%,transparent 100%); z-index:2; pointer-events:none; }
</style>
</head>
<body>
  <div class="banner">
    <div class="content">
      <!-- Replace with [HEADLINE] from copy -->
      <h1 class="title">[INSERT HEADLINE HERE]</h1>
      <!-- Replace with [SUBTITLE] from copy -->
      <p class="subtitle">[INSERT SUBTITLE HERE]</p>
      <!-- Replace with [CTA] from copy -->
      <a href="#" class="cta">[INSERT CTA HERE]</a>
    </div>
    <div class="image-side">
      <div class="gradient-left"></div>
      <!-- CRITICAL: describe ONLY the product object. Include the negative prompt string in the URL. -->
      <img src="https://image.pollinations.ai/prompt/[PRODUCT_DESCRIPTION_IN_ENGLISH],${encodeURIComponent(IMAGE_NEGATIVE_PROMPT)}?width=600&height=500&nologo=true" alt="Product">
    </div>
  </div>
</body>
</html>`;
  }

  if (intent === "instagram") {
    return `You are an HTML Art Director. You have been handed the following strategic copy:
${copyBlock}

YOUR TASK: Inject this copy VERBATIM into the EXACT HTML template below.
DO NOT alter structural CSS. Only replace the placeholder comments.
For the Pollinations background image, describe ONLY the product/object — NEVER depict humans.
The image description MUST include these negative prompts verbatim in the URL:
"${IMAGE_NEGATIVE_PROMPT}"

Replace [PRIMARY_COLOR] with a bold, opinionated color (e.g. #1a1a2e, #0f3460, #16213e).

OUTPUT: A SINGLE complete HTML document. No markdown fences, no explanations — just the HTML.

STRICT TEMPLATE TO USE (1080x1080px, Swiss Design, full-bleed background):
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background:#111; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .post { width:1080px; height:1080px; position:relative; overflow:hidden; font-family:'Inter',sans-serif; flex-shrink:0; }
  .bg-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .overlay { position:absolute; inset:0; background:[PRIMARY_COLOR]; opacity:0.78; }
  .content { position:relative; z-index:3; height:100%; display:flex; flex-direction:column; justify-content:flex-end; padding:80px; }
  .tag { font-size:12px; font-weight:700; letter-spacing:4px; text-transform:uppercase; color:rgba(255,255,255,0.5); margin-bottom:24px; }
  .headline { font-size:72px; font-weight:900; line-height:1.0; letter-spacing:-3px; color:#fff; margin-bottom:22px; max-width:860px; }
  .subtitle { font-size:26px; font-weight:400; color:rgba(255,255,255,0.75); line-height:1.35; max-width:700px; margin-bottom:48px; }
  .divider { width:64px; height:4px; background:#fff; margin-bottom:36px; }
  .handle { font-size:16px; font-weight:600; letter-spacing:1px; color:rgba(255,255,255,0.45); }
</style>
</head>
<body>
  <div class="post">
    <!-- CRITICAL: product photography only, absolutely no humans. Include negative prompt. -->
    <img class="bg-img" src="https://image.pollinations.ai/prompt/[PRODUCT_DESCRIPTION_IN_ENGLISH],${encodeURIComponent(IMAGE_NEGATIVE_PROMPT)}?width=1080&height=1080&nologo=true" alt="Product">
    <div class="overlay"></div>
    <div class="content">
      <!-- [SUBTITLE] from copy as a category tag -->
      <span class="tag">[INSERT SUBTITLE/TAG HERE]</span>
      <!-- [HEADLINE] from copy -->
      <h1 class="headline">[INSERT HEADLINE HERE]</h1>
      <div class="divider"></div>
      <!-- Brand handle or page name -->
      <span class="handle">@brand_handle</span>
    </div>
  </div>
</body>
</html>`;
  }

  if (intent === "email") {
    return `You are an HTML Email Designer. You have been handed the following strategic copy:
${copyBlock}

YOUR TASK: Build a complete, production-ready HTML email by injecting the copy above.
CRITICAL RULES:
1. Use ONLY <table> layouts — absolutely NO flexbox, NO grid, NO CSS Grid. Outlook-safe.
2. Maximum content width: 600px centered.
3. Use ONLY web-safe fonts: Arial, Helvetica, Georgia, Times New Roman.
4. All CSS must be inline (no <style> blocks for client-facing elements).
5. For Pollinations product image: describe ONLY the product — NEVER humans.
   The image description MUST include these negative prompts verbatim:
   "${IMAGE_NEGATIVE_PROMPT}"
6. Use table rows for all structural blocks: header, body, CTA row, footer.
7. CTA button must use table-based button pattern (not CSS flexbox).

OUTPUT: A SINGLE complete HTML email document. No markdown fences — just the HTML.

STRICT EMAIL TEMPLATE STRUCTURE (600px, Outlook-safe):
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f4f5f7">
    <tr><td align="center" style="padding:40px 10px;">
      <!-- OUTER WRAPPER: max 600px -->
      <table width="600" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius:8px;overflow:hidden;">

        <!-- HEADER ROW with brand color -->
        <tr><td bgcolor="#1a2340" style="padding:32px 48px;">
          <!-- Brand name or logo here -->
          <p style="margin:0;font-family:Arial,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">[BRAND NAME]</p>
        </td></tr>

        <!-- PRODUCT IMAGE ROW -->
        <tr><td style="padding:0;">
          <!-- CRITICAL: product only, no humans. Include negative prompt in URL. -->
          <img src="https://image.pollinations.ai/prompt/[PRODUCT_DESCRIPTION_IN_ENGLISH],${encodeURIComponent(IMAGE_NEGATIVE_PROMPT)}?width=600&height=300&nologo=true" width="600" alt="Product" style="display:block;border:0;">
        </td></tr>

        <!-- HEADLINE ROW -->
        <tr><td style="padding:48px 48px 24px;">
          <!-- [HEADLINE] from copy -->
          <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:bold;color:#111827;line-height:1.2;">[INSERT HEADLINE HERE]</h1>
        </td></tr>

        <!-- BODY TEXT ROW -->
        <tr><td style="padding:0 48px 32px;">
          <!-- [BODY] from copy -->
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#4b5563;line-height:1.65;">[INSERT EMAIL BODY HERE]</p>
        </td></tr>

        <!-- CTA BUTTON ROW (table-based, Outlook-safe) -->
        <tr><td align="center" style="padding:8px 48px 48px;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="#1a2340" style="border-radius:8px;">
                <!-- [CTA] from copy -->
                <a href="#" target="_blank" style="display:inline-block;padding:16px 40px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">[INSERT CTA HERE]</a>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- FOOTER ROW -->
        <tr><td bgcolor="#f9fafb" style="padding:24px 48px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;text-align:center;">You received this email because you opted in. <a href="#" style="color:#6b7280;">Unsubscribe</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  // Fallback: single-agent text
  return STRATEGIST_SYSTEM_PROMPTS[intent] ?? STRATEGIST_SYSTEM_PROMPTS.text;
}

// ============================================================================
// FUNÇÃO AUXILIAR: CHAMADA NON-STREAMING (AGENTE 1)
// ============================================================================
async function generateStrategicCopy(
  userPrompt: string,
  systemPrompt: string,
  model: string,
): Promise<string> {
  const res = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Agente 1 (Copywriter) falhou: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { response: string };
  return data.response ?? "";
}

// ============================================================================
// ENDPOINT PRINCIPAL
// ============================================================================
export const APIRoute = createAPIFileRoute("/api/chat")({
  POST: async ({ request }) => {
    let body: {
      prompt: string;
      intent: string;
      model?: string;
      reasoning?: { objective?: string; funnelStage?: string; tone?: string };
    };

    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON inválido" }), { status: 400 });
    }

    const { prompt, intent = "text", model = DEFAULT_MODEL, reasoning } = body;

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "Falta prompt" }), { status: 400 });
    }

    // Contexto estratégico injetado no Agente 1
    const contextBlock = reasoning
      ? `\n\n[STRATEGIC CONTEXT]\nObjective: ${reasoning.objective ?? "conversion"}\nFunnel Stage: ${reasoning.funnelStage ?? "consideration"}\nTone: ${reasoning.tone ?? "professional"}`
      : "";

    const isVisualIntent = ["banner", "email", "instagram"].includes(intent);

    let finalSystemPrompt: string;
    let finalUserPrompt: string;

    if (isVisualIntent) {
      // ── PIPELINE MULTI-AGENTE ──────────────────────────────────────────────
      // Passo 1: Agente 1 gera copy estruturado (NON-STREAMING)
      const agent1System = (STRATEGIST_SYSTEM_PROMPTS[intent] ?? STRATEGIST_SYSTEM_PROMPTS.text) + contextBlock;

      let strategicCopy: string;
      try {
        strategicCopy = await generateStrategicCopy(prompt, agent1System, model);
      } catch (err) {
        return new Response(
          JSON.stringify({ error: `Pipeline Multi-Agente falhou no Agente 1: ${err}` }),
          { status: 502 },
        );
      }

      // Passo 2: Agente 2 recebe o copy e o template HTML estrito (STREAMING)
      finalSystemPrompt = buildDesignerSystemPrompt(intent, strategicCopy);
      finalUserPrompt = `Generate the complete HTML using the strategic copy provided in the system prompt.
Apply the following brand/design directives from the user's original request:
${prompt}
Ensure all Pollinations image URLs include the anti-hallucination negative prompts as instructed.`;
    } else {
      // Single-Agent para texto/datasheet
      finalSystemPrompt = (STRATEGIST_SYSTEM_PROMPTS[intent] ?? STRATEGIST_SYSTEM_PROMPTS.text) + contextBlock;
      finalUserPrompt = prompt.trim();
    }

    // ── PASSO FINAL: STREAMING (Agente 2 ou Text Agent) ──────────────────────
    let ollamaRes: Response;
    try {
      ollamaRes = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system: finalSystemPrompt,
          prompt: finalUserPrompt,
          stream: true,
        }),
        signal: request.signal,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `Ollama indisponível: ${err}` }), { status: 502 });
    }

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      return new Response(JSON.stringify({ error: `Ollama HTTP ${ollamaRes.status}: ${errText}` }), { status: 502 });
    }

    // Streaming SSE de volta ao cliente
    const encoder = new TextEncoder();
    const ollamaReader = ollamaRes.body!.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";

    const readable = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await ollamaReader.read();
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line) as { response?: string; done?: boolean };
              if (json.response) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(json.response)}\n\n`));
              }
              if (json.done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
            } catch {
              // linha JSON inválida — ignora silenciosamente
            }
          }
        } catch {
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
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  },
});
