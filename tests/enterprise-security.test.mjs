import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isPrivateAddress } from "../supabase/functions/_shared/urls.ts";
import { withSecurityHeaders } from "../src/lib/securityHeaders.ts";
import { useBriefflowStore } from "../src/store/briefflow.ts";

test("browser bundle delegates AI calls and contains no provider secret variables", async () => {
  const [client, supabaseClient, edgeHttp] = await Promise.all([
    readFile(new URL("../src/lib/aiClient.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/supabase.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../supabase/functions/_shared/http.ts", import.meta.url),
      "utf8",
    ),
  ]);
  const envExample = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );

  assert.match(client, /invokeEdgeFunction<ProxyResponse>\(\s*"ai-proxy"/);
  assert.doesNotMatch(client, /VITE_(?:GROQ|GEMINI|OMNIROUTE|OLLAMA)_/);
  assert.doesNotMatch(envExample, /GROQ_API_KEY|GEMINI_API_KEY|SERVICE_ROLE/);
  assert.match(supabaseClient, /"X-Client-Info": "brieflow-web\/3"/);
  assert.doesNotMatch(supabaseClient, /"X-Client-Version":/);
  assert.match(edgeHttp, /x-client-info, x-client-version/);
  assert.match(edgeHttp, /\.map\(normalizeConfiguredOrigin\)/);
  assert.match(edgeHttp, /return url\.origin/);
  assert.doesNotMatch(edgeHttp, /trycloudflare|allowCloudflarePreviews/);
});

test("production responses include a minimum browser security baseline", async () => {
  const secured = withSecurityHeaders(
    new Request("https://brieflow.example/"),
    new Response("ok", { status: 201, headers: { "X-Existing": "yes" } }),
  );

  assert.equal(secured.status, 201);
  assert.equal(await secured.text(), "ok");
  assert.equal(secured.headers.get("X-Existing"), "yes");
  assert.equal(secured.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(secured.headers.get("X-Frame-Options"), "DENY");
  assert.match(
    secured.headers.get("Content-Security-Policy") ?? "",
    /frame-ancestors 'none'/,
  );
  assert.equal(
    secured.headers.get("Strict-Transport-Security"),
    "max-age=31536000",
  );

  const local = withSecurityHeaders(
    new Request("http://localhost:3000/"),
    new Response("ok"),
  );
  assert.equal(local.headers.get("Strict-Transport-Security"), null);

  const server = await readFile(
    new URL("../src/server.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    server,
    /withSecurityHeaders\([\s\S]*normalizeCatastrophicSsrResponse/,
  );
});

test("AI proxy authorizes atomically, falls back server-side and refunds failures", async () => {
  const proxy = await readFile(
    new URL("../supabase/functions/ai-proxy/index.ts", import.meta.url),
    "utf8",
  );

  assert.match(proxy, /authorize_generation/);
  assert.match(proxy, /GROQ_PRIMARY_MODEL/);
  assert.match(proxy, /GEMINI_CONTENT_MODEL/);
  assert.match(
    proxy,
    /for \(const \[index, attempt\] of attempts\.entries\(\)\)/,
  );
  assert.match(proxy, /refund_generation/);
  assert.doesNotMatch(proxy, /body\.model/);
});

test("database migration enforces personal library RLS and private media", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260903110835_enterprise_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /create policy assets_select_own[\s\S]*user_id = \(select auth\.uid\(\)\)/,
  );
  assert.match(
    migration,
    /create policy assets_delete_own[\s\S]*user_id = \(select auth\.uid\(\)\)/,
  );
  assert.match(migration, /'campaign-assets', 'campaign-assets', false/);
  assert.match(
    migration,
    /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/,
  );
  assert.match(migration, /campaign_assets_select_legacy_reference/);
  assert.match(migration, /owner_id = \(select auth\.uid\(\)\)::text/);
  assert.match(migration, /unique \(user_id, request_id, entry_type\)/);
  assert.match(migration, /false, 'duplicate_request'/);
  assert.match(migration, /false, 'membership_inactive'/);
  assert.match(migration, /claim_stripe_webhook/);
  assert.match(migration, /stripe_event_created bigint/);
  assert.match(migration, /organization_identity_immutable/);
  assert.match(
    migration,
    /drop trigger if exists on_auth_user_created on auth\.users/,
  );
  assert.match(
    migration,
    /drop policy if exists "Permitir leitura pública 8vmd40_0" on storage\.objects/,
  );
  assert.match(
    migration,
    /revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/,
  );
  assert.match(migration, /public\.deduct_user_credit\(integer\)/);
  assert.match(
    migration,
    /revoke all on table public\.brand_knowledge from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /assets_user_created_id_idx[\s\S]*user_id, created_at desc, id desc/,
  );
});

test("tenant relations and legacy plan reads stay scalable", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260903111628_enterprise_performance_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const index of [
    "organizations_owner_user_idx",
    "profiles_default_organization_idx",
    "organization_members_user_idx",
    "organization_members_invited_by_idx",
    "subscriptions_plan_idx",
  ]) {
    assert.match(migration, new RegExp(index));
  }
  assert.match(
    migration,
    /create policy legacy_user_plans_select_own[\s\S]*user_id = \(select auth\.uid\(\)\)/,
  );
  assert.match(migration, /revoke all on table public\.user_plans from anon/);
});

