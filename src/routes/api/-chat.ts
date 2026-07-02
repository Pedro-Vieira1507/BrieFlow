/**
 * Server Function — POST /api/chat
 *
 * Recebe o prompt e o intent do cliente, chama o Ollama
 * INTERNAMENTE (sem expor a porta 11434 publicamente) e
 * retorna um ReadableStream de Server-Sent Events para que
 * o frontend renderize tokens em tempo real.
 *
 * Body esperado:
 *   { prompt: string, intent: "email" | "datasheet" | "text", model?: string }
 *
 * Resposta: text/event-stream
 *   data: <token>\n\n
 *   data: [DONE]\n\n
 */
import { createAPIFileRoute } from "@tanstack/start/api";

// URL interna do Ollama — nunca exposta ao browser
const OLLAMA_INTERNAL_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

const SYSTEM_PROMPTS: Record<string, string> = {
  email: `Você é um especialista em e-mail marketing. Gere um e-mail HTML completo, responsivo, inline-styled (sem <link> externos), pronto para envio. Comece DIRETAMENTE com <!DOCTYPE html> ou <html>. Não inclua explicações fora do HTML. Use português do Brasil.`,
  datasheet: `Você é um especialista em conteúdo de marketing técnico. Gere uma ficha técnica de produto em Markdown bem estruturado, com seções: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso e CTA. Use apenas Markdown válido. Português do Brasil.`,
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
          stream: true, // streaming habilitado — tokens chegam em tempo real
        }),
        signal: request.signal, // propaga cancelamento do cliente
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

    /**
     * Transforma o stream NDJSON do Ollama em Server-Sent Events (SSE).
     * Cada linha do Ollama é: {"response":"token","done":false}
     * Enviamos:                data: token\n\n
     * Ao terminar:             data: [DONE]\n\n
     */
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
          buffer = lines.pop() ?? ""; // última linha pode estar incompleta

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
              // linha JSON malformada — ignora silenciosamente
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
        "X-Accel-Buffering": "no", // desativa buffer do Nginx/Caddy para SSE
      },
    });
  },
});
