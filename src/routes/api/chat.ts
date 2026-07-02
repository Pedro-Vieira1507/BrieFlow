/**
 * Server Function — POST /api/chat
 *
 * Recebe o prompt e o intent do cliente, chama o Ollama
 * INTERNAMENTE (sem expor a porta 11434 publicamente) e
 * retorna um ReadableStream de Server-Sent Events para que
 * o frontend renderize tokens em tempo real.
 *
 * Body esperado:
 *   { prompt: string, intent: "email" | "banner" | "instagram" | "datasheet" | "text", model?: string }
 *
 * Resposta: text/event-stream
 *   data: <token>\n\n
 *   data: [DONE]\n\n
 */
import { createAPIFileRoute } from "@tanstack/start/api";

const OLLAMA_INTERNAL_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

// ─────────────────────────────────────────────────────────────────────────────
const COLOR_RULES = `
REGRAS ABSOLUTAS DE COR — NUNCA IGNORE:
1. PROIBIDO usar azul (#0000ff, #003366, #1a73e8, navy, blue, #00008b, #1e40af, etc) como cor primária ou de fundo, a não ser que o usuário EXPLICITAMENTE peça.
2. OBRIGATÓRIO usar EXATAMENTE as cores pedidas pelo usuário. Se o usuário pediu "rosa e dourado", o fundo principal e os textos de destaque DEVEM ser rosa (#f9a8d4, #ec4899 ou similar) e dourado (#f59e0b, #d97706 ou similar).
3. Se o usuário não especificou cores, use neutros escuros (cinza escuro #1a1a1a ou off-white #fafafa) como base e um ÚNICO tom de destaque quente (laranja #f97316, vinho #7f1d1d, verde musgo #3f6212 — NUNCA azul por padrão).
4. Gradientes só podem usar as cores pedidas pelo usuário. NUNCA crie gradientes azul/roxo sem pedido explícito.
5. Antes de escrever qualquer CSS, identifique as cores exatas pedidas. Use APENAS essas.`.trim();

// ─────────────────────────────────────────────────────────────────────────────
const IMAGE_RULES = `
REGRAS PARA IMAGENS — SIGA EXATAMENTE:
1. Para imagens de produto ou fundo, use EXCLUSIVAMENTE o formato Pollinations.ai:
   <img src="https://image.pollinations.ai/prompt/DESCRIÇÃO_EM_INGLÊS?width=800&height=500&nologo=true" ...>
2. A DESCRIÇÃO deve ser em inglês, descritiva e diretamente relacionada ao produto/ramo mencionado pelo usuário.
   Exemplos corretos:
   - Empresa de confeitaria, produto brownie: "close-up delicious chocolate brownie cake with strawberries professional food photography"
   - Empresa de instrumentos científicos: "modern laboratory analytical instrument equipment scientific professional"
   - Empresa de cosméticos: "luxury cosmetics products flat lay elegant beauty photography"
3. NUNCA use URLs inventadas, endereços de outros sites, ou src vazio.
4. NUNCA use image.pollinations.ai com URLs diferentes do formato acima.
5. A imagem de produto deve sempre ter object-fit:cover e preencher o espaço definido.`.trim();

const SYSTEM_PROMPTS: Record<string, string> = {
  // ── E-MAIL ──────────────────────────────────────────────────────────────────
  email: `Você é um especialista em e-mail marketing. Gere um e-mail HTML completo, responsivo, inline-styled (sem <link> externos), pronto para envio. Comece DIRETAMENTE com <!DOCTYPE html> ou <html>. Não inclua explicações fora do HTML. Use português do Brasil.

${COLOR_RULES}

${IMAGE_RULES}`,

  // ── BANNER ──────────────────────────────────────────────────────────────────
  banner: `Você é um designer de banners digitais especializado em marketing. Gere um banner HTML/CSS completo, autossuficiente (sem imports externos de CSS), com dimensões 1200×500px.

ESTRUTURA DO BANNER:
- Div raiz: width:1200px; height:500px; position:relative; overflow:hidden; display:flex
- Lado esquerdo (~60% da largura): fundo colorido com as cores do usuário, todos os textos e CTA
- Lado direito (~40% da largura): imagem do produto via Pollinations (veja REGRAS DE IMAGEM)
- Hierarquia de texto (lado esquerdo): nome da marca (pequeno), título principal (grande bold), oferta/subtítulo (médio), botão CTA
- CTA: border-radius:8px; padding:14px 32px; font-weight:bold; cor contrastante com o fundo

${COLOR_RULES}

${IMAGE_RULES}

ANTES DE ESCREVER O HTML, responda internamente:
- Quais cores o usuário pediu? (use APENAS essas no CSS)
- Qual é o produto/ramo da empresa? (use para descrever a imagem Pollinations em inglês)

Comece DIRETAMENTE com <!DOCTYPE html>. Sem explicações fora do HTML. Use português do Brasil.`,

  // ── INSTAGRAM ───────────────────────────────────────────────────────────────
  instagram: `Você é um designer de posts para Instagram especializado em marketing. Gere um post HTML/CSS completo, autossuficiente (sem imports externos de CSS), em formato quadrado 1080×1080px.

ESTRUTURA DO POST:
- Div raiz: width:1080px; height:1080px; position:relative; overflow:hidden
- Opção A (imagem dominante): imagem Pollinations cobrindo todo o fundo (position:absolute; inset:0; object-fit:cover; z-index:0) + overlay semi-transparente nas cores do usuário + textos por cima (z-index:1)
- Opção B (sem imagem): fundo sólido ou gradiente nas cores do usuário + elementos geométricos decorativos
- Hierarquia: headline principal (grande bold centro), subtítulo/oferta (menor), nome da marca (canto)
- Tipografia: Arial Black ou Impact para headlines; sans-serif para subtítulos

${COLOR_RULES}

${IMAGE_RULES}

ANTES DE ESCREVER O HTML, responda internamente:
- Quais cores o usuário pediu? (use APENAS essas)
- Qual é o produto/ramo? (use para descrever a imagem Pollinations)

Comece DIRETAMENTE com <!DOCTYPE html>. Sem explicações fora do HTML. Use português do Brasil.`,

  // ── FICHA TÉCNICA ───────────────────────────────────────────────────────────
  datasheet: `Você é um especialista em conteúdo de marketing técnico. Gere uma ficha técnica de produto em Markdown bem estruturado, com seções: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso e CTA. Use apenas Markdown válido. Português do Brasil.`,

  // ── TEXTO GENÉRICO ──────────────────────────────────────────────────────────
  text: `Você é um copywriter sênior de marketing. Escreva conteúdo persuasivo, claro e direto em português do Brasil. Use Markdown quando ajudar a leitura.`,
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
    const fullPrompt = `${systemPrompt}\n\nPedido do usuário:\n${prompt.trim()}`;

    let ollamaRes: Response;
    try {
      ollamaRes = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
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
              const json = JSON.parse(line) as { response?: string; done?: boolean };
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
              // linha JSON malformada — ignora
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`data: {"error":"${msg}"}\n\n`));
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
