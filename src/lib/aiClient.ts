import type { ZodType } from "zod";

import { EdgeFunctionError, invokeEdgeFunction } from "@/lib/supabase";
import { parseStructuredJson } from "@/lib/structuredOutput";
import type { MaterialType } from "@/types/brief";

export type AiProviderName = "omniroute" | "ollama" | "groq" | "gemini";
export type AiGenerationStage = "discovery" | "content";
export type AiAction = MaterialType | "chat" | "discovery" | "website_analysis";

export interface AiCompletionMeta {
  requestId: string;
  provider: string;
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
  provider?: AiProviderName;
  stage?: AiGenerationStage;
  action?: AiAction;
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
      | "FEATURE_NOT_AVAILABLE"
      | "RATE_LIMITED"
      | "DUPLICATE_REQUEST"
      | "WORKSPACE_SUSPENDED",
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

interface ProxyResponse {
  model?: string;
  choices?: Array<{
    message?: { content?: string };
  }>;
  message?: { content?: string };
  _meta?: {
    request_id?: string;
    provider?: string;
    model?: string;
    used_fallback?: boolean;
    latency_ms?: number;
    credits_remaining?: number;
  };
}

export interface RawAiRequest {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  action: AiAction;
  stage: AiGenerationStage;
  responseFormat?: "json" | "text";
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  requestId?: string;
  preferredProvider?: AiProviderName;
  signal?: AbortSignal;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `bf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapEdgeError(error: EdgeFunctionError): AiClientError {
  if (error.status === 401 || error.code === "unauthorized") {
    return new AiClientError(
      "Entre novamente para continuar.",
      "UNAUTHORIZED",
      error.detail,
    );
  }
  if (
    error.status === 402 ||
    error.code === "insufficient_credits" ||
    error.code === "credits_exhausted"
  ) {
    return new AiClientError(
      "Seus créditos deste ciclo terminaram.",
      "INSUFFICIENT_CREDITS",
      error.detail,
    );
  }
  if (error.code === "membership_inactive") {
    return new AiClientError(
      "Seu acesso a este workspace está suspenso.",
      "WORKSPACE_SUSPENDED",
      error.detail,
    );
  }
  if (error.status === 403 || error.code === "format_not_allowed") {
    return new AiClientError(
      "Este formato não está disponível no seu plano.",
      "FEATURE_NOT_AVAILABLE",
      error.detail,
    );
  }
  if (error.status === 429 || error.code === "rate_limit_exceeded") {
    return new AiClientError(
      "Muitas gerações em sequência. Aguarde um instante e tente novamente.",
      "RATE_LIMITED",
      error.detail,
    );
  }
  if (error.status === 409 || error.code === "duplicate_request") {
    return new AiClientError(
      "Esta solicitação já foi processada. Inicie uma nova geração.",
      "DUPLICATE_REQUEST",
      error.detail,
    );
  }
  if (error.code === "backend_not_configured") {
    return new AiClientError(error.message, "NO_PROVIDER", error.detail);
  }
  return new AiClientError(
    "Os provedores de IA estão temporariamente indisponíveis.",
    "PROVIDER_FAILED",
    error.detail,
  );
}

/**
 * Único ponto de saída do navegador para modelos de IA. Nenhuma chave de
 * provedor é enviada ao bundle; autenticação, plano, créditos, rate limit e
 * fallback são validados pela Edge Function.
 */
export async function requestAiCompletion(
  options: RawAiRequest,
): Promise<AiCompletionResult<string>> {
  const requestId = options.requestId ?? createRequestId();
  const timeoutMs = Math.min(
    Math.max(options.timeoutMs ?? 120_000, 5_000),
    300_000,
  );
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onParentAbort, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await invokeEdgeFunction<ProxyResponse>(
      "ai-proxy",
      {
        messages: options.messages,
        action: options.action,
        stage: options.stage,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format:
          options.responseFormat === "json"
            ? { type: "json_object" }
            : undefined,
        request_id: requestId,
        preferred_provider: options.preferredProvider,
      },
      controller.signal,
    );

    const raw =
      response.choices?.[0]?.message?.content ??
      response.message?.content ??
      "";
    if (!raw) {
      throw new AiClientError(
        "A IA retornou uma resposta vazia.",
        "INVALID_OUTPUT",
      );
    }

    const meta = response._meta;
    return {
      raw,
      data: raw,
      meta: {
        requestId: meta?.request_id ?? requestId,
        provider: meta?.provider ?? "unknown",
        model: meta?.model ?? response.model ?? "unknown",
        usedFallback: Boolean(meta?.used_fallback),
        latencyMs: meta?.latency_ms ?? Date.now() - startedAt,
        generatedAt: new Date().toISOString(),
        creditsRemaining: meta?.credits_remaining,
      },
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AiClientError(
        "A IA demorou demais para responder.",
        "TIMEOUT",
        error,
      );
    }
    if (error instanceof AiClientError) throw error;
    if (error instanceof EdgeFunctionError) throw mapEdgeError(error);
    throw new AiClientError(
      "Não foi possível concluir a geração.",
      "PROVIDER_FAILED",
      error,
    );
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onParentAbort);
  }
}

export async function generateCompletion<T = string>(
  options: GenerateCompletionOptions<T>,
): Promise<AiCompletionResult<T>> {
  const messages = [
    {
      role: "system" as const,
      content: options.schema
        ? `${options.system}\n\nResponda EXCLUSIVAMENTE em JSON válido.`
        : options.system,
    },
    ...(options.history ?? []),
    { role: "user" as const, content: options.user },
  ];

  const result = await requestAiCompletion({
    messages,
    action:
      options.action ?? (options.stage === "discovery" ? "discovery" : "chat"),
    stage: options.stage ?? "content",
    responseFormat: options.schema ? "json" : "text",
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    timeoutMs: options.timeoutMs,
    requestId: options.requestId,
    preferredProvider: options.provider,
    signal: options.signal,
  });

  options.onToken?.(result.raw);

  if (!options.schema) {
    return {
      ...result,
      data: result.raw as unknown as T,
    };
  }

  const parsed = parseStructuredJson(result.raw);
  if (parsed === null) {
    throw new AiClientError(
      "O modelo não retornou um JSON válido.",
      "INVALID_OUTPUT",
    );
  }

  const validated = options.schema.safeParse(parsed);
  if (!validated.success) {
    throw new AiClientError(
      "A resposta não cumpriu o contrato deste formato.",
      "INVALID_OUTPUT",
      validated.error.issues,
    );
  }

  return {
    ...result,
    data: validated.data,
  };
}
