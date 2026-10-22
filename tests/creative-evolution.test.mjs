import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("isolated regeneration preserves the existing campaign platform", async () => {
  const hook = await source("src/hooks/useBriefflowAgent.ts");
  assert.match(hook, /function buildExistingCampaignPlatformContext/);
  assert.match(hook, /COERÊNCIA COM A CAMPANHA EXISTENTE/);
  assert.match(hook, /if \(!isAll && existingAsset\?\.content\)/);
});

test("library rename stays scoped to the authenticated owner", async () => {
  const supabase = await source("src/lib/supabase.ts");
  const library = await source("src/components/briefflow/LibraryModal.tsx");

  assert.match(supabase, /export async function renameSavedAsset/);
  assert.match(supabase, /\.eq\("user_id", user\.id\)/);
  assert.match(library, /aria-label="Renomear campanha"/);
  assert.match(library, /item\.updated_at \|\| item\.created_at/);
});

test("production quality checks cover live desktop mobile and SEO metadata", async () => {
  const workflow = await source(".github/workflows/production-e2e.yml");
  const productionTest = await source("e2e/production-accessibility.spec.ts");
  const root = await source("src/routes/__root.tsx");

  assert.match(workflow, /E2E_BASE_URL: https:\/\/brieflow-ai\.vercel\.app/);
  assert.match(workflow, /--project=mobile-chromium/);
  assert.match(productionTest, /AxeBuilder/);
  assert.match(productionTest, /scrollWidth > window\.innerWidth/);
  assert.match(root, /hrefLang: "pt-BR"/);
  assert.match(root, /hrefLang: "x-default"/);
});
