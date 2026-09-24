import test from "node:test";
import assert from "node:assert/strict";
import { captureWorkspaceScope } from "../src/lib/workspaceScope.ts";
test("discards responses across logout and return to the same account", () => {
  let state = { user: { id: "a" }, workspaceVersion: 0 };
  const current = captureWorkspaceScope(() => state);
  assert.equal(current(), true);
  state = { user: null, workspaceVersion: 1 };
  assert.equal(current(), false);
  state = { user: { id: "a" }, workspaceVersion: 2 };
  assert.equal(current(), false);
});
test("discards responses after a different campaign opens", () => {
  const state = { user: { id: "a" }, workspaceVersion: 0 };
  const current = captureWorkspaceScope(() => state);
  state.workspaceVersion++;
  assert.equal(current(), false);
});
