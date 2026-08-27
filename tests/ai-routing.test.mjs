import test from "node:test";
import assert from "node:assert/strict";
import { resolveCloudAiRoute } from "../src/lib/aiRouting.ts";

const configured = {
  groqApiKey: "groq-key",
  geminiApiKey: "gemini-key",
};

test("usa Qwen principal para conteúdo final, com duas contingências Groq e Gemini", () => {
  const route = resolveCloudAiRoute("content", configured);

  assert.deepEqual(route.map(({ name, model }) => ({ name, model })), [
    { name: "groq", model: "qwen/qwen3.8-27b" },
    { name: "groq", model: "qwen/qwen3.6-27b" },
    { name: "groq", model: "openai/gpt-oss-20b" },
    { name: "gemini", model: "gemini-2.5-flash" },
  ]);
});

test("economiza no onboarding com GPT OSS e preserva Gemini como contingência", () => {
  const route = resolveCloudAiRoute("discovery", configured);

  assert.deepEqual(route.map(({ name, model }) => ({ name, model })), [
    { name: "groq", model: "openai/gpt-oss-20b" },
    { name: "gemini", model: "gemini-2.5-flash-lite" },
  ]);
});

test("aceita modelos configurados por ambiente sem alterar o transporte", () => {
  const route = resolveCloudAiRoute("content", {
    ...configured,
    groqPrimaryModel: "groq-principal",
    groqFirstFallbackModel: "groq-fallback-1",
    groqSecondFallbackModel: "groq-fallback-2",
  });

  assert.equal(route[0].model, "groq-principal");
  assert.equal(route[1].model, "groq-fallback-1");
  assert.equal(route[2].model, "groq-fallback-2");
});

test("não tenta provedor sem chave configurada", () => {
  const route = resolveCloudAiRoute("content", { groqApiKey: "groq-key" });

  assert.deepEqual(route.map((candidate) => candidate.name), ["groq", "groq", "groq"]);
});
