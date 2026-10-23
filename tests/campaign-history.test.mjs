import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("campaign history is private and snapshots only content changes", () => {
  const migration = read(
    "supabase/migrations/20261023121500_add_asset_versions_and_ab_variants.sql",
  );
  assert.match(
    migration,
    /alter table public\.asset_versions enable row level security/i,
  );
  assert.match(migration, /asset_versions_select_own/);
  assert.match(
    migration,
    /after insert or update of content on public\.assets/i,
  );
  assert.match(migration, /new\.content is not distinct from old\.content/i);
});

test("saved campaigns expose A/B variants and restorable history", () => {
  const supabase = read("src/lib/supabase.ts");
  const library = read("src/components/briefflow/LibraryModal.tsx");
  assert.match(supabase, /createSavedAssetVariant/);
  assert.match(supabase, /getAssetVersions/);
  assert.match(supabase, /restoreAssetVersion/);
  assert.match(library, /Criar variação B/);
  assert.match(library, /Histórico de versões/);
  assert.match(library, /handleRestoreVersion/);
});

test("creative review exposes a non-predictive quality score", () => {
  const score = read("src/lib/creativeQuality.ts");
  const review = read("src/components/briefflow/builder/EditorialReview.tsx");
  assert.match(score, /calculateCreativeQuality/);
  assert.match(score, /completeness/);
  assert.match(score, /editorial/);
  assert.match(review, /Score \{quality\.score\}\/100/);
  assert.match(review, /não prevê performance/);
});
