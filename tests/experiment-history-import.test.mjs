import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCumulativeExperimentSnapshots,
  buildHistoricalExperimentCsvTemplate,
  parseHistoricalExperimentCsv,
} from "../src/lib/experimentHistoricalCsv.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261023180547_add_historical_experiment_import.sql",
    import.meta.url,
  ),
  "utf8",
);
const historyLib = readFileSync(
  new URL("../src/lib/experimentHistory.ts", import.meta.url),
  "utf8",
);
const historicalPanel = readFileSync(
  new URL(
    "../src/components/briefflow/ExperimentHistoricalImport.tsx",
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

test("historical CSV converts daily A/B results into cumulative snapshots", () => {
  const parsed = parseHistoricalExperimentCsv(
    [
      "data;variante;impressoes;cliques;conversoes;receita",
      "20/10/2026;A;1000;80;12;1.500,00",
      "20/10/2026;B;1000;95;18;2.200,00",
      "21/10/2026;A;900;70;10;1.300,00",
      "21/10/2026;B;950;88;15;1.900,00",
    ].join("\n"),
  );
  const cumulative = buildCumulativeExperimentSnapshots(parsed.rows);

  assert.equal(parsed.historical, true);
  assert.equal(parsed.firstDate, "2026-10-20");
  assert.equal(parsed.lastDate, "2026-10-21");
  assert.deepEqual(cumulative.at(-1), {
    variant: "B",
    date: "2026-10-21",
    impressions: 1950,
    clicks: 183,
    conversions: 33,
    revenue: 4100,
    notes: "",
  });
});

test("Meta Ads template is detected and A/B can be inferred from ad names", () => {
  const parsed = parseHistoricalExperimentCsv(
    buildHistoricalExperimentCsvTemplate("meta_ads"),
  );
  assert.equal(parsed.source, "meta_ads");
  assert.deepEqual(
    [...new Set(parsed.rows.map((row) => row.variant))],
    ["A", "B"],
  );
});

test("Google Ads parser tolerates a report preamble and common column names", () => {
  const csv = [
    "Relatório de anúncios",
    "Período: últimos 7 dias",
    buildHistoricalExperimentCsvTemplate("google_ads"),
  ].join("\n");
  const parsed = parseHistoricalExperimentCsv(csv);
  assert.equal(parsed.source, "google_ads");
  assert.equal(parsed.sourceRowCount, 4);
});

test("historical parser rejects fractional conversion events", () => {
  assert.throws(
    () =>
      parseHistoricalExperimentCsv(
        [
          "date;variant;impressions;clicks;conversions",
          "2026-10-20;A;100;10;1,5",
          "2026-10-20;B;100;10;2",
        ].join("\n"),
      ),
    /inteiro/,
  );
});

test("historical import RPC is invoker-scoped and protects automatic snapshots", () => {
  assert.match(migration, /import_asset_experiment_history/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /brieflow\.skip_experiment_snapshot/);
  assert.match(
    migration,
    /p_source not in \('csv', 'meta_ads', 'google_ads'\)/,
  );
  assert.match(migration, /a\.user_id = v_user_id/);
  assert.match(migration, /a\.variant_label in \('A', 'B'\)/);
  assert.match(
    migration,
    /grant execute on function public\.import_asset_experiment_history\(uuid, jsonb, text, text\) to authenticated/,
  );
});

test("historical import is wired to the A/B evidence workflow", () => {
  assert.match(historyLib, /export async function importExperimentHistory/);
  assert.match(historyLib, /\.rpc\(\s*"import_asset_experiment_history"/);
  assert.match(historicalPanel, /buildCumulativeExperimentSnapshots/);
  assert.match(historicalPanel, /Substituir histórico/);
  assert.match(historicalPanel, /Meta Ads/);
  assert.match(historicalPanel, /Google Ads/);
  assert.match(evidencePanel, /ExperimentHistoricalImport/);
});
