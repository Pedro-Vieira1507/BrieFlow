import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStructuredJson,
  supportsReasoningControls,
} from "../src/lib/structuredOutput.ts";

test("extrai JSON válido de envelopes comuns sem alterar o conteúdo", () => {
  assert.deepEqual(
    parseStructuredJson('```json\n{"chat":"Olá","action":"generate_all"}\n```'),
    {
      chat: "Olá",
      action: "generate_all",
    },
  );
  assert.deepEqual(
    parseStructuredJson('<think>análise</think>\n{"title":"Café fresco"}'),
    {
      title: "Café fresco",
    },
  );
});

test("aceita vírgula final, mas rejeita JSON truncado ou texto solto", () => {
  assert.deepEqual(parseStructuredJson('{"title":"Café fresco",}'), {
    title: "Café fresco",
  });
  assert.equal(parseStructuredJson('{"title":"Café fresco"'), null);
  assert.equal(parseStructuredJson("resposta sem estrutura"), null);
});

test("aplica controles de raciocínio somente aos modelos compatíveis da rota", () => {
  assert.equal(supportsReasoningControls("qwen/qwen3.8-27b"), true);
  assert.equal(supportsReasoningControls("openai/gpt-oss-20b"), true);
  assert.equal(supportsReasoningControls("llama-3.3-70b-versatile"), false);
});

test("client requests JSON through the authenticated proxy and validates with Zod", async () => {
  const { readFile } = await import("node:fs/promises");
  const aiClient = await readFile(
    new URL("../src/lib/aiClient.ts", import.meta.url),
    "utf8",
  );

  assert.match(aiClient, /options\.responseFormat === "json"/);
  assert.match(aiClient, /"ai-proxy"/);
  assert.match(aiClient, /options\.schema\.safeParse\(parsed\)/);
  assert.doesNotMatch(
    aiClient,
    /api\.groq\.com|generativelanguage\.googleapis\.com/,
  );
});
