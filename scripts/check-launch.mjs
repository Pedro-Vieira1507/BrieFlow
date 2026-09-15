const appInput = process.argv[2] ?? process.env.BRIEFLOW_APP_URL;
const projectRef = process.argv[3] ?? process.env.SUPABASE_PROJECT_REF;

if (!appInput || !projectRef) {
  console.error(
    "Uso: npm run check:launch -- https://app.example.com project-ref",
  );
  process.exit(2);
}

let appOrigin;
try {
  const appUrl = new URL(appInput);
  if (appUrl.protocol !== "https:") throw new Error("HTTPS obrigatório");
  appOrigin = appUrl.origin;
} catch (error) {
  console.error(`URL de produção inválida: ${error.message}`);
  process.exit(2);
}

if (!/^[a-z0-9]{20}$/.test(projectRef)) {
  console.error("Project ref do Supabase inválido.");
  process.exit(2);
}

const functionBase = `https://${projectRef}.supabase.co/functions/v1`;
const results = [];

async function check(name, operation) {
  try {
    const detail = await operation();
    results.push({ name, passed: true, detail });
  } catch (error) {
    results.push({
      name,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function requireCondition(condition, detail) {
  if (!condition) throw new Error(detail);
}

function request(path, init = {}) {
  return fetch(path, {
    ...init,
    signal: AbortSignal.timeout(20_000),
  });
}

await check("Frontend HTTPS", async () => {
  const response = await request(`${appOrigin}/`, { redirect: "follow" });
  requireCondition(response.ok, `HTTP ${response.status}`);
  requireCondition(
    new URL(response.url).protocol === "https:",
    "redirecionou para uma URL sem HTTPS",
  );
  return `HTTP ${response.status}`;
});

await check("Headers do navegador", async () => {
  const response = await request(`${appOrigin}/`, { redirect: "follow" });
  const required = {
    "content-security-policy": ["frame-ancestors 'none'", "object-src 'none'"],
    "permissions-policy": ["camera=()", "microphone=()"],
    "referrer-policy": ["strict-origin-when-cross-origin"],
    "strict-transport-security": ["max-age="],
    "x-content-type-options": ["nosniff"],
    "x-frame-options": ["DENY"],
  };
  const missing = [];
  for (const [header, fragments] of Object.entries(required)) {
    const value = response.headers.get(header) ?? "";
    if (!fragments.every((fragment) => value.includes(fragment))) {
      missing.push(header);
    }
  }
  requireCondition(
    missing.length === 0,
    `ausentes/inválidos: ${missing.join(", ")}`,
  );
  return "baseline completa";
});

for (const functionName of [
  "ai-proxy",
  "scrape-proxy",
  "image-search",
  "billing",
]) {
  await check(`CORS ${functionName}`, async () => {
    const response = await request(`${functionBase}/${functionName}`, {
      method: "OPTIONS",
      headers: {
        Origin: appOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "authorization,apikey,content-type,x-client-info",
      },
    });
    requireCondition(response.status === 204, `HTTP ${response.status}`);
    requireCondition(
      response.headers.get("access-control-allow-origin") === appOrigin,
      "origem oficial não autorizada",
    );
    return "204 e origem exata";
  });
}

await check("CORS rejeita origem externa", async () => {
  const response = await request(`${functionBase}/billing`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://invalid.example",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,apikey,content-type",
    },
  });
  requireCondition(response.status === 403, `HTTP ${response.status}`);
  requireCondition(
    !response.headers.get("access-control-allow-origin"),
    "origem externa recebeu autorização CORS",
  );
  return "403 sem allow-origin";
});

await check("Webhook Stripe configurado", async () => {
  const response = await request(`${functionBase}/stripe-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const payload = await response.json().catch(() => ({}));
  requireCondition(
    response.status === 401 && payload.error === "invalid_signature",
    response.status === 503
      ? "segredo STRIPE_WEBHOOK_SECRET ausente"
      : `esperado 401/invalid_signature; recebido ${response.status}/${payload.error ?? "sem código"}`,
  );
  return "assinatura inválida rejeitada com 401";
});

for (const result of results) {
  console.log(
    `${result.passed ? "PASS" : "FAIL"}  ${result.name} — ${result.detail}`,
  );
}

const failed = results.filter((result) => !result.passed);
console.log(
  `\n${results.length - failed.length}/${results.length} verificações aprovadas.`,
);
if (failed.length > 0) process.exitCode = 1;
