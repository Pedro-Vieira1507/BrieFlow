import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CREDIT_COSTS: Record<string, number> = {
  banner: 3,
  email: 3,
  social: 2,
  chat: 1,
  discovery: 1,
};

const BLOCKED_HOSTS = new Set([
  "localhost", "127.0.0.1", "0.0.0.0",
  "169.254.169.254", "metadata.google.internal", "100.100.100.200",
]);

function isBlockedUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (!["http:", "https:"].includes(u.protocol)) return true;
    const host = u.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return true;
    return false;
  } catch { return true; }
}

async function checkRateLimit(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneMinuteAgo);
  return (count ?? 0) < 20;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const omnirouteApiKey = Deno.env.get("OMNIROUTE_API_KEY");
  const omnirouteApiUrl = Deno.env.get("OMNIROUTE_API_URL");
  const omnirouteModel = Deno.env.get("OMNIROUTE_MODEL") ?? "groq/llama-3.3-70b-versatile";
  const ollamaApiUrl = Deno.env.get("OLLAMA_API_URL");
  const ollamaModel = Deno.env.get("OLLAMA_MODEL") ?? "qwen2.5:7b";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json() as {
      messages: { role: string; content: string }[];
      action?: string; model?: string; temperature?: number;
      max_tokens?: number; response_format?: { type: string };
      request_id?: string; preferred_provider?: "omniroute" | "ollama";
    };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeMessages = body.messages
      .filter((m) => ["system", "user", "assistant"].includes(m.role))
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 32_000) }));

    const action = (body.action ?? "chat").toLowerCase();
    const creditCost = CREDIT_COSTS[action] ?? 2;
    const requestId = body.request_id ?? crypto.randomUUID();

    const withinLimit = await checkRateLimit(serviceClient, user.id);
    if (!withinLimit) {
      return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: deductResult, error: deductError } = await serviceClient.rpc("deduct_credits", {
      p_user_id: user.id, p_amount: creditCost, p_action: action,
      p_metadata: { request_id: requestId },
    });

    if (deductError) {
      return new Response(JSON.stringify({ error: "credit_check_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const deduct = Array.isArray(deductResult) ? deductResult[0] : deductResult;
    if (!deduct?.ok) {
      return new Response(
        JSON.stringify({ error: deduct?.message ?? "insufficient_credits", remaining: deduct?.remaining ?? 0 }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tryOmniroute = async () => {
      if (!omnirouteApiKey || !omnirouteApiUrl) throw new Error("omniroute_not_configured");
      if (isBlockedUrl(omnirouteApiUrl)) throw new Error("omniroute_url_blocked");
      const payload: Record<string, unknown> = {
        model: body.model ?? omnirouteModel, messages: safeMessages,
        temperature: body.temperature ?? 0.7, max_tokens: body.max_tokens ?? 4096,
      };
      if (body.response_format) payload.response_format = body.response_format;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60_000);
      try {
        const res = await fetch(omnirouteApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${omnirouteApiKey}` },
          body: JSON.stringify(payload), signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!res.ok) throw new Error(`omniroute_http_${res.status}`);
        return { data: await res.json(), provider: "omniroute" as const };
      } finally { clearTimeout(t); }
    };

    const tryOllama = async () => {
      if (!ollamaApiUrl) throw new Error("ollama_not_configured");
      if (isBlockedUrl(ollamaApiUrl)) throw new Error("ollama_url_blocked");
      const endpoint = ollamaApiUrl.replace(/\/?$/, "") + "/api/chat";
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 90_000);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: ollamaModel, messages: safeMessages, stream: false, options: { temperature: body.temperature ?? 0.7 } }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!res.ok) throw new Error(`ollama_http_${res.status}`);
        const raw = await res.json();
        return {
          data: {
            id: `ollama-${crypto.randomUUID()}`, model: ollamaModel,
            choices: [{ index: 0, message: { role: "assistant", content: raw.message?.content ?? "" }, finish_reason: "stop" }],
            usage: { prompt_tokens: raw.prompt_eval_count ?? 0, completion_tokens: raw.eval_count ?? 0, total_tokens: (raw.prompt_eval_count ?? 0) + (raw.eval_count ?? 0) },
          },
          provider: "ollama" as const,
        };
      } finally { clearTimeout(t); }
    };

    let result: { data: Record<string, unknown>; provider: "omniroute" | "ollama" };
    let usedFallback = false;
    const startTime = Date.now();
    const preferred = body.preferred_provider ?? "omniroute";

    try {
      result = preferred === "omniroute" ? await tryOmniroute() : await tryOllama();
    } catch {
      try {
        result = preferred === "omniroute" ? await tryOllama() : await tryOmniroute();
        usedFallback = true;
      } catch {
        await serviceClient.rpc("deduct_credits", {
          p_user_id: user.id, p_amount: -creditCost,
          p_action: `${action}_refund`, p_metadata: { request_id: requestId, reason: "provider_failed" },
        });
        await serviceClient.from("ai_usage_log").insert({
          user_id: user.id, provider: "none", model: "none", action,
          success: false, error_code: "all_providers_failed", request_id: requestId,
          latency_ms: Date.now() - startTime,
        });
        return new Response(JSON.stringify({ error: "all_providers_failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const latencyMs = Date.now() - startTime;
    const usage = (result.data.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number };

    EdgeRuntime.waitUntil(serviceClient.from("ai_usage_log").insert({
      user_id: user.id, provider: result.provider,
      model: String(result.data.model ?? body.model ?? "unknown"),
      action, prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      latency_ms: latencyMs, success: true, request_id: requestId,
    }));

    return new Response(
      JSON.stringify({ ...result.data, _meta: { request_id: requestId, provider: result.provider, used_fallback: usedFallback, latency_ms: latencyMs, credits_remaining: deduct.remaining - creditCost } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
