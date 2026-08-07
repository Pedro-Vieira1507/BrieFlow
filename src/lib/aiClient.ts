// src/lib/aiClient.ts
//
// Client único de IA do BrieFlow.
//
// Decisões de arquitetura:
// 1. UM ponto de entrada: `generateCompletion({ system, user, schema })`.
//    Trocar de modelo/provider = mexer só neste arquivo.
// 2. Providers em cadeia: OmniRoute (nuvem, formato OpenAI) e Ollama (local).
//    A ordem vem de `resolveProviders()`; se o primeiro falhar, cai para o
//    próximo automaticamente. Adicionar um terceiro provider é adicionar uma
//    entrada nessa lista.
// 3. Saída estruturada opcional: se um schema Zod é passado, o client pede
//    JSON ao modelo, extrai o objeto (mesmo truncado/sujo) e valida.
//    O chamador recebe dados tipados ou um erro claro — nunca `any`.

import type { ZodType } from "zod";

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
  /** Texto bruto retornado pelo modelo. */
  raw: string;
  /** Dados validados quando `schema` é informado. */
  data: T;
  meta: AiCompletionMeta;
}

export interface GenerateCompletionOptions<T> {
  system: string;
  user: string;
  /** Histórico opcional inserido entre system e user. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Quando presente, força JSON e valida a resposta. */
  schema?: ZodType<T>;
  /** Streaming de texto parcial (só faz sentido sem schema). */
  onToken?: (partial: string) => void;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  requestId?: string;
  signal?: AbortSignal;
}

export class AiClientError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NO_PROVIDER"
      | "PROVIDER_FAILED"
      | "TIMEOUT"
      | "INVALID_OUTPUT",
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

// --- Configuração ------------------------------------------------------------

interface ProviderConfig {
  name: AiProviderName;
  model: string;
}

const env = import.meta.env;

function omniRouteConfig(): (ProviderConfig & {
  apiKey: string;
  apiUrl: string;
}) | null {
  const apiKey = env["VITE_OMNIROUTE_API_KEY"] as string | undefined;
  if (!apiKey) return null;

  return {
    name: "omniroute",
    apiKey,
    apiUrl:
      (env["VITE_OMNIROUTE_API_URL"] as string | undefined) ??
      "http://localhost:20128/v1/chat/completions",
    model: (env["VITE_OMNIROUTE_MODEL"] as string | undefined) ?? "gpt-4o-mini",
  };
}

function ollamaConfig(structured: boolean): ProviderConfig & { apiUrl: string } {
  const configured = env["VITE_OLLAMA_API_URL"] as string | undefined;
  const base = configured
    ? configured
        .replace("/v1/chat/completions", "")
        .replace("/api/chat", "")
        .replace(/\/$/, "")
    : typeof window !== "undefined"
      ? `http://${window.location.hostname}:11434`
      : "http://localhost:11434";

  const discovery =
    (env["VITE_OLLAMA_DISCOVERY_MODEL"] as string | undefined) ?? "qwen2.5:7b";
  const execution =
    (env["VITE_OLLAMA_EXECUTION_MODEL"] as string | undefined) ?? "qwen2.5:7b";

  return {
    name: "ollama",
    apiUrl: `${base}/api/chat`,
    model: structured ? execution : discovery,
  };
}

/** `true` quando a nuvem está configurada — útil para UI/telemetria. */
export function isCloudProviderConfigured(): boolean {
  return omniRouteConfig() !== null;
}

// --- Utilitários de JSON ----------------------------------------------------

/** Extrai o primeiro objeto JSON balanceado; fecha chaves se vier truncado. */
export function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return depth > 0 ? text.slice(start) + "}".repeat(depth) : null;
}

function parseJsonLoosely(text: string): unknown | null {
  if (!text.trim()) return null;

  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const candidates = [
    cleaned,
    cleaned.replace(/[\n\r\t]/g, " ").replace(/,\s*([}\]])/g, "$1"),
  ];

  const balanced = extractBalancedJson(candidates[1] ?? cleaned);
  if (balanced) candidates.push(balanced, balanced.replace(/,\s*([}\]])/g, "$1"));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      /* tenta o próximo formato */
    }
  }

  return null;
}

/** Lê o valor de uma chave string mesmo com JSON ainda incompleto (streaming). */
export function extractPartialString(rawJson: string, key: string): string | null {
  const match = rawJson.match(new RegExp(`"${key}"\\s*:\\s*"`));
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  const escapes: Record<string, string> = {
    n: "\n",
    r: "\r",
    t: "\t",
    '"': '"',
    "\\": "\\",
  };

  let result = "";
  let escaped = false;

  for (let index = start; index < rawJson.length; index += 1) {
    const character = rawJson[index] ?? "";
    if (escaped) {
      result += escapes[character] ?? character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') return result;
    result += character;
  }

  return result || null;
}

// --- Chamadas por provider ---------------------------------------------------

type ChatPayload = { role: "system" | "user" | "assistant"; content: string }[];

async function readSse(
  body: ReadableStream<Uint8Array>,
  onChunk: (delta: string) => void,
  parseLine: (line: string) => string | null,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let full = "";
  let pending = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      const delta = parseLine(line.trim());
      if (delta) {
        full += delta;
        onChunk(full);
      }
    }
  }

  const tail = pending + decoder.decode();
  const tailDelta = tail.trim() ? parseLine(tail.trim()) : null;
  if (tailDelta) {
    full += tailDelta;
    onChunk(full);
  }

  return full;
}

