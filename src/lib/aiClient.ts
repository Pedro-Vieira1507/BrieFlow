// src/lib/aiClient.ts
import type { ZodType } from "zod";
import { supabase } from "@/lib/supabase";

export type AiProviderName = "omniroute" | "ollama";

export interface AiCompletionMeta {
  requestId: string;
  provider: AiProviderName;
  model: string;
  usedFallback: boolean;
  latencyMs: number;
  generatedAt: string;
}

export interface AiCompletionResult<T> {
  raw: string;
  data: T;
  meta: AiCompletionMeta;
}

export interface GenerateCompletionOptions<T> {
  system: string;
  user: string;
  history?: { role: "user" | "assistant"; content: string }[];
  schema?: ZodType<T>;
  onToken?: (partial: string) => void;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  requestId?: string;
  signal?: AbortSignal;
  provider?: AiProviderName;
}

export class AiClientError extends Error {
  constructor(
    message: string,
    readonly code: "NO_PROVIDER" | "PROVIDER_FAILED" | "TIMEOUT" | "INVALID_OUTPUT" | "UNAUTHORIZED" | "INSUFFICIENT_CREDITS",
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

export async function generateCompletion<T = string>(
  opts: GenerateCompletionOptions<T>,
): Promise<AiCompletionResult<T>> {
  const { 
    system, 
    user, 
    history, 
    schema, 
    temperature, 
    maxTokens, 
    timeoutMs = 90_000, 
    requestId = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `req_${Date.now()}`, 
    signal,
    provider = "omniroute" 
  } = opts;

  // 1. VERIFICA E DEDUZ CRÉDITOS DIRETAMENTE NO BANCO DE DADOS
  if (supabase) {
    const { data: session } = await supabase.auth.getSession();
    if (session?.session) {
      const { data: success, error } = await supabase.rpc("deduct_user_credit", { cost: 1 });
      if (error || !success) {
        throw new AiClientError("Créditos insuficientes para esta geração.", "INSUFFICIENT_CREDITS");
      }
    }
  }

  const messages = [
    { role: "system", content: schema ? `${system}\n\nResponda EXCLUSIVAMENTE em JSON válido.` : system },
    ...(history ?? []),
    { role: "user", content: user },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const combinedSignal = signal ?? controller.signal;
  const startMs = Date.now();

  let response: Response;

  // 2. ROTEAMENTO PARA OLLAMA LOCAL
  if (provider === "ollama") {
    const ollamaUrl = import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434/api/chat";
    const ollamaModel = import.meta.env.VITE_OLLAMA_EXECUTION_MODEL || import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:7b";

    try {
      response = await fetch(ollamaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel, // <-- Lendo modelo correto do seu .env
          messages,
          stream: false,
          format: schema ? "json" : undefined,
          options: {
            temperature: temperature ?? 0.7,
            num_predict: maxTokens ?? 4096
          }
        }),
        signal: combinedSignal,
      });
    } catch (err) {
      clearTimeout(timeout);
      throw new AiClientError("Erro de conexão com o Ollama local.", "PROVIDER_FAILED", err);
    }
  } 
  
  // 3. ROTEAMENTO OMNIROUTE
  else {
    const apiKey = import.meta.env.VITE_OMNIROUTE_API_KEY;
    const apiUrl = import.meta.env.VITE_OMNIROUTE_API_URL || "https://api.openai.com/v1/chat/completions";
    const model = import.meta.env.VITE_OMNIROUTE_MODEL || "gpt-4o-mini";
    
    if (!apiKey) throw new AiClientError("API Key não configurada no .env", "NO_PROVIDER");
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 4096,
          stream: false,
          response_format: schema ? { type: "json_object" } : undefined,
        }),
        signal: combinedSignal,
      });
    } catch (err) {
      clearTimeout(timeout);
      throw new AiClientError("Erro de conexão com a API de IA.", "PROVIDER_FAILED", err);
    }
  }

  clearTimeout(timeout);

  if (!response.ok) throw new AiClientError(`Erro na API (${response.status})`, "PROVIDER_FAILED");

  const json = await response.json();
  const raw = provider === "ollama" ? json.message?.content : json.choices?.[0]?.message?.content;

  if (!raw) throw new AiClientError("Resposta vazia.", "INVALID_OUTPUT");

  if (!schema) {
    return {
      raw,
      data: raw as unknown as T,
      meta: { requestId, provider, model: "mixed", usedFallback: true, latencyMs: Date.now() - startMs, generatedAt: new Date().toISOString() },
    };
  }

  const jsonStr = raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() || raw.trim();
  let parsed: unknown;
  try {
     parsed = JSON.parse(jsonStr);
  } catch {
     throw new AiClientError("JSON inválido", "INVALID_OUTPUT");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) throw new AiClientError("Validação Zod falhou", "INVALID_OUTPUT", result.error.issues);

  return {
    raw,
    data: result.data,
    meta: { requestId, provider, model: "mixed", usedFallback: true, latencyMs: Date.now() - startMs, generatedAt: new Date().toISOString() },
  };
}