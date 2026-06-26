// Lightweight Ollama client + intent detection for marketing artifacts.

export const OLLAMA_URL =
  (typeof window !== "undefined" && window.localStorage.getItem("ollama:url")) ||
  "http://localhost:11434";

export const OLLAMA_MODEL =
  (typeof window !== "undefined" && window.localStorage.getItem("ollama:model")) ||
  "llama3";

export type Intent = "image" | "email" | "datasheet" | "text";

export function detectIntent(prompt: string): Intent {
  const p = prompt.toLowerCase();
  if (/\b(imagem|imagens|foto|banner|ilustra|art\s?work|logo|visual|criativo)\b/.test(p)) return "image";
  if (/\b(e-?mail|email|newsletter|html|marketing direto|disparo)\b/.test(p)) return "email";
  if (/\b(ficha\s+t[eé]cnica|datasheet|especifica|spec|pdf|one[- ]?pager)\b/.test(p)) return "datasheet";
  return "text";
}

const SYSTEM_PROMPTS: Record<Exclude<Intent, "image">, string> = {
  email: `Você é um especialista em e-mail marketing. Gere um e-mail HTML completo, responsivo, inline-styled (sem <link> externos), pronto para envio. Comece DIRETAMENTE com <!DOCTYPE html> ou <html>. Não inclua explicações fora do HTML. Use português do Brasil.`,
  datasheet: `Você é um especialista em conteúdo de marketing técnico. Gere uma ficha técnica de produto em Markdown bem estruturado, com seções: Visão Geral, Características, Especificações (tabela), Benefícios, Casos de Uso e CTA. Use apenas Markdown válido. Português do Brasil.`,
  text: `Você é um copywriter sênior de marketing. Escreva conteúdo persuasivo, claro e direto em português do Brasil. Use Markdown quando ajudar a leitura.`,
};

export interface OllamaResult {
  text: string;
  intent: Intent;
}

export async function callOllama(prompt: string, intent: Exclude<Intent, "image">, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: `${SYSTEM_PROMPTS[intent]}\n\nPedido do usuário:\n${prompt}`,
      stream: false,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Ollama respondeu ${res.status}. Verifique se o serviço está rodando em ${OLLAMA_URL} com CORS habilitado.`);
  }

  const data = (await res.json()) as { response?: string };
  return (data.response ?? "").trim();
}

/** Naive prompt translation hint — Pollinations prefers English prompts. */
export async function translatePromptForImage(prompt: string, signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `Translate the following marketing image brief into a concise, vivid English prompt for an image generator. Return only the prompt, no quotes, no preface.\n\n${prompt}`,
        stream: false,
      }),
      signal,
    });
    if (!res.ok) return prompt;
    const data = (await res.json()) as { response?: string };
    return (data.response ?? prompt).trim().replace(/^["']|["']$/g, "");
  } catch {
    return prompt;
  }
}

export function buildPollinationsUrl(prompt: string, opts: { width?: number; height?: number; seed?: number } = {}) {
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
