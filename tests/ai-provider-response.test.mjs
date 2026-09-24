import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedRetryDelay,
  readAiCompletion,
} from "../supabase/functions/_shared/aiResponse.ts";

test("reads both Workers AI result envelopes and direct chat completions", () => {
  const completion = {
    choices: [
      {
        message: { content: '{"title":"Café Aurora"}' },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 12, completion_tokens: 8 },
  };
  assert.deepEqual(
    readAiCompletion(completion),
    readAiCompletion({ success: true, result: completion }),
  );
  assert.equal(readAiCompletion(completion).content, '{"title":"Café Aurora"}');
  assert.equal(
    readAiCompletion({ result: { response: "", ...completion } }).content,
    '{"title":"Café Aurora"}',
  );
  assert.equal(
    readAiCompletion({ result: { response: " Copy " } }).content,
    "Copy",
  );
  assert.equal(readAiCompletion({ result: " Copy " }).content, "Copy");
});

test("never exposes reasoning or tool arguments as copy", () => {
  const payload = {
    choices: [
      {
        message: {
          content: null,
          reasoning_content: "private reasoning",
          tool_calls: [{ function: { arguments: "secret" } }],
        },
        finish_reason: "length",
      },
    ],
  };
  assert.equal(readAiCompletion(payload).content, "");
  assert.equal(readAiCompletion(payload).finishReason, "length");
  assert.equal(
    readAiCompletion({
      choices: [
        {
          message: {
            content: [
              { type: "reasoning", text: "analysis" },
              { type: "text", text: "copy" },
            ],
          },
        },
      ],
    }).content,
    "copy",
  );
});

test("handles malformed and missing provider content without throwing", () => {
  for (const payload of [
    null,
    {},
    { result: { response: 3, choices: [null] } },
    { choices: [{ message: { content: 7 } }] },
  ]) {
    assert.equal(readAiCompletion(payload).content, "");
  }
});

test("respects Retry-After instead of retrying before the cooldown", () => {
  const now = Date.parse("2026-09-24T12:00:00Z");
  assert.equal(boundedRetryDelay("120", now), null);
  assert.equal(boundedRetryDelay("Thu, 24 Sep 2026 12:00:30 GMT", now), null);
  assert.equal(boundedRetryDelay("2", now), 2000);
  assert.equal(boundedRetryDelay("Thu, 24 Sep 2026 12:00:03 GMT", now), 3000);
  assert.equal(boundedRetryDelay(null, now), 1500);
  assert.equal(boundedRetryDelay("invalid", now), 1500);
});
