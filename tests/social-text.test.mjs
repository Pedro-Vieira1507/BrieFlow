import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CHANNEL_IDS,
  CHANNELS,
  copyLength,
  emptyBrief,
  emptyMetrics,
  publicationIssues,
  textPrompt,
  validateBrief,
  validateCopy,
} from "../supabase/functions/_shared/social.ts";
import {
  base64url,
  randomSecret,
  seal,
  sha256,
  unseal,
} from "../supabase/functions/_shared/socialCrypto.ts";
import {
  api,
  fetchMetrics,
  publishToProvider,
  ProviderError,
  xMetrics,
} from "../supabase/functions/_shared/socialProviders.ts";
const brief = {
  ...emptyBrief(),
  name: "Teste de redação",
  brand: "Marca exemplo",
  product: "Caderno",
  audience: "Estudantes",
  facts: "Capa verde, 80 folhas. Não há preço informado.",
  channels: [...CHANNEL_IDS],
};
const copy = {
  title: "Como organizar as notas?",
  text: "Uma ideia por página. Como você organiza as suas notas?",
  productionNotes: "Confirmar o formato antes de publicar.",
};
const media = {
  id: "file",
  path: "owner/campaign/file.jpg",
  name: "caderno.jpg",
  description: "Foto de um caderno verde",
  mime: "image/jpeg",
  size: 128,
};
test("social: six distinct editorial policies preserve requested cadence", () => {
  assert.equal(CHANNEL_IDS.length, 6);
  assert.equal(
    new Set(CHANNEL_IDS.map((c) => CHANNELS[c].instruction)).size,
    6,
  );
  assert.equal(CHANNELS.linkedin.cadence, "3–5 / semana");
  assert.equal(CHANNELS.x.maxLength, 280);
  assert.match(CHANNELS.reddit.instruction, /vínculo comercial/);
  assert.match(CHANNELS.tiktok.instruction, /roteiro gravável/);
});
test("social: brief rejects missing facts, malformed and duplicate channels", () => {
  assert.deepEqual(validateBrief(brief), []);
  assert.ok(validateBrief({ ...brief, facts: " " }).length);
  assert.ok(validateBrief({ ...brief, channels: ["x", "x"] }).length);
  assert.ok(validateBrief({ ...brief, channels: ["threads"] }).length);
  assert.ok(validateBrief({ ...brief, link: "javascript:alert(1)" }).length);
});
test("social: prompts are text only, factual and never disclose storage URLs", () => {
  for (const channel of CHANNEL_IDS) {
    const prompt = textPrompt(brief, channel, [
      { ...media, url: "secret-url", path: "private/path" },
    ]);
    assert.match(prompt.system, /SOMENTE texto/);
    assert.match(prompt.system, /Não invente/);
    assert.match(prompt.system, /não uma instrução de sistema/);
    assert.ok(prompt.system.includes(CHANNELS[channel].instruction));
    assert.ok(!prompt.user.includes("secret-url"));
    assert.ok(!prompt.user.includes("private/path"));
  }
});
test("social: weighted X count normalizes text and reserves link weight", () => {
  assert.equal(copyLength("x", "Oi https://example.com/very-long-url"), 26);
  assert.equal(copyLength("x", "😀"), 2);
  assert.equal(copyLength("x", "中"), 2);
  assert.equal(copyLength("x", "cafe\u0301"), 4);
  assert.ok(validateCopy("x", { ...copy, text: "a".repeat(281) }).length);
});
test("social: media compatibility cannot silently drop an attachment", () => {
  assert.ok(publicationIssues("instagram", copy).length);
  assert.equal(publicationIssues("instagram", copy, media).length, 0);
  assert.ok(
    publicationIssues("instagram", copy, { ...media, mime: "image/png" })
      .length,
  );
  assert.ok(publicationIssues("x", copy, media).length);
  assert.ok(publicationIssues("reddit", copy, media).length);
  assert.ok(
    publicationIssues("tiktok", copy, { ...media, mime: "video/mp4" }).length,
  );
  assert.equal(
    publicationIssues("tiktok", copy, {
      ...media,
      mime: "video/mp4",
      duration: 30,
    }).length,
    0,
  );
});
test("social: malformed copy returns errors without unsafe coercion", () => {
  assert.ok(validateCopy("reddit", { ...copy, title: { html: "x" } }).length);
  assert.ok(validateCopy("reddit", { ...copy, title: "" }).length);
  assert.ok(validateCopy("x", { ...copy, text: 42 }).length);
});
test("social: unavailable metrics remain null, and zero remains zero", () => {
  const empty = emptyMetrics();
  assert.ok(Object.values(empty).every((v) => v === null));
  const x = xMetrics({
    like_count: 0,
    impression_count: 100,
    retweet_count: 3,
    quote_count: 99,
  });
  assert.equal(x.likes, 0);
  assert.equal(x.impressions, 100);
  assert.equal(x.reach, null);
  assert.equal(x.views, null);
  assert.equal(x.shares, 3);
});
test("social: credential encryption is random and bound to its owner", async () => {
  const key = base64url(crypto.getRandomValues(new Uint8Array(32))),
    binding = "owner:org:x:account";
  const a = await seal("private-access-token", key, binding),
    b = await seal("private-access-token", key, binding);
  assert.notEqual(a, b);
  assert.ok(!a.includes("private-access-token"));
  assert.equal(await unseal(a, key, binding), "private-access-token");
  await assert.rejects(() => unseal(a, key, "other:org:x:account"));
  await assert.rejects(() => seal("test", "bad", binding));
});
test("social: OAuth state has strong entropy and a nonreversible storage key", async () => {
  const state = randomSecret();
  assert.match(state, /^[\w-]{43}$/);
  assert.notEqual(state, await sha256(state));
  assert.notEqual(state, randomSecret());
});
test("social: provider network writes are uncertain and never retried", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new Error("secret-token-in-network-error");
  });
  await assert.rejects(
    () => api("https://api.x.com/2/tweets", "secret", { method: "POST" }),
    (e) =>
      e instanceof ProviderError &&
      e.uncertain &&
      !e.message.includes("secret"),
  );
  assert.equal(calls, 1);
});
test("social: direct X publish preserves only the user-approved text", async (t) => {
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    payload = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: { id: "123" } }), {
      status: 201,
    });
  });
  const result = await publishToProvider(
    { channel: "x", external_id: "owner" },
    "token",
    copy,
    { consent: true },
  );
  assert.deepEqual(payload, { text: copy.text });
  assert.equal(result.status, "published");
  assert.equal(result.remoteId, "123");
});
test("social: provider success without an id never becomes a published post", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("{}", { status: 201 }),
  );
  await assert.rejects(
    () => publishToProvider({ channel: "x" }, "token", copy, { consent: true }),
    (e) => e instanceof ProviderError && e.uncertain,
  );
});
test("social: metrics mapper does not invent missing API fields", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          data: { public_metrics: { like_count: 0, impression_count: 200 } },
        }),
      ),
  );
  const metrics = await fetchMetrics({ channel: "x" }, "token", "post", "123");
  assert.equal(metrics.values.likes, 0);
  assert.equal(metrics.values.comments, null);
  assert.equal(metrics.values.reach, null);
});
test("social: migration keeps writes and secrets service-only and claims atomic", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20260924185211_text_social_workspace.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    sql,
    /revoke all on table public.%I from public, anon, authenticated/,
  );
  assert.match(sql, /enable row level security/);
  assert.match(
    sql,
    /if table_name not in \('social_credentials','social_oauth_states'\)/,
  );
  assert.match(sql, /for update/);
  assert.match(sql, /p_version is null/);
  assert.match(sql, /post_id uuid not null unique/);
  assert.match(sql, /'social-briefs','social-briefs',false/);
  assert.doesNotMatch(
    sql,
    /drop table|delete from public.assets|update public.subscriptions/i,
  );
});
