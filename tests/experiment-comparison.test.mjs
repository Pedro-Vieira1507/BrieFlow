import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("A/B metrics and decisions are private and tied to owned assets", () => {
  const migration = read(
    "supabase/migrations/20261023132243_add_ab_experiment_metrics_and_decisions.sql",
  );
  assert.match(migration, /asset_experiment_metrics_select_own/);
  assert.match(migration, /asset_experiment_metrics_update_own/);
  assert.match(migration, /with check/i);
  assert.match(migration, /a\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /asset_experiment_decisions_insert_own/);
  assert.match(
    migration,
    /a\.experiment_group_id = asset_experiment_decisions\.experiment_group_id/i,
  );
});

test("A/B comparison exposes channel scores, real metrics and manual winner", () => {
  const comparison = read("src/components/briefflow/ExperimentComparison.tsx");
  const quality = read("src/lib/campaignExperiment.ts");
  const supabase = read("src/lib/supabase.ts");
  assert.match(comparison, /Score criativo por canal/);
  assert.match(comparison, /Marcar vencedora/);
  assert.match(comparison, /Impressões/);
  assert.match(comparison, /Conversões/);
  assert.match(comparison, /não\s+prevê performance/);
  assert.match(quality, /calculateCampaignChannelQuality/);
  assert.match(quality, /calculateExperimentRates/);
  assert.match(quality, /clicks \/ impressions/);
  assert.match(quality, /conversions \/ clicks/);
  assert.match(supabase, /saveExperimentMetrics/);
  assert.match(supabase, /setExperimentWinner/);
  assert.match(supabase, /clearExperimentWinner/);
});

test("library can open the A/B comparison for a saved experiment", () => {
  const library = read("src/components/briefflow/LibraryModal.tsx");
  assert.match(library, /ExperimentComparison/);
  assert.match(library, /Comparar A\/B/);
  assert.match(library, /comparisonOpen/);
});
