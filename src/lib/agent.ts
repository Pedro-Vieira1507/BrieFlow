/**
 * agent.ts — cliente leve do agente de marketing.
 *
 * IMPORTANTE: callOllama e translatePromptForImage agora
 * chamam Server Functions internas (/api/chat, /api/translate)
 * em vez de bater direto em localhost:11434 do browser.
 * Isso resolve o problema de CORS em produção e mantém
 * o Ollama inacessível pela internet.
 */

export type Intent = "image" | "email" | "datasheet" | "text";

export function detectIntent(prompt: string): Intent {
  const p = prompt.toLowerCase();
  if (/\b(imagem|imagens|foto|banner|ilustra|art\s?work|logo|visual|criativo)\b/.test(p))
    return "image";
  if (/\b(e-?mail|email|newsletter|html|marketing direto|disparo)\b/.test(p)) return "email";
  if (/\b(ficha\s+t[eé]cnica|datasheet|especifica|spec|pdf|one[- ]?pager)\b/.test(p))
    return "datasheet";
  return "text";
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

/**
 * callOllama — chama a Server Function /api/chat com streaming.
 * Cada token recebido dispara onToken; ao final dispara onDone.
 * Retorna uma função de cancelamento (abort).
 */
export function callOllama(
  prompt: string,
  intent: Exclude<Intent, "image">,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): () => void {
  const controller = new AbortController();
  if (signal) signal.addEventListener("abort", () => controller.abort());

  let fullText = "";

  (async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, intent }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        callbacks.onError((err as { error: string }).error ?? `HTTP ${res.status}`);
        return;
      }

      if (!res.body) {
        callbacks.onError("Resposta sem corpo do servidor.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            callbacks.onDone(fullText);
            return;
          }
          try {
            const token = JSON.parse(payload) as string;
            fullText += token;
            callbacks.onToken(token);
          } catch {
            // payload inválido — ignora
          }
        }
      }

      callbacks.onDone(fullText);
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // cancelamento normal
      callbacks.onError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  })();

  return () => controller.abort();
}

/**
 * translatePromptForImage — chama /api/translate para converter
 * o briefing em PT para um prompt em inglês antes do Pollinations.
 */
export async function translatePromptForImage(
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal,
    });
    if (!res.ok) return prompt;
    const { englishPrompt } = (await res.json()) as { englishPrompt: string };
    return englishPrompt ?? prompt;
  } catch {
    return prompt;
  }
}

export function buildPollinationsUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
) {
  const { width = 1024, height = 1024, seed } = opts;
  const encoded = encodeURIComponent(prompt);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    nologo: "true",
  });
  if (seed !== undefined) params.set("seed", String(seed));
  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}

export function looksLikeHtml(text: string): boolean {
  return /<!doctype html|<html[\s>]|<body[\s>]|<table[\s>]|<div[\s>]/i.test(text);
}
