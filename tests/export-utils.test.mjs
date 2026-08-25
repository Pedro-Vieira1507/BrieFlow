import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSocialExportText,
  escapeHtml,
  sanitizeFilenamePart,
} from "../src/lib/export-utils.ts";

test("sanitizeFilenamePart creates a safe, stable filename segment", () => {
  assert.equal(
    sanitizeFilenamePart("  Café / Verão 2026  "),
    "cafe-verao-2026",
  );
  assert.equal(sanitizeFilenamePart("///", "asset"), "asset");
});

test("buildSocialExportText merges and deduplicates hashtags", () => {
  assert.equal(
    buildSocialExportText({
      brandName: "BrieFlow",
      caption: "Uma campanha incrível #Marketing #IA",
      hashtags: ["marketing", "#Design", "IA"],
    }),
    "BrieFlow\n\nUma campanha incrível\n\n#Marketing #IA #Design",
  );
});

test("buildSocialExportText supports captions without hashtags", () => {
  assert.equal(
    buildSocialExportText({
      brandName: "Marca",
      caption: "Texto final",
      hashtags: [],
    }),
    "Marca\n\nTexto final",
  );
});

test("escapeHtml protects generated document metadata", () => {
  assert.equal(
    escapeHtml('Marca </title><script>alert("x")</script>'),
    "Marca &lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
  );
});
