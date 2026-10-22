import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("creative workspace tracks unsaved changes and warns on unload", async () => {
  const [store, shell] = await Promise.all([
    read("src/store/briefflow.ts"),
    read("src/components/briefflow/WorkspaceShell.tsx"),
  ]);

  assert.match(store, /workspaceDirty: boolean/);
  assert.match(store, /workspaceDirty: false/);
  assert.match(shell, /beforeunload/);
  assert.match(shell, /workspaceDirty/);
});

test("creative production branch is covered by CI", async () => {
  const workflow = await read(".github/workflows/ci.yml");
  assert.match(workflow, /production\/creative-studio/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm audit --audit-level=high/);
});
