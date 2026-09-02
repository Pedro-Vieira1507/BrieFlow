import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isPrivateAddress } from "../supabase/functions/_shared/urls.ts";
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
      "../supabase/migrations/202609010001_enterprise_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /create policy assets_select_own[\s\S]*user_id = auth\.uid\(\)/,
  );
  assert.match(
    migration,
    /create policy assets_delete_own[\s\S]*user_id = auth\.uid\(\)/,
  );
  assert.match(migration, /'campaign-assets', 'campaign-assets', false/);
  assert.match(
    migration,
    /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/,
  );
  assert.match(migration, /campaign_assets_select_legacy_reference/);
  assert.match(migration, /owner_id = auth\.uid\(\)::text/);
  assert.match(migration, /unique \(user_id, request_id, entry_type\)/);
  assert.match(migration, /false, 'duplicate_request'/);
  assert.match(migration, /false, 'membership_inactive'/);
  assert.match(migration, /claim_stripe_webhook/);
  assert.match(migration, /stripe_event_created bigint/);
  assert.match(migration, /organization_identity_immutable/);
  assert.match(
    migration,
    /assets_user_created_id_idx[\s\S]*user_id, created_at desc, id desc/,
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
  });

  useBriefflowStore.getState().setUser({ id: "second-user" });
  const state = useBriefflowStore.getState();
  assert.equal(state.user.id, "second-user");
  assert.deepEqual(state.messages, []);
  assert.deepEqual(state.builder, { type: "none" });
  assert.equal(state.uploadedImage, null);

  state.setUser(null);
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
        "../supabase/migrations/202609010001_enterprise_foundation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(webhook, /claim_stripe_webhook/);
  assert.match(webhook, /sync_stripe_subscription/);
  assert.match(webhook, /eventCreated: event\.created/);
  assert.match(webhook, /json\(req, 409, \{ error: "event_processing" \}\)/);
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
  const [viteConfig, gitignore, edgeEnv] = await Promise.all([
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../supabase/.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(viteConfig, /allowedHosts:\s*\["\.trycloudflare\.com"\]/);
  assert.match(gitignore, /supabase\/\.env\.\*/);
  assert.doesNotMatch(edgeEnv, /VITE_/);
  assert.doesNotMatch(edgeEnv, /YOUR_SUPABASE_ANON_KEY/);
});
