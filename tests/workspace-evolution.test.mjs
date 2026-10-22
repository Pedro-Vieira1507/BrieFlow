import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("brand kits are user-scoped and explicitly exposed only to authenticated users", () => {
  const migration = read(
    "supabase/migrations/20261022182910_add_brand_kits_and_library_status_index.sql",
  );
  assert.match(migration, /alter table public\.brand_kits enable row level security/i);
  assert.match(migration, /to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.brand_kits to authenticated/i,
  );
  assert.match(migration, /revoke all on table public\.brand_kits from anon/i);
});

test("library status changes are persisted and normal saves do not reset approval", () => {
  const supabase = read("src/lib/supabase.ts");
  assert.match(supabase, /updateSavedAssetStatus/);
  assert.match(supabase, /LibraryAssetStatus/);
  assert.doesNotMatch(
    supabase,
    /const payload = \{[\s\S]{0,220}status: "draft"/,
  );
});

test("brand kit constraints reach the creative prompt", () => {
  const types = read("src/types/brief.ts");
  const prompts = read("src/lib/marketingPrompts.ts");
  assert.match(types, /forbiddenTerms/);
  assert.match(prompts, /Termos proibidos pela marca/);
  assert.match(prompts, /Território verbal preferido/);
});

test("core campaign tabs expose scoped AI refinement", () => {
  const tabs = read("src/components/briefflow/builder/CampaignTabs.tsx");
  const agent = read("src/hooks/useBriefflowAgent.ts");
  assert.match(tabs, /Refinar com IA/);
  assert.match(tabs, /CORE_MATERIAL_TYPES/);
  assert.match(agent, /inferRefinementTargets/);
  assert.match(agent, /refineChannel/);
  assert.match(agent, /preserve todos os demais campos/);
});
