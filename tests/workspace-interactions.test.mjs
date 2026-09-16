import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceSource = await readFile(
  new URL("../src/components/briefflow/WorkspaceShell.tsx", import.meta.url),
  "utf8",
);

test("notifications stay below the header controls", () => {
  assert.match(
    workspaceSource,
    /position="top-right"[\s\S]*offset=\{\{ top: 80, right: 16 \}\}/,
  );
  assert.match(
    workspaceSource,
    /mobileOffset=\{\{ top: 80, right: 12, left: 12 \}\}/,
  );
});