async function callOmniRoute<T>(
  config: NonNullable<ReturnType<typeof omniRouteConfig>>,
  messages: ChatPayload,
  options: GenerateCompletionOptions<T>,
  signal: AbortSignal,
): Promise<string> {
  const structured = Boolean(options.schema);

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: !structured,
      temperature: options.temperature ?? (structured ? 0.2 : 0.35),
      max_tokens: options.maxTokens ?? (structured ? 4000 : 1500),
      response_format: { type: "json_object" },
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "sem detalhes");
    throw new Error(`OmniRoute HTTP ${response.status}: ${detail}`);
  }

  if (structured) {
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (!response.body) throw new Error("OmniRoute não retornou stream.");

  return readSse(
    response.body,
    (partial) => options.onToken?.(partial),
    (line) => {
      if (!line || line === "data: [DONE]" || !line.startsWith("data: ")) return null;
      try {
        const chunk = JSON.parse(line.slice(6)) as {
          choices?: { delta?: { content?: string } }[];
        };
        return chunk.choices?.[0]?.delta?.content ?? null;
      } catch {
        return null;
      }
    },
  );
}

async function callOllama<T>(
  config: ReturnType<typeof ollamaConfig>,
  messages: ChatPayload,
  options: GenerateCompletionOptions<T>,
  signal: AbortSignal,
): Promise<string> {
  const structured = Boolean(options.schema);

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: !structured,
      format: "json",
      keep_alive: "30m",
      options: {
        temperature: options.temperature ?? (structured ? 0.2 : 0.35),
        top_p: 0.85,
        num_predict: options.maxTokens ?? (structured ? 4000 : 1500),
        num_ctx: 4096,
      },
    }),
    signal,
  });

  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);

  if (structured) {
    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content ?? "";
  }

  if (!response.body) throw new Error("Ollama não retornou stream.");

  return readSse(
    response.body,
    (partial) => options.onToken?.(partial),
    (line) => {
      if (!line) return null;
      try {
        const chunk = JSON.parse(line) as { message?: { content?: string } };
        return chunk.message?.content ?? null;
      } catch {
        return null;
      }
    },
  );
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `bf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// --- API pública -------------------------------------------------------------

/**
 * Executa uma completion na cadeia de providers configurada.
 *
 * Sem `schema`: devolve texto (e faz streaming via `onToken`).
 * Com `schema`: força JSON, extrai/normaliza e valida — `data` vem tipado.
 */
export async function generateCompletion<T = string>(
  options: GenerateCompletionOptions<T>,
): Promise<AiCompletionResult<T>> {
  const startedAt = Date.now();
  const requestId = options.requestId ?? createRequestId();
  const structured = Boolean(options.schema);

  const messages: ChatPayload = [
    { role: "system", content: options.system },
    ...(options.history ?? []),
    { role: "user", content: options.user },
  ];

  const cloud = omniRouteConfig();
  const local = ollamaConfig(structured);
  const providers = cloud ? [cloud, local] : [local];

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller);
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? (structured ? 240_000 : 180_000),
  );

  const failures: string[] = [];

  try {
    for (const [index, provider] of providers.entries()) {
      try {
        const raw =
          provider.name === "omniroute"
            ? await callOmniRoute(
                provider as NonNullable<ReturnType<typeof omniRouteConfig>>,
                messages,
                options,
                controller.signal,
              )
            : await callOllama(local, messages, options, controller.signal);

        const meta: AiCompletionMeta = {
          requestId,
          provider: provider.name,
          model: provider.model,
          usedFallback: index > 0,
          latencyMs: Date.now() - startedAt,
          generatedAt: new Date().toISOString(),
        };

        if (!options.schema) {
          return { raw, data: raw as unknown as T, meta };
        }

        const parsed = parseJsonLoosely(raw);
        if (parsed === null) {
          throw new AiClientError(
            "A IA não devolveu um JSON utilizável.",
            "INVALID_OUTPUT",
          );
        }

        const validated = options.schema.safeParse(parsed);
        if (!validated.success) {
          throw new AiClientError(
            `Resposta fora do formato esperado: ${validated.error.issues
              .map((issue) => issue.path.join(".") || "root")
              .join(", ")}`,
            "INVALID_OUTPUT",
            validated.error,
          );
        }

        return { raw, data: validated.data, meta };
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") {
          throw new AiClientError(
            "Tempo excedido ao consultar a IA.",
            "TIMEOUT",
            error,
          );
        }

        failures.push(`${provider.name}: ${String(error)}`);
        const isLast = index === providers.length - 1;
        if (isLast) {
          if (error instanceof AiClientError) throw error;
          throw new AiClientError(
            `Nenhum provider de IA respondeu. ${failures.join(" | ")}`,
            "PROVIDER_FAILED",
            error,
          );
        }
        console.warn(
          `[aiClient] ${provider.name} falhou, acionando fallback local.`,
          error,
        );
      }
    }

    throw new AiClientError("Nenhum provider configurado.", "NO_PROVIDER");
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
