/**
 * Server Function — POST /api/translate
 *
 * Traduz um briefing de imagem em português para inglês
 * para uso no Pollinations.ai. Roda internamente no servidor.
 *
 * NOTA: Este ficheiro tem o prefixo "-" para ser EXCLUÍDO do router do TanStack Start.
 * A rota é registada diretamente no server-express.mjs.
 *
 * Body: { prompt: string, model?: string }
 * Resposta: { englishPrompt: string }
 */
import { createAPIFileRoute } from "@tanstack/start/api";

const OLLAMA_INTERNAL_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

export const APIRoute = createAPIFileRoute("/api/translate")({
  POST: async ({ request }) => {
    const { prompt, model = DEFAULT_MODEL } = (await request.json()) as {
      prompt: string;
      model?: string;
    };

    if (!prompt) {
      return Response.json({ englishPrompt: prompt });
    }

    try {
      const res = await fetch(`${OLLAMA_INTERNAL_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: `Translate the following marketing image brief into a concise, vivid English prompt for an image generator. Return ONLY the English prompt — no quotes, no preface, no explanation.\n\n${prompt}`,
          stream: false,
        }),
        signal: request.signal,
      });

      if (!res.ok) return Response.json({ englishPrompt: prompt });
      const data = (await res.json()) as { response?: string };
      const englishPrompt = (data.response ?? prompt).trim().replace(/^["']|["']$/g, "");
      return Response.json({ englishPrompt });
    } catch {
      return Response.json({ englishPrompt: prompt });
    }
  },
});

// Export da lógica pura para uso no server-express.mjs
export { OLLAMA_INTERNAL_URL, DEFAULT_MODEL };
