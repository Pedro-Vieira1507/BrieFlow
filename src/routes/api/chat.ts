/**
 * Server Function — POST /api/chat
 *
 * Usa o campo `system` da API do Ollama (separado do `prompt`) para que
 * as regras do sistema tenham prioridade máxima sobre o pedido do usuário.
 * Antes de gerar HTML, o modelo é forçado a um bloco de raciocínio explícito
 * (chain-of-thought) que extrai cores, produto e descrição da imagem.
 */
import { createAPIFileRoute } from "@tanstack/start/api";

const OLLAMA_INTERNAL_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS — enviados no campo `system` da API do Ollama
// Isso garante que as regras não sejam tratadas como parte do pedido do usuário
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  // ── E-MAIL ──────────────────────────────────────────────────────────────────
  email: `Você é um especialista em e-mail marketing que gera HTML inline-styled responsivo.
Regras inviolaveis:
- Comece DIRETAMENTE com <!DOCTYPE html>. Zero texto fora do HTML.
- Sem <link> externos, sem @import.
- Português do Brasil.
- Cor: use SOMENTE as cores explicitamente pedidas pelo usuário. Se não especificou, use #1a1a1a de fundo e #f97316 como destaque. NUNCA use azul como cor principal sem pedido.
- Imagem: se precisar de imagem, use EXCLUSIVAMENTE: <img src="https://image.pollinations.ai/prompt/DESCRICAO_EM_INGLES?width=600&height=300&nologo=true" style="width:100%;display:block">. A DESCRICAO deve descrever exatamente o produto mencionado pelo usuário em inglês.`,

  // ── BANNER ──────────────────────────────────────────────────────────────────
  banner: `Você é um designer de banners HTML/CSS. Gere um banner 1200x500px completo e autossuficiente.

PROCESSO OBRIGATÓRIO antes de escrever qualquer HTML:
Passo 1 — Extraia do pedido do usuário e escreva num comentário HTML no início do código:
  <!-- ANALISE:
  Cores pedidas: [liste as cores exatas mencionadas pelo usuário]
  Cor primária (fundo/base): [hex exato]
  Cor secundária: [hex exato]
  Cor de destaque (textos de promoção/desconto): [hex exato]
  Produto: [nome do produto]
  Descrição da imagem Pollinations (inglês): [descrição detalhada e específica do produto]
  -->
Passo 2 — Construa o HTML usando EXATAMENTE os valores definidos no Passo 1.

ESTRUTURA DO BANNER:
- Div raiz: width:1200px; height:500px; position:relative; overflow:hidden; display:flex; font-family:Arial,sans-serif
- Painel esquerdo (~680px): background com a COR PRIMARIA pedida; padding:50px 60px; display:flex; flex-direction:column; justify-content:center; gap:16px
  - Tag da marca: font-size:12px; letter-spacing:2px; text-transform:uppercase; opacity:0.8; cor contrastante com o fundo
  - Título principal: font-size:48px; font-weight:900; line-height:1.1; cor branca ou contrastante
  - Subtexto de oferta/desconto: font-size:22px; font-weight:700; color: COR DE DESTAQUE (vermelho, dourado, etc — o que o usuário pediu)
  - Descrição: font-size:15px; opacity:0.85; max-width:400px
  - Botão CTA: display:inline-block; padding:16px 40px; border-radius:8px; font-weight:900; font-size:16px; background: COR SECUNDÁRIA ou destaque; cursor:pointer
- Painel direito (~520px): position:relative; overflow:hidden
  - <img src="https://image.pollinations.ai/prompt/DESCRICAO_EM_INGLES_DO_PRODUTO?width=520&height=500&nologo=true" style="width:100%;height:100%;object-fit:cover;display:block">
- Badge de desconto (opcional): position:absolute; top:30px; right:30px; background: COR DE DESTAQUE; color:#fff; border-radius:50%; width:90px; height:90px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:900

REGRAS ABSOLUTAS:
- A COR DO FUNDO do painel esquerdo é a cor primária que o usuário pediu. Se pediu rosa, é rosa. Se pediu marrom, é marrom.
- NUNCA use background azul (#0000ff, #003366, #1a73e8, navy, blue, #1e40af, #2563eb, #3b82f6 ou qualquer tom de azul) a não ser que o usuário tenha pedido explicitamente a palavra "azul".
- A descrição Pollinations DEVE descrever o produto específico mencionado (ex: brownie recheado sanduiche quadrado = "square layered chocolate brownie sandwich cut in half showing filling close-up food photography").
- Comece DIRETAMENTE com <!-- ANALISE: (o comentário do Passo 1) seguido de <!DOCTYPE html>.
- ZERO texto explicativo fora do HTML.
- Português do Brasil nos textos do banner.`,

  // ── INSTAGRAM ───────────────────────────────────────────────────────────────
  instagram: `Você é um designer de posts para Instagram especializado em marketing. Gere um post HTML/CSS 1080x1080px completo.

PROCESSO OBRIGATÓRIO antes de escrever qualquer HTML:
Escreva um comentário HTML no início:
  <!-- ANALISE:
  Cores pedidas: [liste]
  Cor primária: [hex]
  Cor secundária: [hex]
  Produto/ramo: [nome]
  Descrição Pollinations (inglês, específica): [descrição]
  -->

ESTRUTURA:
- Div raiz: width:1080px; height:1080px; position:relative; overflow:hidden; font-family:Arial,sans-serif
- Fundo: imagem Pollinations (position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0) + overlay com as cores pedidas (z-index:1)
- Textos (z-index:2): headline grande bold centrada, subtítulo, nome da marca no canto

REGRAS:
- Cores: use SOMENTE as cores que o usuário pediu. NUNCA azul como padrão.
- Imagem: use https://image.pollinations.ai/prompt/DESCRICAO?width=1080&height=1080&nologo=true com descrição do produto específico do usuário.
- Comece com <!-- ANALISE: seguido de <!DOCTYPE html>. Zero texto fora do HTML. Português do Brasil.`,

  // ── FICHA TÉCNICA ──────────────────────────────────────────────────────────
  datasheet: `Você é um especialista em conteúdo de marketing técnico. Gere uma ficha técnica de produto em Markdown estruturado com: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso e CTA. Use apenas Markdown válido. Português do Brasil.`,

  // ── TEXTO GENÉRICO ─────────────────────────────────────────────────────────
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

    let ollamaRes: Response;
    try {
      ollamaRes = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          // `system` é o campo nativo do Ollama para system prompt — tem prioridade
          // sobre o `prompt` (que é o pedido do usuário). Isso impede que o modelo
          // misture as regras com o conteúdo e reduza o peso das instruções.
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
