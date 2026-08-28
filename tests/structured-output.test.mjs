import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStructuredJson,
  supportsReasoningControls,
} from "../src/lib/structuredOutput.ts";

test("extrai JSON válido de envelopes comuns sem alterar o conteúdo", () => {
  assert.deepEqual(parseStructuredJson('```json\n{"chat":"Olá","action":"generate_all"}\n```'), {
    chat: "Olá",
    action: "generate_all",
  });
  assert.deepEqual(parseStructuredJson('<think>análise</think>\n{"title":"Café fresco"}'), {
    title: "Café fresco",
  });
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

test("clientes de nuvem exigem JSON também da Groq e continuam após saída inválida", async () => {
  const { readFile } = await import("node:fs/promises");
  const aiClient = await readFile(new URL("../src/lib/aiClient.ts", import.meta.url), "utf8");
  const ollama = await readFile(new URL("../src/lib/ollama.ts", import.meta.url), "utf8");

  assert.match(aiClient, /if \(schema\) \{\s*payload\.response_format = \{ type: "json_object" \}/);
  assert.match(aiClient, /if \(p\.name === "groq"\) \{\s*payload\.temperature/);
  assert.match(aiClient, /Saída inválida.*Tentando o próximo/);
  assert.match(ollama, /response_format: \{ type: "json_object" \}/);
  assert.match(ollama, /if \(p\.name === "groq"\) \{\s*payload\.temperature/);
  assert.match(ollama, /tryParseJson\(content\)/);
});
