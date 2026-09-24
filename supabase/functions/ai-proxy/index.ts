import {
  authenticate,
  json,
  preflight,
  publicError,
  readJson,
  requirePost,
  runInBackground,
} from "../_shared/http.ts";

type ChatRole = "system" | "user" | "assistant";
type ProviderName = "omniroute" | "groq" | "gemini" | "cloudflare" | "ollama";

type ProxyMessage = { role?: string; content?: unknown };

interface ProxyBody {
  messages?: ProxyMessage[];
  action?: string;
  stage?: "discovery" | "content";
  temperature?: number;
  max_tokens?: number;
  response_format?: { type?: string };
  request_id?: string;
  preferred_provider?: ProviderName;
}

interface AuthorizationResult {
  ok: boolean;
  code: string;
  credits_remaining: number;
  credit_cost: number;
  plan: string;
  allowed_formats: string[];
  organization_id: string;
}

interface ProviderResult {
  provider: ProviderName;
  model: string;
  content: string;
  usage: { prompt_tokens?: number; completion_tokens?: number };
}

interface ProviderAttempt {
  name: ProviderName;
  model: string;
  execute: () => Promise<ProviderResult>;
}

interface ProviderFailure {
  provider: ProviderName;
  model: string;
  code: string;
}

const ACTIONS = new Set([
  "banner",
  "email",
  "social",
  "whatsapp",
  "technical_sheet",
  "blog",
  "reel",
  "video",
  "slides",
  "podcast",
  "chat",
  "discovery",
]);

const SHORT_STRUCTURED_ACTIONS = new Set([
  "email",
  "social",
  "whatsapp",
  "discovery",
  "chat",
]);

function env(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function safeEndpoint(raw: string): string {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("provider_endpoint_invalid");
  }
  if (
    url.protocol !== "https:" &&
    Deno.env.get("ENVIRONMENT") === "production"
  ) {
    throw new Error("provider_endpoint_insecure");
  }
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeJsonContent(content: string): string | null {
  const stripped = content
    .trim()
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [stripped];
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(stripped.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.stringify(JSON.parse(candidate));
    } catch {
      // Never heuristically repair malformed JSON because campaign facts could change.
    }
  }
  return null;
}

function normalizeMessages(
  rawMessages: ProxyMessage[],
): Array<{ role: ChatRole; content: string }> {
  const messages: Array<{ role: ChatRole; content: string }> = [];
  let totalCharacters = 0;

  for (const message of rawMessages) {
    if (
      !message ||
      !["system", "user", "assistant"].includes(String(message.role))
    ) {
      throw new Error("invalid_messages");
    }

    const role = message.role as ChatRole;
    const content = String(message.content ?? "").trim();
    if (!content && role === "assistant") continue;
    if (!content || content.length > 32_000)
      throw new Error("invalid_messages");

    totalCharacters += content.length;
    messages.push({ role, content });
  }

  if (messages.length === 0) throw new Error("invalid_messages");
  if (totalCharacters > 64_000) throw new Error("prompt_too_large");
  return messages;
}

