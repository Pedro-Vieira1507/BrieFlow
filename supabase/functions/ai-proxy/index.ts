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
type ProviderName = "omniroute" | "groq" | "gemini" | "ollama";

interface ProxyBody {
  messages?: Array<{ role?: string; content?: unknown }>;
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

interface ProviderAttempt {
  name: ProviderName;
  model: string;
  execute: () => Promise<ProviderResult>;
}

interface ProviderResult {
  provider: ProviderName;
  model: string;
  content: string;
  usage: { prompt_tokens?: number; completion_tokens?: number };
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

function isValidJsonContent(content: string): boolean {
  const normalized = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    JSON.parse(normalized);
    return true;
  } catch {
    return false;
  }
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
  extraHeaders?: Record<string, string>;
}): Promise<ProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    const response = await fetch(safeEndpoint(options.endpoint), {
      method: "POST",
      signal: controller.signal,
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
        ...(options.jsonMode
          ? { response_format: { type: "json_object" } }
          : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`${options.provider}_http_${response.status}`);
    }
    const raw = await response.text();
    if (raw.length > 2_000_000) throw new Error("provider_response_too_large");
    const payload = JSON.parse(raw) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) throw new Error(`${options.provider}_empty_response`);
    if (options.jsonMode && !isValidJsonContent(content)) {
      throw new Error(`${options.provider}_invalid_json`);
    }
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
    const content = payload.message?.content?.trim() ?? "";
    if (!content) throw new Error("ollama_empty_response");
    if (options.jsonMode && !isValidJsonContent(content))
      throw new Error("ollama_invalid_json");
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
  if (groqKey) {
    const modelNames =
      options.stage === "discovery"
        ? [env("GROQ_DISCOVERY_MODEL")]
        : [
            env("GROQ_PRIMARY_MODEL"),
            env("GROQ_FIRST_FALLBACK_MODEL"),
            env("GROQ_SECOND_FALLBACK_MODEL"),
          ];
    for (const model of [
      ...new Set(modelNames.filter((value): value is string => Boolean(value))),
    ]) {
      attempts.push({
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

  try {
    context = await authenticate(req);
    if (!context)
      return json(req, 401, {
        error: "unauthorized",
        message: "Sessão inválida.",
      });

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
    let totalCharacters = 0;
    const messages = body.messages.map((message) => {
      if (
        !message ||
        !["system", "user", "assistant"].includes(String(message.role))
      ) {
        throw new Error("invalid_messages");
      }
      const content = String(message.content ?? "").trim();
      if (!content || content.length > 32_000)
        throw new Error("invalid_messages");
      totalCharacters += content.length;
      return { role: message.role as ChatRole, content };
    });
    if (totalCharacters > 64_000)
      return json(req, 413, { error: "prompt_too_large" });

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
          : code === "insufficient_credits"
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
    const maxTokens = Math.min(
      Math.max(
        Number.isFinite(requestedMaxTokens)
          ? Math.floor(requestedMaxTokens)
          : 4096,
        256,
      ),
      8192,
    );
    const jsonMode = body.response_format?.type === "json_object";
    const attempts = buildAttempts({
      stage,
      preferred: ["omniroute", "groq", "gemini", "ollama"].includes(
        String(body.preferred_provider),
      )
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
    const logPromise = context.service.from("ai_usage_log").insert({
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
    });
    runInBackground("ai_usage_log", logPromise);

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
        error_code: code.slice(0, 120),
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
    return json(req, status, {
      error: publicCode,
      message: publicError(error),
    });
  }
});