test("internal operational tables are unavailable through the Data API", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260908121114_internal_table_access_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const table of [
    "brand_knowledge",
    "rate_limit_windows",
    "scrape_cache",
    "stripe_webhook_events",
  ]) {
    assert.match(migration, new RegExp(`public\\.${table}`));
  }
  assert.match(migration, /from public, anon, authenticated/);
});

test("tenant helpers and browser grants follow least privilege", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260908171901_least_privilege_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /private\.is_organization_member\(\s*p_organization_id uuid/,
  );
  assert.match(
    migration,
    /private\.is_organization_admin\(\s*p_organization_id uuid/,
  );
  assert.match(migration, /set search_path = ''/);
  assert.match(
    migration,
    /drop function public\.is_organization_member\(uuid, uuid\)/,
  );
  assert.match(
    migration,
    /alter function public\.get_user_plan\(\) set search_path = ''/,
  );
  assert.match(
    migration,
    /revoke all on table[\s\S]*public\.subscriptions[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.assets\s+to authenticated/,
  );
  assert.match(migration, /alter default privileges for role postgres/);
  assert.match(migration, /alter extension vector set schema extensions/);
});

test("ephemeral operational data is cleaned in bounded batches", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260908123521_operational_data_retention.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /private\.cleanup_ephemeral_data/);
  assert.match(migration, /limit v_batch_size[\s\S]*for update skip locked/g);
  assert.match(migration, /window_started_at < v_as_of - interval '2 days'/);
  assert.match(migration, /expires_at < v_as_of/);
  assert.match(migration, /brieflow-clean-ephemeral-data[\s\S]*17 \* \* \* \*/);
  assert.doesNotMatch(
    migration,
    /delete from public\.(?:assets|credit_ledger|ai_usage_log|stripe_webhook_events)/,
  );
});

