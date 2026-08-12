// src/lib/aiClient.ts
//
// Client de IA do BrieFlow — todas as chamadas passam pelo edge function ai-proxy.
// Nenhuma chave de API de LLM é exposta no bundle do cliente.
//
// Interface pública idêntica à versão anterior para zero breaking changes:
// `generateCompletion({ system, user, schema, onToken, ... })`

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
  creditsRemaining?: number;
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
  action?: string;
}

export class AiClientError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NO_PROVIDER"
      | "PROVIDER_FAILED"
      | "TIMEOUT"
      | "INVALID_OUTPUT"
      | "UNAUTHORIZED"
      | "INSUFFICIENT_CREDITS"
      | "RATE_LIMITED",
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`;

function buildMessages(
  system: string,
  user: string,
  history?: { role: "user" | "assistant"; content: string }[],
  hasSchema?: boolean,
): { role: string; content: string }[] {
  const systemContent = hasSchema
    ? `${system}\n\nResposta EXCLUSIVAMENTE em JSON válido, sem markdown, sem texto fora do objeto.`
    : system;
  return [
    { role: "system", content: systemContent },
    ...(history ?? []),
    { role: "user", content: user },
  ];
}

function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) return fence[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace)
    return raw.slice(firstBrace, lastBrace + 1);
  return raw.trim();
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
    requestId = crypto.randomUUID(),
    signal,
    action = "chat",
  } = opts;

  // Get session token for the proxy
  const session = supabase ? await supabase.auth.getSession() : null;
  const token = session?.data?.session?.access_token;
  if (!token) {
    throw new AiClientError(
      "Faça login para usar a geração de IA.",
      "UNAUTHORIZED",
    );
  }

  const messages = buildMessages(system, user, history, Boolean(schema));

  const body: Record<string, unknown> = {
    messages,
    action,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 4096,
    request_id: requestId,
  };
  if (schema) body.response_format = { type: "json_object" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const combinedSignal = signal ?? controller.signal;

  let response: Response;
  const startMs = Date.now();
  try {
    response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Client-Info": "brieflow/1.0",
      },
      body: JSON.stringify(body),
      signal: combinedSignal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error)?.name === "AbortError") {
      throw new AiClientError("A IA demorou demais para responder.", "TIMEOUT", err);
    }
    throw new AiClientError("Não foi possível conectar ao servidor.", "PROVIDER_FAILED", err);
  } finally {
    clearTimeout(timeout);
  }

  const latencyMs = Date.now() - startMs;

  if (!response.ok) {
    let errBody: Record<string, unknown> = {};
    try { errBody = await response.json(); } catch { /* ignore */ }
    const errCode = String(errBody.error ?? "");
    if (response.status === 401) {
      throw new AiClientError("Sessão expirada. Faça login novamente.", "UNAUTHORIZED", errBody);
    }
    if (response.status === 402) {
      throw new AiClientError(
        errCode === "subscription_past_due"
          ? "Sua assinatura está com pagamento pendente."
          : "Créditos insuficientes para esta geração.",
        "INSUFFICIENT_CREDITS",
        errBody,
      );
    }
    if (response.status === 429) {
      throw new AiClientError("Muitas requisições em pouco tempo. Aguarde um momento.", "RATE_LIMITED", errBody);
    }
    throw new AiClientError(
      `Erro no servidor de IA (${response.status}).`,
      "PROVIDER_FAILED",
      errBody,
    );
  }

  const json = await response.json() as Record<string, unknown>;
  const meta = (json._meta ?? {}) as {
    request_id?: string;
    provider?: string;
    used_fallback?: boolean;
    latency_ms?: number;
    credits_remaining?: number;
  };

  const choice = (json.choices as { message: { content: string } }[] | undefined)?.[0];
  if (!choice?.message?.content) {
    throw new AiClientError("Resposta vazia do modelo.", "INVALID_OUTPUT", json);
  }
  const raw = choice.message.content;

  if (!schema) {
    return {
      raw,
      data: raw as unknown as T,
      meta: {
        requestId,
        provider: (meta.provider ?? "omniroute") as AiProviderName,
        model: String(json.model ?? "unknown"),
        usedFallback: meta.used_fallback ?? false,
        latencyMs: meta.latency_ms ?? latencyMs,
        generatedAt: new Date().toISOString(),
        creditsRemaining: meta.credits_remaining,
      },
    };
  }

  const jsonStr = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new AiClientError(
      "A IA respondeu num formato inesperado.",
      "INVALID_OUTPUT",
      { raw, jsonStr },
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AiClientError(
      "Dados gerados não passaram na validação.",
      "INVALID_OUTPUT",
      { issues: result.error.issues, parsed },
    );
  }

  return {
    raw,
    data: result.data,
    meta: {
      requestId,
      provider: (meta.provider ?? "omniroute") as AiProviderName,
      model: String(json.model ?? "unknown"),
      usedFallback: meta.used_fallback ?? false,
      latencyMs: meta.latency_ms ?? latencyMs,
      generatedAt: new Date().toISOString(),
      creditsRemaining: meta.credits_remaining,
    },
  };
}
