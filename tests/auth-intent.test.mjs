import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("a message entered before authentication resumes after login", () => {
  const panel = source("../src/components/briefflow/ChatPanel.tsx");

  assert.match(panel, /pendingMessageRef\.current = text/);
  assert.match(panel, /if \(!user \|\| !pendingMessageRef\.current\) return/);
  assert.match(panel, /onSend\(pendingMessage\)/);
});

test("a guest format choice is preserved and plan gating waits for login", () => {
  const workspace = source("../src/components/briefflow/WorkspaceShell.tsx");
  const catalog = source("../src/components/briefflow/ContentCatalogModal.tsx");

  assert.match(workspace, /setPendingMaterial\(material\)/);
  assert.match(workspace, /if \(!user \|\| !pendingMaterial\) return/);
  assert.match(workspace, /openFormat\(material\)/);
  assert.match(
    catalog,
    /if \(!user\) \{[\s\S]*onSelect\(material\)[\s\S]*onOpenChange\(false\)/,
  );
});