test("library queries stay user-scoped and use bounded cursor pagination", async () => {
  const client = await readFile(
    new URL("../src/lib/supabase.ts", import.meta.url),
    "utf8",
  );

  assert.match(client, /\.eq\("user_id", user\.id\)/);
  assert.match(client, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(client, /\.order\("id", \{ ascending: false \}\)/);
  assert.match(client, /\.limit\(pageSize \+ 1\)/);
  assert.match(client, /created_at\.lt\.\$\{cursor\.createdAt\}/);
  assert.match(client, /MAX_LIBRARY_PAGE_SIZE = 100/);
  assert.match(
    client,
    /SAVED_ASSET_COLUMNS\s*=\s*"id,user_id,name,type,content,status,created_at"/,
  );
  assert.doesNotMatch(client, /\.limit\(500\)/);
});

test("switching authenticated identities clears private in-memory content", () => {
  useBriefflowStore.setState({
    user: { id: "first-user" },
    messages: [{ id: "private", role: "user", content: "conteúdo privado" }],
    builder: { type: "banner", title: "Campanha privada" },
    uploadedImage: "data:image/png;base64,private",
    activeLibraryAssetId: "saved-private-campaign",
  });

  useBriefflowStore.getState().setUser({ id: "second-user" });
  const state = useBriefflowStore.getState();
  assert.equal(state.user.id, "second-user");
  assert.deepEqual(state.messages, []);
  assert.deepEqual(state.builder, { type: "none" });
  assert.equal(state.uploadedImage, null);
  assert.equal(state.activeLibraryAssetId, null);

  state.setUser(null);
});

test("saving a loaded campaign updates it instead of creating duplicates", async () => {
  const [client, builder, library] = await Promise.all([
    readFile(new URL("../src/lib/supabase.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/components/briefflow/PageBuilder.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/briefflow/LibraryModal.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(client, /existingAssetId\?[\s\S]*\.update\(payload\)/);
  assert.match(
    client,
    /\.eq\("id", existingAssetId\)[\s\S]*\.eq\("user_id", user\.id\)/,
  );
  assert.match(builder, /saveAssetToLibrary\([\s\S]*activeLibraryAssetId/);
  assert.match(builder, /setActiveLibraryAssetId\(savedAsset\.id\)/);
  assert.match(library, /setActiveLibraryAssetId\(item\.id\)/);
});

test("interactive previews and library cards expose accessible names", async () => {
  const [social, library] = await Promise.all([
    readFile(
      new URL("../src/components/briefflow/SocialPreview.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/briefflow/LibraryModal.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    social,
    /aria-label=\{[\s\S]*?liked[\s\S]*?"Remover curtida da prévia"/,
  );
  assert.match(social, /aria-pressed=\{liked\}/);
  assert.match(
    social,
    /aria-label=\{[\s\S]*?saved[\s\S]*?"Remover dos salvos da prévia"/,
  );
  assert.match(social, /aria-pressed=\{saved\}/);
  assert.match(
    library,
    /aria-label=\{`Visualizar \$\{brand\}, salva em \$\{dateStr\}`\}/,
  );
});

test("scraping validates DNS and every redirect before downloading", async () => {
  const urls = await readFile(
    new URL("../supabase/functions/_shared/urls.ts", import.meta.url),
    "utf8",
  );
  const scrape = await readFile(
    new URL("../supabase/functions/scrape-proxy/index.ts", import.meta.url),
    "utf8",
  );

  assert.match(urls, /Deno\.resolveDns/);
  assert.match(urls, /redirect: "manual"/);
  assert.match(urls, /private_address_blocked/);
  assert.match(scrape, /maxBytes: 1_000_000/);
  assert.doesNotMatch(scrape, /redirect: "follow"/);
});

test("SSRF guard blocks private and transition addresses across IP families", () => {
  for (const address of [
    "127.0.0.1",
    "10.2.3.4",
    "169.254.169.254",
    "::1",
    "::ffff:7f00:1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002:7f00:1::",
  ]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("2606:4700:4700::1111"), false);
});

test("billing webhooks are atomically claimed and ignore older signed events", async () => {
  const [webhook, migration] = await Promise.all([
    readFile(
      new URL("../supabase/functions/stripe-webhook/index.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260903110835_enterprise_foundation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(webhook, /claim_stripe_webhook/);
  assert.match(webhook, /sync_stripe_subscription/);
  assert.match(webhook, /eventCreated: event\.created/);
  assert.match(webhook, /json\(req, 409, \{ error: "event_processing" \}\)/);
  assert.match(webhook, /code === "webhook_not_configured"/);
  assert.match(webhook, /unavailable \? 503 : unauthorized \? 401 : 400/);
  assert.doesNotMatch(webhook, /stripe_webhook_events"\)\.upsert/);
  assert.match(migration, /s\.stripe_event_created <= p_event_created/);
  assert.match(migration, /s\.current_period_start < p_period_start/);
});

test("existing paid subscriptions change plans through the billing portal", async () => {
  const billing = await readFile(
    new URL("../supabase/functions/billing/index.ts", import.meta.url),
    "utf8",
  );

  assert.match(billing, /async function createPortalSession/);
  assert.match(
    billing,
    /subscription\.stripe_subscription_id[\s\S]*createPortalSession\(/,
  );
  assert.doesNotMatch(billing, /subscription_already_exists/);
});

test("commercial billing fails closed until live Stripe and webhooks are configured", async () => {
  const [billing, settings] = await Promise.all([
    readFile(
      new URL("../supabase/functions/billing/index.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/briefflow/ProfileSettingsModal.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(billing, /action\?: "checkout" \| "portal" \| "status"/);
  assert.match(billing, /\["development", "test", "staging"\]\.includes/);
  assert.match(billing, /\(nonProductionMode && \/\^\(\?:sk\|rk\)_test_\//);
  assert.match(billing, /validWebhookSecret/);
  assert.match(billing, /checkoutFoundation &&/);
  assert.match(billing, /verifiedBillingAvailability/);
  assert.match(billing, /price\.type === "recurring"/);
  assert.match(billing, /price\.livemode === expectsLivePrices/);
  assert.match(billing, /verifiedBillingAvailability\(\)\)\.checkout_plans/);
  assert.match(settings, /action: "status"/);
  assert.match(settings, /!checkoutAvailable/);
  assert.match(settings, /formatRecurringPrice/);
  assert.match(
    settings,
    /Novas assinaturas estão temporariamente indisponíveis/,
  );
});

test("authentication submit reads autofilled values from the form", async () => {
  const modal = await readFile(
    new URL("../src/components/briefflow/AuthModal.tsx", import.meta.url),
    "utf8",
  );

  assert.match(modal, /new FormData\(event\.currentTarget\)/);
  assert.match(modal, /name="email"/);
  assert.match(modal, /name="password"/);
  assert.match(modal, /password: submittedPassword/);
});

test("development tunnels keep bounded host validation and edge env files private", async () => {
  const [viteConfig, gitignore, edgeEnv, edgeHttp] = await Promise.all([
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../supabase/.env.example", import.meta.url), "utf8"),
    readFile(
      new URL("../supabase/functions/_shared/http.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(viteConfig, /allowedHosts:\s*\["\.trycloudflare\.com"\]/);
  assert.match(gitignore, /supabase\/\.env\.\*/);
  assert.doesNotMatch(edgeEnv, /VITE_/);
  assert.doesNotMatch(edgeEnv, /YOUR_SUPABASE_ANON_KEY/);
  assert.match(edgeHttp, /\.map\(normalizeConfiguredOrigin\)/);
  assert.match(edgeHttp, /return url\.origin/);
});

test("production builds and previews use the Vercel artifact", async () => {
  const [viteConfig, packageJson, gitignore, eslintConfig] = await Promise.all([
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../eslint.config.mjs", import.meta.url), "utf8"),
  ]);
  const pkg = JSON.parse(packageJson);

  assert.match(viteConfig, /nitro:\s*\{ preset: "vercel" \}/);
  assert.match(pkg.scripts.preview, /^srvx serve /);
  assert.match(
    pkg.scripts.preview,
    /\.vercel\/output\/functions\/__server\.func\/index\.mjs/,
  );
  assert.match(pkg.scripts.preview, /--static=\.\.\/\.\.\/static/);
  assert.equal(pkg.devDependencies.srvx, "^0.11.22");
  assert.match(gitignore, /^\.vercel\/$/m);
  assert.match(eslintConfig, /"\.vercel\/\*\*"/);
});

test("the launch gate checks headers, CORS and Stripe webhook readiness", async () => {
  const [manifest, launchCheck] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/check-launch.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(manifest, /"check:launch": "node scripts\/check-launch\.mjs"/);
  assert.match(launchCheck, /content-security-policy/);
  assert.match(launchCheck, /CORS rejeita origem externa/);
  assert.match(launchCheck, /STRIPE_WEBHOOK_SECRET ausente/);
  assert.match(launchCheck, /response\.status === 401/);
});
