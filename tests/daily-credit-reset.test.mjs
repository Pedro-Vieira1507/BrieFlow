import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CREDIT_RESET_TIME_ZONE,
  getCreditDayKey,
} from "../src/lib/creditCycle.ts";

const migrationUrl = new URL(
  "../supabase/migrations/20260908113618_daily_credit_reset.sql",
  import.meta.url,
);
const billingMigrationUrl = new URL(
  "../supabase/migrations/20260908122053_daily_credit_billing_decoupling.sql",
  import.meta.url,
);

test("credit day changes at midnight in Sao Paulo", () => {
  assert.equal(CREDIT_RESET_TIME_ZONE, "America/Sao_Paulo");
  assert.equal(
    getCreditDayKey(new Date("2026-09-09T02:59:59.999Z")),
    "2026-09-08",
  );
  assert.equal(
    getCreditDayKey(new Date("2026-09-09T03:00:00.000Z")),
    "2026-09-09",
  );
});

test("daily reset is scheduled, idempotent and repairs stale reads", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /last_credit_reset_on date/);
  assert.match(migration, /America\/Sao_Paulo/);
  assert.match(migration, /brieflow-reset-daily-credits[\s\S]*'0 3 \* \* \*'/);
  assert.match(migration, /cron\.unschedule\('reset-daily-free-credits'\)/);
  assert.match(migration, /for update of s skip locked/);
  assert.match(
    migration,
    /on conflict \(user_id, request_id, entry_type\) do nothing/,
  );
  assert.match(
    migration,
    /get_user_plan\(\)[\s\S]*private\.reset_daily_credits\(now\(\), v_organization_id, v_user_id\)/,
  );
  assert.match(
    migration,
    /authorize_generation\([\s\S]*private\.reset_daily_credits\(now\(\), v_org_id, p_user_id\)/,
  );
});

test("daily reset stays internal and preserves the Stripe billing period", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /create schema if not exists private/);
  assert.match(
    migration,
    /revoke all on function private\.reset_daily_credits[\s\S]*from public, anon, authenticated/,
  );
  assert.doesNotMatch(migration, /current_period_(?:start|end)\s*=/);
});

test("the browser credit observer shares and releases its listeners", async () => {
  const hook = await readFile(
    new URL("../src/hooks/useCredits.ts", import.meta.url),
    "utf8",
  );

  assert.match(hook, /creditObserverUsers \+= 1/);
  assert.match(hook, /window\.clearInterval\(interval\)/);
  assert.match(hook, /removeEventListener\("focus", refreshAfterDayChange\)/);
  assert.match(hook, /subscription\.unsubscribe\(\)/);
});

test("account billing UI describes the allowance as daily", async () => {
  const settings = await readFile(
    new URL(
      "../src/components/briefflow/ProfileSettingsModal.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(settings, /Créditos diários/);
  assert.match(settings, /créditos por dia/);
  assert.match(settings, /Uso mensal do plano gratuito/);
  assert.doesNotMatch(settings, /Créditos mensais/);
});

test("Stripe renewals cannot grant a second daily allowance", async () => {
  const [migration, webhook] = await Promise.all([
    readFile(billingMigrationUrl, "utf8"),
    readFile(
      new URL("../supabase/functions/stripe-webhook/index.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(
    migration,
    /p_reset_credits\s+and\s+s\.current_period_start/,
  );
  assert.match(migration, /v_daily_limit > s\.credits_monthly/);
  assert.doesNotMatch(webhook, /resetCredits/);
  assert.doesNotMatch(webhook, /p_reset_credits/);
});
