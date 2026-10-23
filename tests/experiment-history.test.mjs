import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261023155648_add_experiment_history_and_traffic_control.sql",
    import.meta.url,
  ),
  "utf8",
);
const historyLib = readFileSync(
  new URL("../src/lib/experimentHistory.ts", import.meta.url),
  "utf8",
);
const historyPanel = readFileSync(
  new URL(
    "../src/components/briefflow/ExperimentHistoryPanel.tsx",
    import.meta.url,
  ),
  "utf8",
);
const evidencePanel = readFileSync(
  new URL(
    "../src/components/briefflow/ExperimentEvidencePanel.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("experiment history migration protects snapshots and traffic settings with RLS", () => {
  assert.match(
    migration,
    /create table if not exists public\.asset_experiment_runs/,
  );
  assert.match(
    migration,
    /create table if not exists public\.asset_experiment_metric_snapshots/,
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /asset_experiment_metric_snapshots_insert_own/);
  assert.match(migration, /capture_asset_experiment_metric_snapshot_trigger/);
  assert.match(migration, /status in \('running', 'completed'\)/);
  assert.match(migration, /traffic_a_percent between 1 and 99/);
  assert.match(
    migration,
    /revoke all on function public\.capture_asset_experiment_metric_snapshot\(\) from authenticated/,
  );
});

test("history queries stay scoped to the authenticated user and experiment", () => {
  assert.match(historyLib, /\.eq\("experiment_group_id", groupId\)/);
  assert.match(historyLib, /\.eq\("user_id", userId\)/);
  assert.match(historyLib, /trafficAPercent < 1/);
  assert.match(historyLib, /trafficAPercent > 99/);
});

test("history UI exposes traffic split, lifecycle and three trend views", () => {
  assert.match(historyPanel, /Divisão planejada de tráfego/);
  assert.match(historyPanel, /Encerrar experimento/);
  assert.match(historyPanel, /title="CTR"/);
  assert.match(historyPanel, /title="Conversão \/ impressão"/);
  assert.match(historyPanel, /title="Receita acumulada"/);
  assert.match(historyPanel, /mais de 10 p\.p\./);
});

test("statistical evidence panel includes experiment history", () => {
  assert.match(evidencePanel, /ExperimentHistoryPanel/);
  assert.match(evidencePanel, /experimentGroupId=\{a\.experiment_group_id\}/);
  assert.match(evidencePanel, /metrics=\{metrics\}/);
});