async function performOpenAiRequest(options: {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: ChatRole; content: string }>;
  temperature: number;
  maxTokens: number;
  jsonMode: boolean;
  supportsResponseFormat?: boolean;
  extraHeaders?: Record<string, string>;
  signal: AbortSignal;
}): Promise<Response> {
  return fetch(safeEndpoint(options.endpoint), {
    method: "POST",
    signal: options.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
      ...options.extraHeaders,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      ...(options.jsonMode && options.supportsResponseFormat !== false
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });
}

async function openAiRequest(options: {
  provider: ProviderName;
  endpoint: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: ChatRole; content: string }>;
  temperature: number;
  maxTokens: number;
  jsonMode: boolean;
  supportsResponseFormat?: boolean;
  extraHeaders?: Record<string, string>;
}): Promise<ProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);

  try {
    let response = await performOpenAiRequest({
      ...options,
      signal: controller.signal,
    });

    if (response.status === 413 && options.maxTokens > 1024) {
      response = await performOpenAiRequest({
        ...options,
        maxTokens: 1024,
        signal: controller.signal,
      });
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delayMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(4_000, Math.max(750, retryAfter * 1_000))
          : 1_500;
      await sleep(delayMs);
      response = await performOpenAiRequest({
        ...options,
        maxTokens: Math.min(options.maxTokens, 1536),
        signal: controller.signal,
      });
    }

    if (!response.ok)
      throw new Error(`${options.provider}_http_${response.status}`);

    const raw = await response.text();
    if (raw.length > 2_000_000) throw new Error("provider_response_too_large");

    const payload = JSON.parse(raw) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const received = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!received) throw new Error(`${options.provider}_empty_response`);

    const content = options.jsonMode
      ? normalizeJsonContent(received)
      : received;
    if (!content) throw new Error(`${options.provider}_invalid_json`);

    return {
      provider: options.provider,
      model: payload.model ?? options.model,
      content,
      usage: payload.usage ?? {},
    };
  } finally {
    clearTimeout(timeout);
  }
}

function cloudflareJsonMessages(
  messages: Array<{ role: ChatRole; content: string }>,
  jsonMode: boolean,
): Array<{ role: ChatRole; content: string }> {
  if (!jsonMode) return messages;

  const instruction =
    "Return only the requested valid JSON object. Do not use markdown fences, commentary, or prose outside the JSON.";
  const next = messages.map((message) => ({ ...message }));
  const systemIndex = next.findIndex((message) => message.role === "system");
  if (systemIndex >= 0) {
    next[systemIndex] = {
      ...next[systemIndex],
      content: `${next[systemIndex].content}\n\n${instruction}`,
    };
  } else {
    next.unshift({ role: "system", content: instruction });
  }
  return next;
}

