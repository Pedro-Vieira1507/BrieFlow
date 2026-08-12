import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BLOCKED_HOSTS = new Set(["localhost","127.0.0.1","0.0.0.0","169.254.169.254","metadata.google.internal","100.100.100.200"]);

function validateUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return { ok: false, reason: "invalid_url" }; }
  if (!["http:", "https:"].includes(parsed.protocol)) return { ok: false, reason: "invalid_protocol" };
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return { ok: false, reason: "blocked_host" };
  if (/^10\./.test(host)) return { ok: false, reason: "private_ip" };
  if (/^192\.168\./.test(host)) return { ok: false, reason: "private_ip" };
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return { ok: false, reason: "private_ip" };
  return { ok: true, url: parsed };
}

async function hashUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(url.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    for (const re of [
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i"),
    ]) { const m = html.match(re); if (m?.[1]) return m[1].trim(); }
  }
  return "";
}

function extractBrandData(html: string, url: string) {
  const title = metaContent(html, ["og:title","twitter:title"]) ||
    (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const description = metaContent(html, ["og:description","twitter:description","description"]) || "";
  const logo = metaContent(html, ["og:image","twitter:image"]) ||
    (html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? "");
  const colors: string[] = [];
  for (const m of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    if (!colors.includes(`#${m[1]}`) && colors.length < 5) colors.push(`#${m[1]}`);
  }
  const origin = new URL(url).origin;
  return {
    url, brandName: title.split("|")[0].split("-")[0].trim() || new URL(url).hostname,
    description: description.slice(0, 500),
    logo: logo.startsWith("http") ? logo : logo ? `${origin}${logo}` : null,
    colors, rawTitle: title,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const { url: rawUrl } = await req.json() as { url?: string };
    if (!rawUrl || typeof rawUrl !== "string") {
      return new Response(JSON.stringify({ error: "url_required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validation = validateUrl(rawUrl.trim());
    if (!validation.ok) {
      return new Response(JSON.stringify({ error: validation.reason }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalizedUrl = validation.url.toString();
    const urlHash = await hashUrl(normalizedUrl);

    const { data: cached } = await serviceClient.from("scrape_cache")
      .select("data, expires_at").eq("url_hash", urlHash).maybeSingle();
    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(JSON.stringify({ ...cached.data, _cached: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let html = "";
    try {
      const res = await fetch(normalizedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BrieFlow/1.0)", Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9" },
        redirect: "follow", signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return new Response(JSON.stringify({ error: `fetch_failed_${res.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const buf = await res.arrayBuffer();
      html = new TextDecoder().decode(buf.slice(0, 512 * 1024));
    } finally { clearTimeout(timeout); }

    const brandData = extractBrandData(html, normalizedUrl);

    EdgeRuntime.waitUntil(serviceClient.from("scrape_cache").upsert({
      url_hash: urlHash, url: normalizedUrl, data: brandData,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    }));

    return new Response(JSON.stringify(brandData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
