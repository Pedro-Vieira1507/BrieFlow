import { createClient, type User } from "npm:@supabase/supabase-js@2";

export interface RequestContext {
  user: User;
  service: ReturnType<typeof createClient>;
}

const configuredOrigins = (() => {
  const values = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const appUrl = Deno.env.get("APP_URL");
  if (appUrl) {
    try {
      values.push(new URL(appUrl).origin);
    } catch {
      // Invalid deployment configuration is reported by the billing function.
    }
  }
  return new Set(values);
})();

function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  if (configuredOrigins.has(origin)) return origin;
  if (
    configuredOrigins.size === 0 &&
    Deno.env.get("ENVIRONMENT") !== "production"
  ) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin))
      return origin;
  }
  return null;
}

export function responseHeaders(req: Request): HeadersInit {
  const origin = allowedOrigin(req);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-version, x-request-id",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
}

export function json(
  req: Request,
  status: number,
  payload: unknown,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...responseHeaders(req), ...extraHeaders },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigin(req)) {
    return json(req, 403, { error: "origin_not_allowed" });
  }
  return new Response(null, { status: 204, headers: responseHeaders(req) });
}

export function requirePost(req: Request): Response | null {
  return req.method === "POST"
    ? null
    : json(
        req,
        405,
        { error: "method_not_allowed" },
        { Allow: "POST, OPTIONS" },
      );
}

export async function readJson<T>(
  req: Request,
  maxBytes = 131_072,
): Promise<T> {
  const declaredLength = Number(req.headers.get("Content-Length") ?? 0);
  if (declaredLength > maxBytes) throw new Error("request_too_large");
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new Error("request_too_large");
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("invalid_json");
  }
}

export async function authenticate(
  req: Request,
): Promise<RequestContext | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("backend_not_configured");

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, service };
}

export function publicError(error: unknown): string {
  if (error instanceof Error) {
    if (["invalid_json", "request_too_large"].includes(error.message))
      return error.message;
  }
  return "internal_error";
}