async function cloudflareRequest(options: {
  accountId: string;
  apiToken: string;
  model: string;
  messages: Array<{ role: ChatRole; content: string }>;
  temperature: number;
  maxTokens: number;
  jsonMode: boolean;
}): Promise<ProviderResult> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}/ai/run/${options.model}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);

  try {
    const request = async (): Promise<Response> =>
      fetch(safeEndpoint(endpoint), {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${options.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: cloudflareJsonMessages(options.messages, options.jsonMode),
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        }),
      });

    let response = await request();
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delayMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(4_000, Math.max(750, retryAfter * 1_000))
          : 1_250;
      await sleep(delayMs);
      response = await request();
    }

    if (!response.ok) throw new Error(`cloudflare_http_${response.status}`);

    const payload = (await response.json()) as {
      success?: boolean;
      result?:
        | string
        | {
            response?: string;
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const result = payload.result;
    const received =
      typeof result === "string"
        ? result.trim()
        : (result?.response?.trim() ??
          result?.choices?.[0]?.message?.content?.trim() ??
          "");
    if (!received) throw new Error("cloudflare_empty_response");

    const content = options.jsonMode
      ? normalizeJsonContent(received)
      : received;
    if (!content) throw new Error("cloudflare_invalid_json");

    return {
      provider: "cloudflare",
      model: options.model,
      content,
      usage:
        typeof result === "object" && result?.usage
          ? result.usage
          : (payload.usage ?? {}),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function ollamaRequest(options: {
  endpoint: string;
  model: string;
  messages: Array<{ role: ChatRole; content: string }>;
  temperature: number;
  maxTokens: number;
  jsonMode: boolean;
}): Promise<ProviderResult> {
  const base = safeEndpoint(options.endpoint).replace(/\/$/, "");
  const endpoint = base.endsWith("/api/chat") ? base : `${base}/api/chat`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: false,
        ...(options.jsonMode ? { format: "json" } : {}),
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
        },
      }),
    });
    if (!response.ok) throw new Error(`ollama_http_${response.status}`);

    const payload = (await response.json()) as {
      model?: string;
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const received = payload.message?.content?.trim() ?? "";
    if (!received) throw new Error("ollama_empty_response");

    const content = options.jsonMode
      ? normalizeJsonContent(received)
      : received;
    if (!content) throw new Error("ollama_invalid_json");

    return {
      provider: "ollama",
      model: payload.model ?? options.model,
      content,
      usage: {
        prompt_tokens: payload.prompt_eval_count,
        completion_tokens: payload.eval_count,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildAttempts(options: {
  action: string;
  stage: "discovery" | "content";
  preferred?: ProviderName;
  messages: Array<{ role: ChatRole; content: string }>;
  temperature: number;
  maxTokens: number;
  jsonMode: boolean;
}): ProviderAttempt[] {
  const attempts: ProviderAttempt[] = [];
  const shared = {
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    jsonMode: options.jsonMode,
  };

  const omnirouteKey = env("OMNIROUTE_API_KEY");
  const omnirouteUrl = env("OMNIROUTE_API_URL");
  const omnirouteModel =
    env(
      options.stage === "discovery"
        ? "OMNIROUTE_DISCOVERY_MODEL"
        : "OMNIROUTE_CONTENT_MODEL",
    ) ?? env("OMNIROUTE_MODEL");
  if (omnirouteKey && omnirouteUrl && omnirouteModel) {
    attempts.push({
      name: "omniroute",
      model: omnirouteModel,
      execute: () =>
        openAiRequest({
          ...shared,
          provider: "omniroute",
          endpoint: omnirouteUrl,
          apiKey: omnirouteKey,
          model: omnirouteModel,
        }),
    });
  }

  const groqKey = env("GROQ_API_KEY");
  const groqAttempts: ProviderAttempt[] = [];
  if (groqKey) {
    const discoveryModel = env("GROQ_DISCOVERY_MODEL");
    const configuredModels =
      options.stage === "discovery"
        ? [discoveryModel]
        : [
            env("GROQ_PRIMARY_MODEL"),
            env("GROQ_SECOND_FALLBACK_MODEL"),
            discoveryModel,
          ];
    const models = [
      ...new Set(
        configuredModels.filter((value): value is string => Boolean(value)),
      ),
    ];

    for (const model of models) {
      groqAttempts.push({
        name: "groq",
        model,
        execute: () =>
          openAiRequest({
            ...shared,
            provider: "groq",
            endpoint: "https://api.groq.com/openai/v1/chat/completions",
            apiKey: groqKey,
            model,
          }),
      });
    }
  }

  const cloudflareAccountId = env("CLOUDFLARE_ACCOUNT_ID");
  const cloudflareToken = env("CLOUDFLARE_API_TOKEN");
  const cloudflareModel =
    env("CLOUDFLARE_TEXT_MODEL") ?? "@cf/zai-org/glm-4.7-flash";
  const cloudflareAttempt: ProviderAttempt | null =
    cloudflareAccountId && cloudflareToken
      ? {
          name: "cloudflare",
          model: cloudflareModel,
          execute: () =>
            cloudflareRequest({
              ...shared,
              accountId: cloudflareAccountId,
              apiToken: cloudflareToken,
              model: cloudflareModel,
            }),
        }
      : null;

  // Banner briefs can be substantially longer than the lightweight discovery
  // prompts. Try the preferred Groq model once, then immediately fall back to
  // Cloudflare's long-context model before spending time on other Groq routes.
  if (options.action === "banner" && options.stage === "content") {
    if (groqAttempts[0]) attempts.push(groqAttempts[0]);
    if (cloudflareAttempt) attempts.push(cloudflareAttempt);
    attempts.push(...groqAttempts.slice(1));
  } else {
    attempts.push(...groqAttempts);
    if (cloudflareAttempt) attempts.push(cloudflareAttempt);
  }

  const geminiKey = env("GEMINI_API_KEY");
  const geminiModel = env(
    options.stage === "discovery"
      ? "GEMINI_DISCOVERY_MODEL"
      : "GEMINI_CONTENT_MODEL",
  );
  if (geminiKey && geminiModel) {
    attempts.push({
      name: "gemini",
      model: geminiModel,
      execute: () =>
        openAiRequest({
          ...shared,
          provider: "gemini",
          endpoint:
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          apiKey: geminiKey,
          model: geminiModel,
          extraHeaders: { "x-goog-api-key": geminiKey },
        }),
    });
  }

  const ollamaUrl = env("OLLAMA_API_URL");
  const ollamaModel =
    env(
      options.stage === "discovery"
        ? "OLLAMA_DISCOVERY_MODEL"
        : "OLLAMA_CONTENT_MODEL",
    ) ?? env("OLLAMA_MODEL");
  if (ollamaUrl && ollamaModel) {
    attempts.push({
      name: "ollama",
      model: ollamaModel,
      execute: () =>
        ollamaRequest({ ...shared, endpoint: ollamaUrl, model: ollamaModel }),
    });
  }

  if (options.preferred) {
    attempts.sort(
      (a, b) =>
        Number(b.name === options.preferred) -
        Number(a.name === options.preferred),
    );
  }
  return attempts;
}

Deno.serve(async (req: Request) => {
  const optionsResponse = preflight(req);
  if (optionsResponse) return optionsResponse;

  const methodResponse = requirePost(req);
  if (methodResponse) return methodResponse;

  const startedAt = Date.now();
  let context: Awaited<ReturnType<typeof authenticate>> = null;
  let requestId = "";
  let authorized = false;
  let action = "chat";
  const providerFailures: ProviderFailure[] = [];

  try {
    context = await authenticate(req);
    if (!context) {
      return json(req, 401, {
        error: "unauthorized",
        message: "Sessão inválida.",
      });
    }

    const body = await readJson<ProxyBody>(req, 96_000);
    action = String(body.action ?? "chat").toLowerCase();
    if (!ACTIONS.has(action))
      return json(req, 400, { error: "invalid_action" });

    requestId = body.request_id?.trim() || crypto.randomUUID();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) {
      return json(req, 400, { error: "invalid_request_id" });
    }

    if (
      !Array.isArray(body.messages) ||
      body.messages.length === 0 ||
      body.messages.length > 32
    ) {
      return json(req, 400, { error: "invalid_messages" });
    }

    let messages: Array<{ role: ChatRole; content: string }>;
    try {
      messages = normalizeMessages(body.messages);
    } catch (error) {
      const code = error instanceof Error ? error.message : "invalid_messages";
      if (code === "prompt_too_large") return json(req, 413, { error: code });
      return json(req, 400, { error: "invalid_messages" });
    }

    const { data, error: authorizationError } = await context.service.rpc(
      "authorize_generation",
      {
        p_user_id: context.user.id,
        p_action: action,
        p_request_id: requestId,
        p_metadata: {
          stage: body.stage ?? "content",
          client_version: req.headers.get("X-Client-Version"),
        },
      },
    );
    if (authorizationError) throw new Error("authorization_failed");

    const authorization = (
      Array.isArray(data) ? data[0] : data
    ) as AuthorizationResult | null;
    if (!authorization?.ok) {
      const code = authorization?.code ?? "authorization_failed";
      const status =
        code === "rate_limit_exceeded"
          ? 429
          : ["insufficient_credits", "monthly_credit_limit_exceeded"].includes(
                code,
              )
            ? 402
            : code === "duplicate_request"
              ? 409
              : [
                    "format_not_allowed",
                    "subscription_inactive",
                    "membership_inactive",
                  ].includes(code)
                ? 403
                : 500;
      return json(req, status, {
        error: code,
        remaining: authorization?.credits_remaining ?? 0,
        allowed_formats: authorization?.allowed_formats ?? [],
      });
    }
    authorized = true;

    const stage = body.stage === "discovery" ? "discovery" : "content";
    const requestedTemperature = Number(body.temperature ?? 0.3);
    const requestedMaxTokens = Number(body.max_tokens ?? 4096);
    const temperature = Math.min(
      Math.max(
        Number.isFinite(requestedTemperature) ? requestedTemperature : 0.3,
        0,
      ),
      1.2,
    );
    const actionTokenCeiling =
      action === "banner"
        ? 1536
        : SHORT_STRUCTURED_ACTIONS.has(action)
          ? 4096
          : 8192;
    const maxTokens = Math.min(
      Math.max(
        Number.isFinite(requestedMaxTokens)
          ? Math.floor(requestedMaxTokens)
          : 4096,
        256,
      ),
      actionTokenCeiling,
    );
    const jsonMode = body.response_format?.type === "json_object";

    const attempts = buildAttempts({
      action,
      stage,
      preferred: [
        "omniroute",
        "groq",
        "gemini",
        "cloudflare",
        "ollama",
      ].includes(String(body.preferred_provider))
        ? body.preferred_provider
        : undefined,
      messages,
      temperature,
      maxTokens,
      jsonMode,
    });
    if (attempts.length === 0) throw new Error("no_provider_configured");

    let result: ProviderResult | null = null;
    let attemptIndex = -1;
    for (const [index, attempt] of attempts.entries()) {
      try {
        result = await attempt.execute();
        attemptIndex = index;
        break;
      } catch (error) {
        const code = error instanceof Error ? error.message : "provider_failed";
        providerFailures.push({
          provider: attempt.name,
          model: attempt.model,
          code,
        });
        console.warn(
          JSON.stringify({
            event: "ai_provider_failed",
            provider: attempt.name,
            model: attempt.model,
            code,
          }),
        );
      }
    }
    if (!result) throw new Error("all_providers_failed");

    const latencyMs = Date.now() - startedAt;
    runInBackground(
      "ai_usage_log",
      context.service.from("ai_usage_log").insert({
        organization_id: authorization.organization_id,
        user_id: context.user.id,
        request_id: requestId,
        action,
        provider: result.provider,
        model: result.model,
        prompt_tokens: result.usage.prompt_tokens ?? null,
        completion_tokens: result.usage.completion_tokens ?? null,
        latency_ms: latencyMs,
        success: true,
      }),
    );

    return json(req, 200, {
      model: result.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: result.content },
          finish_reason: "stop",
        },
      ],
      usage: result.usage,
      _meta: {
        request_id: requestId,
        provider: result.provider,
        model: result.model,
        used_fallback: attemptIndex > 0,
        latency_ms: latencyMs,
        credits_remaining: authorization.credits_remaining,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "internal_error";
    const failureSummary = providerFailures
      .map((failure) => `${failure.provider}:${failure.model}:${failure.code}`)
      .join("|")
      .slice(-115);

    if (context && requestId && authorized) {
      await context.service.rpc("refund_generation", {
        p_user_id: context.user.id,
        p_request_id: requestId,
        p_reason: code,
      });
      await context.service.from("ai_usage_log").insert({
        user_id: context.user.id,
        request_id: requestId,
        action,
        provider: "none",
        model: "none",
        latency_ms: Date.now() - startedAt,
        success: false,
        error_code: failureSummary || code.slice(0, 120),
      });
    }

    const publicCode = [
      "invalid_json",
      "request_too_large",
      "invalid_messages",
    ].includes(code)
      ? code
      : code === "no_provider_configured"
        ? code
        : "all_providers_failed";
    const status = ["invalid_json", "invalid_messages"].includes(publicCode)
      ? 400
      : publicCode === "request_too_large"
        ? 413
        : publicCode === "no_provider_configured"
          ? 503
          : 502;

    const exposeProviderFailures = Deno.env.get("ENVIRONMENT") !== "production";
    return json(req, status, {
      error: publicCode,
      message: publicError(error),
      request_id: requestId || undefined,
      ...(exposeProviderFailures
        ? {
            provider_failures: providerFailures.map(
              ({ provider, model, code: failureCode }) => ({
                provider,
                model,
                code: failureCode,
              }),
            ),
          }
        : {}),
    });
  }
});
